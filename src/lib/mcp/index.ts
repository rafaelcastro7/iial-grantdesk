import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchGrants from "./tools/search-grants";
import getGrant from "./tools/get-grant";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "grantdesk-integration",
  title: "Grantdesk Integration",
  version: "0.1.0",
  instructions:
    "GrantDesk grant catalog for the signed-in user. Use `search_grants` to find opportunities, then `get_grant` for eligibility and requirements.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchGrants, getGrant],
});
