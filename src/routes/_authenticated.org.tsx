import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm, type UseFormProps } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRecheckFit } from "@/lib/use-recheck-fit";
import { useTranslation } from "react-i18next";
import { getOrgProfile, saveOrgProfile } from "@/lib/org.functions";
import { parseCSV } from "@/lib/csv.shared";
import { syncClientLocale } from "@/i18n/sync";
import { toast } from "sonner";
import { useActiveTenant } from "@/lib/tenant-context";
import {
  GrantReadinessProfileForm,
  optionalNumber,
} from "@/components/org/GrantReadinessProfileForm";
import { useTr } from "@/lib/ui-lang";
import "@/i18n";

const orgQueryOptions = (orgId: string) =>
  queryOptions({
    queryKey: ["org", orgId],
    queryFn: () => getOrgProfile({ data: { orgId } }),
  });

export const Route = createFileRoute("/_authenticated/org")({
  head: () => ({ meta: [{ title: "Organization Readiness Profile — IIAL Grants" }] }),
  component: OrgPage,
});

export const STAGES = ["startup", "sme", "nonprofit", "research", "public_sector"] as const;
export const REGISTRATION_STATUSES = [
  "registered_charity",
  "nonprofit",
  "for_profit",
  "public_body",
  "academic",
  "indigenous",
  "unregistered",
  "other",
] as const;

export const AUDIT_READINESS_LEVELS = [
  "unaudited",
  "notice_to_reader",
  "review_engagement",
  "external_audit_1yr",
  "external_audit_3yr",
] as const;

const orgSchema = z.object({
  org_name: z.string().min(1, "Organization name is required"),
  sectors: z.string().optional().default(""),
  jurisdictions: z.string().optional().default("CA"),
  stage: z.enum(STAGES).default("sme"),
  annual_budget_cad: z.string().optional().default(""),
  focus_areas: z.string().optional().default(""),
  legal_name: z.string().optional().default(""),
  business_number: z.string().optional().default(""),
  website: z.string().optional().default(""),
  decision_maker_name: z.string().optional().default(""),
  outreach_credentials: z.string().optional().default(""),
  mission: z.string().optional().default(""),
  applicant_types: z.string().optional().default(""),
  activities: z.string().optional().default(""),
  capabilities: z.string().optional().default(""),
  populations_served: z.string().optional().default(""),
  operating_regions: z.string().optional().default(""),
  languages: z.string().optional().default("en, fr"),
  years_operating: z.string().optional().default(""),
  employee_count: z.string().optional().default(""),
  registration_status: z.enum(REGISTRATION_STATUSES).optional(),
  funding_min_cad: z.string().optional().default(""),
  funding_max_cad: z.string().optional().default(""),
  cost_share_max_pct: z.string().optional().default(""),
  indirect_cost_rate_pct: z.string().optional().default(""),
  audit_readiness_level: z.enum(AUDIT_READINESS_LEVELS).optional().nullable(),
  consortium_roles: z.string().optional().default(""),
  strategic_standards: z.string().optional().default(""),
  in_kind_capacity_cad: z.string().optional().default(""),
  partner_network: z.string().optional().default(""),
  past_funders: z.string().optional().default(""),
});

export type OrgFormValues = z.infer<typeof orgSchema>;

function OrgPage() {
  const { activeOrgId, activeOrganization, organizations, setActiveOrgId, isLoading } =
    useActiveTenant();
  const tr = useTr();
  const query = useQuery({
    ...orgQueryOptions(activeOrgId ?? "00000000-0000-0000-0000-000000000000"),
    enabled: !!activeOrgId,
  });

  if (isLoading || !activeOrgId || !query.data) {
    return (
      <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">
        {tr("Loading organization profile…", "Cargando perfil de la organización…")}
      </div>
    );
  }

  return (
    <OrgProfileEditor
      key={activeOrgId}
      orgId={activeOrgId}
      organizationName={activeOrganization?.name ?? tr("Organization", "Organización")}
      organizations={organizations}
      onSwitchOrg={setActiveOrgId}
      data={query.data}
    />
  );
}

