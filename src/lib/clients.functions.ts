"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSupabaseAdmin } from "./supabase-admin";

/**
 * List all organizations the current user has access to
 */
export const listUserOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // The user's own session is enough: members read their memberships and
    // the organizations they belong to (RLS). Memberships are assigned in the
    // database (ensure_current_user + platform_staff); reading never adds any.
    const supabase = context.supabase;
    const [{ data, error }, { data: profile, error: profileError }] = await Promise.all([
      supabase
        .from("user_organizations")
        .select(
          `
        org_id,
        role,
        organizations:org_id (
          id,
          name,
          slug,
          created_at
        )
      `,
        )
        .eq("user_id", context.userId),
      supabase.from("profiles").select("org_id").eq("id", context.userId).maybeSingle(),
    ]);

    if (error) throw new Error(error.message);
    if (profileError) throw new Error(profileError.message);

    const orgs = (data ?? []).flatMap((row) => {
      const organization = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;
      if (!organization) return [];
      return [
        {
          ...organization,
          user_role: row.role,
          is_default: row.org_id === profile?.org_id,
        },
      ];
    });

    return { organizations: orgs };
  });

/**
 * Get a specific organization with full details for the client view
 */
export const getClientOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orgId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase = await createSupabaseAdmin();

    // Verify user has access to this org
    let { data: membership } = await supabase
      .from("user_organizations")
      .select("role")
      .eq("user_id", context.userId)
      .eq("org_id", data.orgId)
      .maybeSingle();

    if (!membership) {
      // Only platform staff, and only for the core client organizations; any
      // other org requires a real membership (no auto-join on read).
      const isStaff = await isPlatformStaff(supabase, context.userId);
      const coreIds = isStaff ? await coreClientOrgIds(supabase) : [];
      const canJoin = coreIds.includes(data.orgId);

      if (canJoin) {
        try {
          await supabase
            .from("user_organizations")
            .upsert(
              { user_id: context.userId, org_id: data.orgId, role: "admin" },
              { onConflict: "user_id,org_id", ignoreDuplicates: true },
            );
        } catch {
          // Ignore upsert error
        }
        membership = { role: "admin" };
      } else {
        throw new Error("Access denied: not a member of this organization");
      }
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", data.orgId)
      .single();

    if (orgError) throw new Error(orgError.message);

    // Get org profile (grant readiness profile)
    const { data: profile } = await supabase
      .from("org_profiles")
      .select("*")
      .eq("org_id", data.orgId)
      .maybeSingle();

    // Get member count
    const { count: memberCount } = await supabase
      .from("user_organizations")
      .select("*", { count: "exact", head: true })
      .eq("org_id", data.orgId);

    // Get stats: grants, proposals, submissions for this org
    const [{ count: grantsCount }, { count: proposalsCount }, { count: submissionsCount }] =
      await Promise.all([
        supabase
          .from("grants")
          .select("*", { count: "exact", head: true })
          .eq("org_id", data.orgId),
        supabase
          .from("proposals")
          .select("*", { count: "exact", head: true })
          .eq("org_id", data.orgId),
        supabase
          .from("submissions")
          .select("*", { count: "exact", head: true })
          .eq("org_id", data.orgId),
      ]);

    return {
      organization: org,
      profile,
      membership: membership.role,
      stats: {
        memberCount: memberCount ?? 0,
        grantsCount: grantsCount ?? 0,
        proposalsCount: proposalsCount ?? 0,
        submissionsCount: submissionsCount ?? 0,
      },
    };
  });

/**
 * Create a new organization and link current user as owner
 */
export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(1).max(200),
      slug: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/)
        .optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const admin = await createSupabaseAdmin();

    // Generate slug if not provided
    const slug =
      data.slug ??
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    // Check if slug exists
    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      throw new Error("An organization with this name/slug already exists");
    }

    // Create organization
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: data.name, slug })
      .select("id")
      .single();

    if (orgError) throw new Error(orgError.message);

    // Link user as owner
    const { error: linkError } = await admin
      .from("user_organizations")
      .insert({ user_id: context.userId, org_id: org.id, role: "owner" });

    if (linkError) throw new Error(linkError.message);

    // Also update profiles.org_id for backward compatibility (first org only)
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .single();

    if (!existingProfile?.org_id) {
      await admin.from("profiles").update({ org_id: org.id }).eq("id", context.userId);
    }

    return { organization: org };
  });

/**
 * Invite a user to an organization
 */
export const inviteUserToOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      orgId: z.string().uuid(),
      email: z.string().email(),
      role: z.enum(["admin", "member", "viewer"]).default("member"),
    }),
  )
  .handler(async ({ data, context }) => {
    const admin = await createSupabaseAdmin();

    // Verify current user is owner/admin of the org
    const { data: membership } = await admin
      .from("user_organizations")
      .select("role")
      .eq("user_id", context.userId)
      .eq("org_id", data.orgId)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Only owners and admins can invite users");
    }

    // Find user by email
    const { data: userData } = await admin.auth.admin.listUsers();
    const targetUser = userData.users.find((u) => u.email === data.email);

    if (!targetUser) {
      throw new Error("User not found with this email");
    }

    // Check if already a member
    const { data: existing } = await admin
      .from("user_organizations")
      .select("user_id")
      .eq("user_id", targetUser.id)
      .eq("org_id", data.orgId)
      .maybeSingle();

    if (existing) {
      throw new Error("User is already a member of this organization");
    }

    // Add membership
    const { error } = await admin
      .from("user_organizations")
      .insert({ user_id: targetUser.id, org_id: data.orgId, role: data.role });

    if (error) throw new Error(error.message);

    return { ok: true };
  });

