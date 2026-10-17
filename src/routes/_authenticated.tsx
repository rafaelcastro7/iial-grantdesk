import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchIsConsultant, isConsultantPath } from "@/lib/use-platform";
import { CommandPalette } from "@/components/CommandPalette";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { V2AuthenticatedShell } from "@/components/v2/V2AuthenticatedShell";
import { ActiveTenantProvider } from "@/lib/tenant-context";

const bootstrapped = new Set<string>();

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
    // Profile + default role are provisioned here (idempotent) because no
    // trigger on the auth schema is allowed. Once per user per tab.
    const key = `gd_bootstrap_${data.session.user.id}`;
    if (!bootstrapped.has(key)) {
      const { error } = await supabase.rpc("ensure_current_user");
      if (!error) bootstrapped.add(key);
    }
    // Consultants may only open permitted consultant paths. The Clients page
    // is their tenant picker and only returns explicitly assigned memberships.
    if (!isConsultantPath(location.pathname) && (await fetchIsConsultant())) {
      throw redirect({ to: "/grants" });
    }
  },
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error as Error} reset={reset} />,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <ActiveTenantProvider>
      <AuthenticatedLayoutInner />
    </ActiveTenantProvider>
  );
}

function AuthenticatedLayoutInner() {
  return (
    <V2AuthenticatedShell>
      <CommandPalette />
      <Outlet />
    </V2AuthenticatedShell>
  );
}
