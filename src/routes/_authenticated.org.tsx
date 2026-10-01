import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm, type UseFormProps } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRecheckFit } from "@/lib/use-recheck-fit";
import { useTranslation } from "react-i18next";
import { getOrgProfile, saveOrgProfile } from "@/lib/org.functions";
import { parseCSV } from "@/lib/csv.shared";
import { syncClientLocale } from "@/i18n/sync";
import { toast } from "sonner";
import {
  GrantReadinessProfileForm,
  optionalNumber,
} from "@/components/org/GrantReadinessProfileForm";
import "@/i18n";

const orgQueryOptions = queryOptions({
  queryKey: ["org", "self"],
  queryFn: () => getOrgProfile(),
});

export const Route = createFileRoute("/_authenticated/org")({
  head: () => ({ meta: [{ title: "Organization — IIAL" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(orgQueryOptions),
  component: OrgPage,
});

const STAGES = ["startup", "sme", "nonprofit", "research", "public_sector"] as const;
const REGISTRATION_STATUSES = [
  "registered_charity",
  "nonprofit",
  "for_profit",
  "public_body",
  "academic",
  "indigenous",
  "unregistered",
  "other",
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
});

export type OrgFormValues = z.infer<typeof orgSchema>;

function OrgPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const recheckAfterChange = useRecheckFit();
  const { data } = useSuspenseQuery(orgQueryOptions);
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
    }) => save({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org"] });
      qc.invalidateQueries({ queryKey: ["org-rules-drift"] });
      recheckAfterChange();
      toast.success(t("org.saved"));
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
      org_name: p?.org_name ?? "",
      sectors: (p?.sectors ?? []).join(", "),
      jurisdictions: (p?.jurisdictions ?? ["CA"]).join(", "),
      stage: ((p?.stage as (typeof STAGES)[number]) ?? "sme") as OrgFormValues["stage"],
      annual_budget_cad: p?.annual_budget_cad?.toString() ?? "",
      focus_areas: p?.focus_areas ?? "",
      legal_name: p?.legal_name ?? "",
      business_number: p?.business_number ?? "",
      website: p?.website ?? "",
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
    });
  };

  return <GrantReadinessProfileForm form={form} mut={mut} onSubmit={onSubmit} />;
}

// -----------------------------------------------------------------------------
// V2 — friendly redesign (presentation only; same form/mutation as v1)
// -----------------------------------------------------------------------------