function OrgProfileEditor({
  orgId,
  organizationName,
  organizations,
  onSwitchOrg,
  data,
}: {
  orgId: string;
  organizationName: string;
  organizations: Array<{ id: string; name: string; slug: string; user_role: string }>;
  onSwitchOrg: (id: string) => void;
  data: Awaited<ReturnType<typeof getOrgProfile>>;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const recheckAfterChange = useRecheckFit();
  const save = useServerFn(saveOrgProfile);

  const mut = useMutation({
    mutationFn: (input: {
      org_name: string;
      sectors: string[];
      jurisdictions: string[];
      stage: (typeof STAGES)[number];
      annual_budget_cad: number | null;
      focus_areas: string | null;
      legal_name: string | null;
      business_number: string | null;
      website: string | null;
      decision_maker_name?: string | null;
      outreach_credentials?: string | null;
      mission: string | null;
      applicant_types: string[];
      activities: string[];
      capabilities: string[];
      populations_served: string[];
      operating_regions: string[];
      languages: string[];
      years_operating: number | null;
      employee_count: number | null;
      registration_status: (typeof REGISTRATION_STATUSES)[number] | null;
      funding_min_cad: number | null;
      funding_max_cad: number | null;
      cost_share_max_pct: number | null;
      indirect_cost_rate_pct: number | null;
      audit_readiness_level?: (typeof AUDIT_READINESS_LEVELS)[number] | null;
      consortium_roles?: string[];
      strategic_standards?: string[];
      in_kind_capacity_cad?: number | null;
      partner_network?: string[];
      past_funders?: string[];
    }) => save({ data: { ...input, orgId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org", orgId] });
      qc.invalidateQueries({ queryKey: ["org-rules-drift"] });
      recheckAfterChange(orgId);
      toast.success(t("org.saved", "Organization readiness profile saved successfully"));
    },
    onError: (error) => {
      toast.error((error as Error).message);
    },
  });

  useEffect(() => {
    syncClientLocale();
  }, []);

  const p = data.profile;

  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema) as unknown as UseFormProps<OrgFormValues>["resolver"],
    defaultValues: {
      org_name: p?.org_name ?? organizationName,
      sectors: (p?.sectors ?? []).join(", "),
      jurisdictions: (p?.jurisdictions ?? ["CA"]).join(", "),
      stage: ((p?.stage as (typeof STAGES)[number]) ?? "sme") as OrgFormValues["stage"],
      annual_budget_cad: p?.annual_budget_cad?.toString() ?? "",
      focus_areas: p?.focus_areas ?? "",
      legal_name: p?.legal_name ?? "",
      business_number: p?.business_number ?? "",
      website: p?.website ?? "",
      decision_maker_name: p?.decision_maker_name ?? "",
      outreach_credentials: p?.outreach_credentials ?? "",
      mission: p?.mission ?? "",
      applicant_types: (p?.applicant_types ?? []).join(", "),
      activities: (p?.activities ?? []).join(", "),
      capabilities: (p?.capabilities ?? []).join(", "),
      populations_served: (p?.populations_served ?? []).join(", "),
      operating_regions: (p?.operating_regions ?? []).join(", "),
      languages: (p?.languages ?? ["en", "fr"]).join(", "),
      years_operating: p?.years_operating?.toString() ?? "",
      employee_count: p?.employee_count?.toString() ?? "",
      registration_status:
        (p?.registration_status as (typeof REGISTRATION_STATUSES)[number] | null) ?? undefined,
      funding_min_cad: p?.funding_min_cad?.toString() ?? "",
      funding_max_cad: p?.funding_max_cad?.toString() ?? "",
      cost_share_max_pct: p?.cost_share_max_pct?.toString() ?? "",
      indirect_cost_rate_pct: p?.indirect_cost_rate_pct?.toString() ?? "",
      audit_readiness_level:
        (p?.audit_readiness_level as (typeof AUDIT_READINESS_LEVELS)[number] | null) ?? undefined,
      consortium_roles: (p?.consortium_roles ?? []).join(", "),
      strategic_standards: (p?.strategic_standards ?? []).join(", "),
      in_kind_capacity_cad: p?.in_kind_capacity_cad?.toString() ?? "",
      partner_network: (p?.partner_network ?? []).join(", "),
      past_funders: (p?.past_funders ?? []).join(", "),
    },
  });

  const onSubmit = (values: OrgFormValues) => {
    mut.mutate({
      org_name: values.org_name,
      sectors: parseCSV(values.sectors),
      jurisdictions: parseCSV(values.jurisdictions).map((v) => v.toUpperCase()),
      stage: values.stage,
      annual_budget_cad: optionalNumber(values.annual_budget_cad),
      focus_areas: values.focus_areas || null,
      legal_name: values.legal_name || null,
      business_number: values.business_number || null,
      website: values.website || null,
      decision_maker_name: values.decision_maker_name?.trim() || null,
      outreach_credentials: values.outreach_credentials?.trim() || null,
      mission: values.mission || null,
      applicant_types: parseCSV(values.applicant_types),
      activities: parseCSV(values.activities),
      capabilities: parseCSV(values.capabilities),
      populations_served: parseCSV(values.populations_served),
      operating_regions: parseCSV(values.operating_regions),
      languages: parseCSV(values.languages).map((v) => v.toLowerCase()),
      years_operating: optionalNumber(values.years_operating),
      employee_count: optionalNumber(values.employee_count),
      registration_status: values.registration_status ?? null,
      funding_min_cad: optionalNumber(values.funding_min_cad),
      funding_max_cad: optionalNumber(values.funding_max_cad),
      cost_share_max_pct: optionalNumber(values.cost_share_max_pct),
      indirect_cost_rate_pct: optionalNumber(values.indirect_cost_rate_pct),
      audit_readiness_level: values.audit_readiness_level ?? null,
      consortium_roles: parseCSV(values.consortium_roles),
      strategic_standards: parseCSV(values.strategic_standards),
      in_kind_capacity_cad: optionalNumber(values.in_kind_capacity_cad),
      partner_network: parseCSV(values.partner_network),
      past_funders: parseCSV(values.past_funders),
    });
  };

  return (
    <GrantReadinessProfileForm
      form={form}
      mut={mut}
      onSubmit={onSubmit}
      orgId={orgId}
      organizationName={organizationName}
      organizations={organizations}
      onSwitchOrg={onSwitchOrg}
    />
  );
}
