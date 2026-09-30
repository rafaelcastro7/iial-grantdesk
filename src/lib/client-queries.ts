import { queryOptions } from "@tanstack/react-query";
import { getClientOrganization } from "@/lib/clients.functions";

export const clientQueryOptions = (orgId: string) =>
  queryOptions({
    queryKey: ["clients", "detail", orgId],
    queryFn: () => getClientOrganization({ data: { orgId } }),
  });