/**
 * Remove a user from an organization
 */
export const removeUserFromOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      orgId: z.string().uuid(),
      userId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const admin = await createSupabaseAdmin();

    // Verify current user is owner of the org
    const { data: membership } = await admin
      .from("user_organizations")
      .select("role")
      .eq("user_id", context.userId)
      .eq("org_id", data.orgId)
      .single();

    if (!membership || membership.role !== "owner") {
      throw new Error("Only owners can remove members");
    }

    // Prevent removing self
    if (data.userId === context.userId) {
      throw new Error("Cannot remove yourself from the organization");
    }

    // Remove membership
    const { error } = await admin
      .from("user_organizations")
      .delete()
      .eq("user_id", data.userId)
      .eq("org_id", data.orgId);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

/**
 * Update user role in organization
 */
export const updateUserOrganizationRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      orgId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.enum(["admin", "member", "viewer"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const admin = await createSupabaseAdmin();

    // Verify current user is owner/admin of the org
    const { data: membership } = await admin
      .from("user_organizations")
      .select("role")
      .eq("user_id", context.userId)
      .eq("org_id", data.orgId)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Only owners and admins can update roles");
    }

    // Prevent changing owner role
    const { data: targetMembership } = await admin
      .from("user_organizations")
      .select("role")
      .eq("user_id", data.userId)
      .eq("org_id", data.orgId)
      .single();

    if (targetMembership?.role === "owner") {
      throw new Error("Cannot change owner role");
    }

    // Update role
    const { error } = await admin
      .from("user_organizations")
      .update({ role: data.role })
      .eq("user_id", data.userId)
      .eq("org_id", data.orgId);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

/**
 * List members of an organization
 */
export const listOrganizationMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orgId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const admin = await createSupabaseAdmin();

    // Verify access
    const { data: membership } = await admin
      .from("user_organizations")
      .select("role")
      .eq("user_id", context.userId)
      .eq("org_id", data.orgId)
      .single();

    if (!membership) {
      throw new Error("Access denied");
    }

    // Get members with user details
    const { data: members, error } = await admin
      .from("user_organizations")
      .select(
        `
        user_id,
        role,
        created_at,
        profiles:user_id (
          id,
          email,
          full_name,
          avatar_url
        )
      `,
      )
      .eq("org_id", data.orgId);

    if (error) throw new Error(error.message);

    return { members: members ?? [] };
  });

/**
 * Get grants evaluated for a specific organization (for grant matching view)
 */
export const listGrantsForOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      orgId: z.string().uuid(),
      limit: z.number().int().min(1).max(200).default(100),
      status: z.string().optional(),
      minFitScore: z.number().min(0).max(100).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = await createSupabaseAdmin();

    // Verify access
    const { data: membership } = await supabase
      .from("user_organizations")
      .select("role")
      .eq("user_id", context.userId)
      .eq("org_id", data.orgId)
      .single();

    if (!membership) {
      throw new Error("Access denied");
    }

    let query = supabase
      .from("grants")
      .select(
        `id, title, title_fr, summary, summary_fr, amount_cad_min, amount_cad_max,
         deadline, sectors, language, url, status, created_at,
         funder:funders(id, name, name_fr, jurisdiction),
         evaluation:grant_evaluations!left(fit_score, rationale_en, rationale_fr, eligibility_pass, created_at, model, rule_verdict:rule_snapshot->>verdict)`,
      )
      .eq("org_id", data.orgId)
      // Evaluations are per user: without this the card showed whichever
      // member's verdict came back first.
      .eq("evaluation.user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status) {
      query = query.eq("status", data.status);
    }

    const { data: grants, error } = await query;

    if (error) throw new Error(error.message);

    // Filter by min fit score if provided
    // Stored fit is 0..1; this page and its filter work in 0..100.
    let filtered = (grants ?? []).map((g) => {
      const raw = Array.isArray(g.evaluation) ? (g.evaluation[0] ?? null) : g.evaluation;
      const ev = raw as { fit_score?: number | null } | null;
      return {
        ...g,
        evaluation:
          raw && ev
            ? {
                ...raw,
                fit_score:
                  ev.fit_score == null
                    ? null
                    : Math.round(ev.fit_score <= 1 ? ev.fit_score * 100 : ev.fit_score),
              }
            : null,
      };
    });
    if (data.minFitScore !== undefined) {
      filtered = filtered.filter((g) => (g.evaluation?.fit_score ?? 0) >= data.minFitScore!);
    }

    return { grants: filtered };
  });

/** @deprecated The active workspace is client session state; this only checks access. */
export const switchOrganizationContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orgId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const admin = await createSupabaseAdmin();

    // Verify user is member of this org
    const { data: membership } = await admin
      .from("user_organizations")
      .select("role")
      .eq("user_id", context.userId)
      .eq("org_id", data.orgId)
      .single();

    if (!membership) {
      throw new Error("Access denied");
    }

    return { ok: true };
  });

/** Explicit platform role (granted by an admin), never derived from the email. */
async function isPlatformStaff(
  supabase: Awaited<ReturnType<typeof createSupabaseAdmin>>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) return false;
  return (data ?? []).some((r) => r.role === "admin" || r.role === "consultant");
}

/** The client organizations platform staff work for. */
async function coreClientOrgIds(
  supabase: Awaited<ReturnType<typeof createSupabaseAdmin>>,
): Promise<string[]> {
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .in("slug", ["iial", "nahua-canada"]);
  return (data ?? []).map((o) => o.id as string);
}
