import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUserOrganizations } from "@/lib/clients.functions";

/* eslint-disable react-refresh/only-export-components -- provider and hook are one public context API */

const ACTIVE_TENANT_KEY = "grantdesk.activeTenant.v1";

export type TenantMembership = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  user_role: string;
  is_default: boolean;
};

type ActiveTenantContextValue = {
  organizations: TenantMembership[];
  activeOrganization: TenantMembership | null;
  activeOrgId: string | null;
  isLoading: boolean;
  setActiveOrgId: (orgId: string) => void;
};

const ActiveTenantContext = createContext<ActiveTenantContextValue | null>(null);

export function ActiveTenantProvider({ children }: { children: React.ReactNode }) {
  const listOrganizations = useServerFn(listUserOrganizations);
  const { data, isLoading } = useQuery({
    queryKey: ["tenants", "memberships"],
    queryFn: () => listOrganizations(),
    staleTime: 60_000,
  });
  const organizations = useMemo(
    () => (data?.organizations ?? []) as TenantMembership[],
    [data?.organizations],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(ACTIVE_TENANT_KEY);
    } catch {
      // Storage may be blocked; the in-memory selection still works.
    }
    const next =
      organizations.find((organization) => organization.id === stored)?.id ??
      organizations.find((organization) => organization.is_default)?.id ??
      organizations[0]?.id ??
      null;
    setSelectedId((current) =>
      current && organizations.some((organization) => organization.id === current) ? current : next,
    );
  }, [organizations]);

  const setActiveOrgId = useCallback(
    (orgId: string) => {
      if (!organizations.some((organization) => organization.id === orgId)) {
        throw new Error("Organization is not assigned to this user");
      }
      setSelectedId(orgId);
      try {
        window.sessionStorage.setItem(ACTIVE_TENANT_KEY, orgId);
      } catch {
        // Keep the selection for this render tree even without storage.
      }
    },
    [organizations],
  );

  const activeOrganization =
    organizations.find((organization) => organization.id === selectedId) ?? null;
  const value = useMemo<ActiveTenantContextValue>(
    () => ({
      organizations,
      activeOrganization,
      activeOrgId: activeOrganization?.id ?? null,
      isLoading,
      setActiveOrgId,
    }),
    [activeOrganization, isLoading, organizations, setActiveOrgId],
  );

  return <ActiveTenantContext.Provider value={value}>{children}</ActiveTenantContext.Provider>;
}

export function useActiveTenant() {
  const context = useContext(ActiveTenantContext);
  if (!context) throw new Error("useActiveTenant must be used inside ActiveTenantProvider");
  return context;
}
