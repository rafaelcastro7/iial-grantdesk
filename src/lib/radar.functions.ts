import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RadarClientProfile = {
  clientId: string;
  name: string;
  jurisdictions: string[];
  stage: string | null;
  annualBudget: number | null;
  currency: string | null;
  leadTimeWeeks: number | null;
};

/** Client profiles the radar can check grants against (RLS-scoped to the caller). */
export const listRadarProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RadarClientProfile[]> => {
    const { data, error } = await context.supabase
      .from("clients")
      .select("id, name, client_profiles(jurisdictions, stage, annual_budget, currency, lead_time_weeks)")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).flatMap((row) => {
      const raw = (row as { client_profiles: unknown }).client_profiles;
      const p = (Array.isArray(raw) ? raw[0] : raw) as
        | {
            jurisdictions: unknown;
            stage: string | null;
            annual_budget: number | null;
            currency: string | null;
            lead_time_weeks: number | null;
          }
        | null
        | undefined;
      if (!p) return [];
      return [
        {
          clientId: row.id as string,
          name: (row.name as string) ?? "Client",
          jurisdictions: Array.isArray(p.jurisdictions) ? (p.jurisdictions as string[]) : [],
          stage: p.stage,
          annualBudget: p.annual_budget != null ? Number(p.annual_budget) : null,
          currency: p.currency,
          leadTimeWeeks: p.lead_time_weeks,
        },
      ];
    });
  });
