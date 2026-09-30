import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useModuleFlags() {
  return useQuery({
    queryKey: ["module-flags"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("module_flags").select("module, enabled");
      if (error) throw new Error(error.message);
      const map = new Map<string, boolean>((data ?? []).map((r) => [r.module, r.enabled]));
      return {
        list: data ?? [],
        isEnabled: (m: string) => map.get(m) ?? true,
      };
    },
  });
}

/** Consultants only see Home (/dashboard) and Grant Radar (/grants). */
export const CONSULTANT_PATHS = ["/dashboard", "/grants"];
export function isConsultantPath(path: string) {
  return CONSULTANT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function fetchIsConsultant(): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "consultant" as never)
    .maybeSingle();
  return !!data;
}

export function useIsConsultant() {
  return (
    useQuery({ queryKey: ["is-consultant"], staleTime: 60_000, queryFn: fetchIsConsultant })
      .data ?? false
  );
}

export function useIsAdmin() {
  return (
    useQuery({
      queryKey: ["is-admin"],
      staleTime: 60_000,
      queryFn: async () => {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return false;
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", u.user.id)
          .eq("role", "admin")
          .maybeSingle();
        return !!data;
      },
    }).data ?? false
  );
}
