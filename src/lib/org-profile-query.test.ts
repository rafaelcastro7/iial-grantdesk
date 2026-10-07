import { describe, expect, it } from "vitest";
import { getOrgProfileForUser } from "@/lib/org-profile-query";

type Row = Record<string, unknown>;

function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        },
        maybeSingle: async () => {
          const rows = (tables[table] ?? []).filter((row) =>
            filters.every(([column, value]) => row[column] === value),
          );
          return { data: rows[0] ?? null, error: null };
        },
      };
      return query;
    },
  };
}

describe("getOrgProfileForUser tenant context", () => {
  it("loads the explicitly selected assigned tenant instead of the default tenant", async () => {
    const db = fakeSupabase({
      profiles: [{ id: "user-1", org_id: "iial" }],
      user_organizations: [
        { user_id: "user-1", org_id: "iial" },
        { user_id: "user-1", org_id: "nahua" },
      ],
      org_profiles: [
        { id: "profile-iial", org_id: "iial", org_name: "IIAL" },
        { id: "profile-nahua", org_id: "nahua", org_name: "Nahua Canada" },
      ],
    });

    const result = await getOrgProfileForUser(db as never, "user-1", "nahua");

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ org_id: "nahua", org_name: "Nahua Canada" });
  });

  it("rejects an unassigned tenant before reading its profile", async () => {
    const db = fakeSupabase({
      profiles: [{ id: "user-1", org_id: "iial" }],
      user_organizations: [{ user_id: "user-1", org_id: "iial" }],
      org_profiles: [{ id: "profile-secret", org_id: "other", org_name: "Other" }],
    });

    await expect(getOrgProfileForUser(db as never, "user-1", "other")).rejects.toThrow(
      "organization is not assigned",
    );
  });

  it("returns strategic readiness fields for IIAL and Nahua profiles", async () => {
    const db = fakeSupabase({
      profiles: [{ id: "user-1", org_id: "iial" }],
      user_organizations: [
        { user_id: "user-1", org_id: "iial" },
        { user_id: "user-1", org_id: "nahua" },
      ],
      org_profiles: [
        {
          id: "profile-iial",
          org_id: "iial",
          org_name: "IIAL",
          audit_readiness_level: "notice_to_reader",
          consortium_roles: ["technical_partner", "lead_applicant"],
          strategic_standards: ["WCIS (Whole Chain Integrity Standard)", "CSIP Certification"],
          in_kind_capacity_cad: 120000,
          partner_network: ["Lambton College", "SOCODEVI", "Nahua Canada"],
          past_funders: ["Global Affairs Canada (GAC)", "NRC-IRAP", "SSHRC"],
        },
      ],
    });

    const result = await getOrgProfileForUser(db as never, "user-1", "iial");
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      audit_readiness_level: "notice_to_reader",
      consortium_roles: ["technical_partner", "lead_applicant"],
      strategic_standards: ["WCIS (Whole Chain Integrity Standard)", "CSIP Certification"],
      in_kind_capacity_cad: 120000,
      partner_network: ["Lambton College", "SOCODEVI", "Nahua Canada"],
    });
  });
});

