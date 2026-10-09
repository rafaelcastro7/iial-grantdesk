import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DirectoryPartner = {
  id: string;
  org_id: string;
  name: string;
  country: string | null;
  type: string | null;
  contact_name: string | null;
  contact_title: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  languages: string[];
  notes: string | null;
  updated_at: string;
};

type Db = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const missingTable = (msg: string) => /partner_directory|schema cache|does not exist/i.test(msg);

async function assertMember(db: Db, userId: string, orgId: string) {
  const { data, error } = await db
    .from("user_organizations")
    .select("org_id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not a member of this organization");
}

export const listPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    await assertMember(db, context.userId, data.orgId);
    const { data: rows, error } = await db
      .from("partner_directory")
      .select("*")
      .eq("org_id", data.orgId)
      .order("name");
    if (error) {
      if (missingTable(error.message))
        return { partners: [] as DirectoryPartner[], available: false };
      throw new Error(error.message);
    }
    // Which grants each partner appears in (application plans of this org).
    const { data: plans } = await db
      .from("grant_workspaces")
      .select("grant_id, partners, grant:grants(title)")
      .eq("org_id", data.orgId);
    const usage = new Map<
      string,
      Array<{ grantId: string; title: string; role: string | null; status: string | null }>
    >();
    for (const plan of (plans ?? []) as Array<{
      grant_id: string;
      partners: Array<{ name?: string; role?: string | null; status?: string | null }>;
      grant: { title?: string } | { title?: string }[] | null;
    }>) {
      const g = Array.isArray(plan.grant) ? plan.grant[0] : plan.grant;
      for (const p of plan.partners ?? []) {
        const key = (p.name ?? "").trim().toLowerCase();
        if (!key) continue;
        const list = usage.get(key) ?? [];
        list.push({
          grantId: plan.grant_id,
          title: g?.title ?? "Grant",
          role: p.role ?? null,
          status: p.status ?? null,
        });
        usage.set(key, list);
      }
    }
    return {
      partners: (rows ?? []) as DirectoryPartner[],
      usage: Object.fromEntries(usage),
      available: true,
    };
  });

const PartnerInput = z.object({
  id: z.string().uuid().optional(),
  org_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  country: z.string().max(80).nullable(),
  type: z.string().max(80).nullable(),
  contact_name: z.string().max(120).nullable(),
  contact_title: z.string().max(120).nullable(),
  email: z.string().max(200).nullable(),
  phone: z.string().max(60).nullable(),
  website: z.string().max(300).nullable(),
  languages: z.array(z.string().max(10)).max(6),
  notes: z.string().max(4000).nullable(),
});

export const savePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => PartnerInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    await assertMember(db, context.userId, data.org_id);
    const row = { ...data, created_by: context.userId };
    const q = data.id
      ? db.from("partner_directory").update(row).eq("id", data.id).eq("org_id", data.org_id)
      : // The unique index is on lower(name), so a duplicate is reported, not merged.
        db.from("partner_directory").insert(row);
    const { data: saved, error } = await q.select("*").single();
    if (error) {
      if (missingTable(error.message)) throw new Error("directory_unavailable");
      if (/duplicate key|unique/i.test(error.message))
        throw new Error("A partner with this name already exists.");
      throw new Error(error.message);
    }
    return { partner: saved as DirectoryPartner };
  });

export const deletePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    await assertMember(db, context.userId, data.orgId);
    const { error } = await db
      .from("partner_directory")
      .delete()
      .eq("id", data.id)
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Imports the names in the active organization profile's partner network. */
export const seedDefaultPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    await assertMember(db, context.userId, data.orgId);

    const { data: existing, error } = await db
      .from("partner_directory")
      .select("name")
      .eq("org_id", data.orgId);
    if (error) {
      if (missingTable(error.message)) throw new Error("directory_unavailable");
      throw new Error(error.message);
    }
    const existingNames = new Set(
      (existing ?? []).map((p: { name: string }) => p.name.trim().toLowerCase()),
    );

    // The source is the active organization's own profile (partner_network),
    // never a list written in code.
    const { data: profile, error: profileErr } = await db
      .from("org_profiles")
      .select("partner_network")
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    const network: string[] = Array.isArray(profile?.partner_network)
      ? (profile.partner_network as unknown[]).filter((n): n is string => typeof n === "string")
      : [];

    const seen = new Set<string>();
    const toInsert: Array<Record<string, unknown>> = [];
    for (const raw of network) {
      const name = raw.trim().slice(0, 200);
      const key = name.toLowerCase();
      if (!name || existingNames.has(key) || seen.has(key)) continue;
      seen.add(key);
      toInsert.push({
        name,
        country: null,
        type: null,
        contact_name: null,
        contact_title: null,
        email: null,
        phone: null,
        website: null,
        languages: [],
        notes: null,
        org_id: data.orgId,
        created_by: context.userId,
      });
    }

    if (toInsert.length > 0) {
      const { error: insertErr } = await db.from("partner_directory").insert(toInsert);
      if (insertErr) throw new Error(insertErr.message);
    }
    return { addedCount: toInsert.length };
  });
