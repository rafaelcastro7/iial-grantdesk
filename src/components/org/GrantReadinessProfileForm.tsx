import { useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import {
  AlertTriangle,
  Award,
  Banknote,
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe2,
  HelpCircle,
  Network,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { OrgFormValues } from "@/routes/_authenticated.org";
import { AUDIT_READINESS_LEVELS, REGISTRATION_STATUSES, STAGES } from "@/routes/_authenticated.org";
import { computeOrgProfileReadiness } from "@/lib/org-profile-readiness";
import { parseCSV, bnErrorMessage } from "@/lib/csv.shared";
import { PageTransition } from "@/components/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/FormField";
import { TagInput } from "@/components/ui/tag-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  form: UseFormReturn<OrgFormValues>;
  mut: { isPending: boolean };
  onSubmit: (values: OrgFormValues) => void;
  orgId: string;
  organizationName: string;
  organizations?: Array<{ id: string; name: string; slug: string; user_role: string }>;
  onSwitchOrg?: (id: string) => void;
};

export function GrantReadinessProfileForm({
  form,
  mut,
  onSubmit,
  orgId: _orgId,
  organizationName,
  organizations = [],
  onSwitchOrg,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>("identity");
  const values = form.watch();

  const readiness = computeOrgProfileReadiness({
    ...values,
    sectors: parseCSV(values.sectors),
    jurisdictions: parseCSV(values.jurisdictions),
    applicant_types: parseCSV(values.applicant_types),
    activities: parseCSV(values.activities),
    capabilities: parseCSV(values.capabilities),
    populations_served: parseCSV(values.populations_served),
    operating_regions: parseCSV(values.operating_regions),
    annual_budget_cad: optionalNumber(values.annual_budget_cad),
    funding_min_cad: optionalNumber(values.funding_min_cad),
    funding_max_cad: optionalNumber(values.funding_max_cad),
    cost_share_max_pct: optionalNumber(values.cost_share_max_pct),
    years_operating: optionalNumber(values.years_operating),
    employee_count: optionalNumber(values.employee_count),
    audit_readiness_level: values.audit_readiness_level ?? null,
    consortium_roles: parseCSV(values.consortium_roles),
    strategic_standards: parseCSV(values.strategic_standards),
    in_kind_capacity_cad: optionalNumber(values.in_kind_capacity_cad),
    partner_network: parseCSV(values.partner_network),
    past_funders: parseCSV(values.past_funders),
  });

  const bnError = bnErrorMessage(values.business_number);

  const nextFacts = (
    readiness.criticalMissing.length
      ? readiness.criticalMissing
      : readiness.items.filter((item) => !item.complete)
  ).slice(0, 4);

  // Helper for quick jumping from readiness overview to the relevant tab
  const jumpToField = (fieldKey: string) => {
    if (
      [
        "org_name",
        "legal_name",
        "registration_status",
        "applicant_types",
        "jurisdictions",
        "stage",
        "mission",
      ].includes(fieldKey)
    ) {
      setActiveTab("identity");
    } else if (
      [
        "annual_budget_cad",
        "funding_min_cad",
        "cost_share_max_pct",
        "audit_readiness_level",
        "in_kind_capacity_cad",
      ].includes(fieldKey)
    ) {
      setActiveTab("financial");
    } else if (
      [
        "consortium_roles",
        "strategic_standards",
        "sectors",
        "activities",
        "capabilities",
        "populations_served",
      ].includes(fieldKey)
    ) {
      setActiveTab("consortium");
    } else {
      setActiveTab("americas");
    }
  };

  const currentConsortiumRoles = parseCSV(values.consortium_roles);

  const toggleConsortiumRole = (roleKey: string) => {
    const set = new Set(currentConsortiumRoles);
    if (set.has(roleKey)) {
      set.delete(roleKey);
    } else {
      set.add(roleKey);
    }
    form.setValue("consortium_roles", Array.from(set).join(", "), { shouldDirty: true });
  };

  return (
    <PageTransition>
      <section className="mx-auto max-w-[1080px] space-y-6 px-4 py-6 sm:px-6">
        {/* Dynamic Multi-Tenant Workspace Header */}
        <header className="rounded-xl border bg-card/60 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Building2 className="h-3.5 w-3.5" />
                  {organizationName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {humanize(values.stage || "organization")}
                </Badge>
                {values.registration_status && (
                  <Badge variant="secondary" className="text-xs">
                    {humanize(values.registration_status)}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Organization Readiness Profile
              </h1>
              <p className="max-w-2xl text-xs text-muted-foreground sm:text-sm">
                Unified institutional ground truth for RFP eligibility gates (F1/F2), consortium
                matching, financial audit readiness, and reusable proposal intelligence.
              </p>
            </div>

            {/* Quick Tenant Switcher (when multiple clients exist) */}
            {organizations.length > 1 && onSwitchOrg && (
              <div className="rounded-lg border bg-background/80 p-2.5 text-xs shadow-sm">
                <p className="mb-1.5 font-medium text-muted-foreground">Active Workspace:</p>
                <div className="flex flex-wrap gap-1.5">
                  {organizations.map((org) => {
                    const isActive = org.name === organizationName;
                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => !isActive && onSwitchOrg(org.id)}
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow"
                            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        }`}
                      >
                        {org.name}
                        {isActive && <CheckCircle2 className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Readiness Metric & Fact Health Banner */}
        <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm md:grid-cols-[auto_1.2fr_1fr]">
          <ProgressRing value={readiness.score} ready={readiness.readyForVerifiedMatching} />

          <div className="self-center space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Profile Readiness Score</h3>
              <Badge variant={readiness.readyForVerifiedMatching ? "default" : "secondary"}>
                {readiness.readyForVerifiedMatching
                  ? "Verified Matching Ready"
                  : `${readiness.criticalMissing.length} Blocker${readiness.criticalMissing.length === 1 ? "" : "s"}`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {readiness.readyForVerifiedMatching
                ? "All critical qualification facts confirmed. The deterministic rules engine and AI Copilot have high-fidelity grounding."
                : `${readiness.criticalMissing.length} essential fact${readiness.criticalMissing.length === 1 ? "" : "s"} still missing for full F1/F2 RFP pass assurance.`}
            </p>
            <div className="pt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{readiness.complete}</span> of{" "}
              {readiness.total} readiness facts confirmed across 4 strategic pillars.
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold sm:text-sm">
              {readiness.readyForVerifiedMatching ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              {readiness.readyForVerifiedMatching ? "Tracked Facts Status" : "Priority Fact Gaps"}
            </p>
            <div className="mt-2 space-y-1.5">
              {nextFacts.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => jumpToField(item.key)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span className="truncate">• {item.label}</span>
                  <span className="text-[10px] font-medium text-primary underline">Edit</span>
                </button>
              ))}
              {nextFacts.length === 0 && (
                <p className="text-xs text-emerald-600">
                  ✓ Full profile verification complete for {organizationName}.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Tabbed Form System */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1.5 sm:grid-cols-4">
              <TabsTrigger
                value="identity"
                className="flex items-center gap-2 py-2 text-xs sm:text-sm font-medium"
              >
                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                <span>Identity & Legal</span>
              </TabsTrigger>
              <TabsTrigger
                value="financial"
                className="flex items-center gap-2 py-2 text-xs sm:text-sm font-medium"
              >
                <Banknote className="h-4 w-4 shrink-0 text-primary" />
                <span>Financial & Audit</span>
              </TabsTrigger>
              <TabsTrigger
                value="consortium"
                className="flex items-center gap-2 py-2 text-xs sm:text-sm font-medium"
              >
                <Network className="h-4 w-4 shrink-0 text-primary" />
                <span>Consortium & Standards</span>
              </TabsTrigger>
              <TabsTrigger
                value="americas"
                className="flex items-center gap-2 py-2 text-xs sm:text-sm font-medium"
              >
                <Globe2 className="h-4 w-4 shrink-0 text-primary" />
                <span>Americas & Network</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: IDENTITY & LEGAL ELIGIBILITY */}
            <TabsContent value="identity" className="mt-4 space-y-4">
              <ProfileCard
                title="Identity and Legal Eligibility"
                description="Core incorporation records used for deterministic Gate F1 and jurisdiction filters."
                icon={<Building2 className="h-5 w-5 text-primary" />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Organization name"
                    error={form.formState.errors.org_name?.message}
                    description="Displayed across proposal headers and platform"
                  >
                    <Input {...form.register("org_name")} required />
                  </FormField>

                  <FormField
                    label="Legal incorporation name"
                    description="Exact name on certificate of incorporation / letters patent"
                  >
                    <Input
                      {...form.register("legal_name")}
                      placeholder="e.g. Institute of Innovation and Advanced Learning"
                    />
                  </FormField>

                  <FormField
                    label="Legal registration status"
                    description="Primary hard filter for funding eligibility"
                  >
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      {...form.register("registration_status")}
                    >
                      <option value="">Select verified registration status</option>
                      {REGISTRATION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {humanize(status)}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label="Organization stage / type"
                    description="Structural maturity classification"
                  >
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      {...form.register("stage")}
                    >
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {humanize(stage)}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label="Business / CRA registration number"
                    description="CRA BN (9 digits, or 123456789RT0001)"
                    error={bnError ?? undefined}
                  >
                    <Input
                      {...form.register("business_number")}
                      placeholder="e.g. 789456123 or 123456789RR0001"
                      className={bnError ? "border-destructive" : ""}
                    />
                  </FormField>

                  <FormField
                    label="Official website URL"
                    description="Used by automated evidence collectors"
                  >
                    <div className="relative">
                      <Input
                        type="url"
                        {...form.register("website")}
                        placeholder="https://iial.ca"
                      />
                      {values.website && (
                        <a
                          href={values.website}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                          title="Open URL"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </FormField>

                  <FormField
                    label="Eligible applicant types"
                    description="Used for Gate F1 — list all that legally apply"
                  >
                    <Controller
                      control={form.control}
                      name="applicant_types"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="nonprofit, research, education"
                          suggestions={[
                            { value: "nonprofit", label: "Nonprofit" },
                            { value: "registered charity", label: "Registered Charity" },
                            { value: "for-profit", label: "For-Profit Enterprise" },
                            { value: "sme", label: "Small / Medium Enterprise (SME)" },
                            { value: "academic", label: "Academic / Postsecondary" },
                            { value: "research", label: "Research Institute" },
                            { value: "public body", label: "Public Body" },
                            { value: "indigenous organization", label: "Indigenous Organization" },
                            { value: "social enterprise", label: "Social Enterprise" },
                          ]}
                          lowercase
                        />
                      )}
                    />
                  </FormField>

                  <FormField
                    label="Legal jurisdictions"
                    description="Where organization is incorporated or maintains legal standing"
                  >
                    <Controller
                      control={form.control}
                      name="jurisdictions"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="CA, ON, QC"
                          suggestions={[
                            { value: "CA", label: "Canada (Federal)" },
                            { value: "ON", label: "Ontario" },
                            { value: "QC", label: "Quebec" },
                            { value: "BC", label: "British Columbia" },
                            { value: "AB", label: "Alberta" },
                            { value: "MB", label: "Manitoba" },
                            { value: "CR", label: "Costa Rica" },
                            { value: "CO", label: "Colombia" },
                            { value: "PE", label: "Peru" },
                            { value: "MX", label: "Mexico" },
                          ]}
                          uppercase
                        />
                      )}
                    />
                  </FormField>

                  <NumberField
                    form={form}
                    name="years_operating"
                    label="Years in operation"
                    max={500}
                    description="Established operating history"
                  />

                  <NumberField
                    form={form}
                    name="employee_count"
                    label="Core team / employees"
                    description="FTE staff count"
                  />
                </div>

                <div className="mt-4">
                  <FormField
                    label="Approved organizational mission statement"
                    description="Approved wording injected into AI Copilot proposals and executive summaries."
                  >
                    <Textarea
                      rows={3}
                      {...form.register("mission")}
                      placeholder="To empower individuals and organizations to innovate responsibly in response to global challenges..."
                    />
                  </FormField>
                </div>
              </ProfileCard>
            </TabsContent>

            {/* TAB 2: FINANCIAL MATURITY & AUDIT READINESS */}
            <TabsContent value="financial" className="mt-4 space-y-4">
              <ProfileCard
                title="Financial Standing & RFP Audit Hurdle Readiness"
                description="Prevents fatal disqualifications on audit hurdles and guides cash vs in-kind co-funding calculations."
                icon={<Banknote className="h-5 w-5 text-primary" />}
              >
                {/* Financial Statement Audit Degree Selector */}
                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">Financial Statement Audit Level</h4>
                      <p className="text-xs text-muted-foreground">
                        Critical qualification criteria for Global Affairs Canada (GAC), NRC-IRAP,
                        SSHRC, and Horizon Europe.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      RFP Gate F2
                    </Badge>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {AUDIT_LEVEL_CARDS.map((card) => {
                      const isSelected = values.audit_readiness_level === card.id;
                      return (
                        <div
                          key={card.id}
                          onClick={() =>
                            form.setValue("audit_readiness_level", card.id, { shouldDirty: true })
                          }
                          className={`cursor-pointer rounded-lg border p-3 transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                              : "border-border/70 bg-card hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold">{card.title}</span>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                          </div>
                          <Badge variant="secondary" className="my-1.5 text-[10px]">
                            {card.badge}
                          </Badge>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {card.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Financial Figures Grid */}
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    form={form}
                    name="annual_budget_cad"
                    label="Annual operating budget (CAD)"
                    description="Total annual organizational revenue/expenditure"
                  />

                  <NumberField
                    form={form}
                    name="in_kind_capacity_cad"
                    label="In-kind contribution capacity (CAD / Year)"
                    description="Value of senior staff time, lab facilities & standard IP"
                  />

                  <NumberField
                    form={form}
                    name="cost_share_max_pct"
                    label="Maximum affordable cost share (%)"
                    max={100}
                    description="Cash + in-kind ceiling the organization can carry"
                  />

                  <NumberField
                    form={form}
                    name="funding_min_cad"
                    label="Useful award floor (CAD)"
                    description="Grants below this amount are filtered out"
                  />

                  <NumberField
                    form={form}
                    name="funding_max_cad"
                    label="Manageable award ceiling (CAD)"
                    description="Upper limit of manageable single award"
                  />

                  <NumberField
                    form={form}
                    name="indirect_cost_rate_pct"
                    label="Indirect / overhead cost rate (%)"
                    max={100}
                    description="Institutional recovery rate (usually 10–15%)"
                  />
                </div>

                {/* In-Kind Contribution Explanatory Callout */}
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      In-Kind Matching Leverage for Consortia
                    </p>
                    <p className="text-muted-foreground">
                      Calls like Global Affairs Canada (Unsolicited Concept Notes) and SSHRC
                      Partnership Development permit up to 50% in-kind matching. Specifying
                      in-kind capacity unlocks high-value grant pipelines without straining liquid
                      cash reserves.
                    </p>
                  </div>
                </div>
              </ProfileCard>
            </TabsContent>

            {/* TAB 3: CONSORTIUM & STRATEGIC ASSETS */}
            <TabsContent value="consortium" className="mt-4 space-y-4">
              <ProfileCard
                title="Consortium Capabilities, Standards & Assets"
                description="Defines multi-stakeholder roles (Lead vs Technical vs Commercial) and proprietary standards like WCIS."
                icon={<Network className="h-5 w-5 text-primary" />}
              >
                {/* Consortium Roles Multi-Selector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">Eligible Consortium Roles</h4>
                      <p className="text-xs text-muted-foreground">
                        Select all capacities this organization can assume in multi-partner bids.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Consortium Matrix
                    </Badge>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {CONSORTIUM_ROLES_OPTIONS.map((role) => {
                      const isSelected = currentConsortiumRoles.includes(role.id);
                      return (
                        <div
                          key={role.id}
                          onClick={() => toggleConsortiumRole(role.id)}
                          className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                              : "border-border/70 bg-card hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{role.title}</span>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-4 w-4 rounded text-primary focus:ring-primary"
                            />
                          </div>
                          <Badge variant="secondary" className="my-1.5 text-[10px]">
                            {role.tag}
                          </Badge>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {role.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Standards & Delivery Capabilities */}
                <div className="mt-6 space-y-4">
                  <FormField
                    label="Strategic standards, certifications & intellectual property"
                    description="Proprietary assets monetized or deployed in grant projects"
                  >
                    <Controller
                      control={form.control}
                      name="strategic_standards"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="WCIS, CSIP, CSCIP, CARP, Traceability Protocol"
                          suggestions={[
                            {
                              value: "WCIS (Whole Chain Integrity Standard)",
                              label: "WCIS Standard",
                            },
                            { value: "CSIP Certification", label: "CSIP Professional" },
                            { value: "CSCIP Certification", label: "CSCIP Professional" },
                            { value: "CARP Certification", label: "CARP Professional" },
                            {
                              value: "Direct Trade Cacao Protocol",
                              label: "Direct Trade Protocol",
                            },
                            {
                              value: "Supply Chain MRV Protocol",
                              label: "MRV Emissions Protocol",
                            },
                            {
                              value: "Proprietary Agritech Platform",
                              label: "Agritech Platform",
                            },
                          ]}
                        />
                      )}
                    />
                  </FormField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Delivery capabilities"
                      description={
                        (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <RefreshCw className="h-3 w-3" />
                            Technical services and execution competencies
                          </span>
                        ) as unknown as string
                      }
                    >
                      <Controller
                        control={form.control}
                        name="capabilities"
                        render={({ field }) => (
                          <TagInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="Applied research, curriculum design, traceability"
                            suggestions={[
                              { value: "Applied research", label: "Applied Research" },
                              {
                                value: "Curriculum and certification design",
                                label: "Curriculum Design",
                              },
                              {
                                value: "Supply chain traceability",
                                label: "Supply Chain Traceability",
                              },
                              { value: "Emissions reduction", label: "Emissions Reduction" },
                              {
                                value: "Knowledge mobilization",
                                label: "Knowledge Mobilization",
                              },
                              {
                                value: "Farmer network coordination",
                                label: "Farmer Coordination",
                              },
                              {
                                value: "WCIS audit protocols",
                                label: "WCIS Audit Protocols",
                              },
                            ]}
                          />
                        )}
                      />
                    </FormField>

                    <FormField
                      label="Program sectors"
                      description="Domains driving grant discovery and retrieval"
                    >
                      <Controller
                        control={form.control}
                        name="sectors"
                        render={({ field }) => (
                          <TagInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="education, agriculture, technology"
                            suggestions={[
                              { value: "education", label: "Education & Workforce" },
                              { value: "agriculture", label: "Agriculture & Agroforestry" },
                              { value: "cleantech", label: "Clean Technology" },
                              { value: "technology", label: "Technology & Software" },
                              { value: "sustainability", label: "Sustainability & ESG" },
                              {
                                value: "supply chain integrity",
                                label: "Supply Chain Integrity",
                              },
                              { value: "food processing", label: "Food Processing" },
                            ]}
                            lowercase
                          />
                        )}
                      />
                    </FormField>

                    <FormField
                      label="Activities and active programs"
                      description="Specific programs currently delivered"
                    >
                      <Controller
                        control={form.control}
                        name="activities"
                        render={({ field }) => (
                          <TagInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="applied training, greenhouse pilots"
                          />
                        )}
                      />
                    </FormField>

                    <FormField
                      label="Populations & beneficiaries served"
                      description="Target groups for equity & impact scoring"
                    >
                      <Controller
                        control={form.control}
                        name="populations_served"
                        render={({ field }) => (
                          <TagInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="SMEs, cooperatives, smallholder producers"
                          />
                        )}
                      />
                    </FormField>
                  </div>

                  <FormField
                    label="Additional strategic focus areas"
                    description="Contextual narratives used by the evaluator and Grant Copilot"
                  >
                    <Textarea
                      rows={3}
                      {...form.register("focus_areas")}
                      placeholder="Sustainability, supply chain integrity, Latin America cocoa & coffee value chains, regenerative agriculture..."
                    />
                  </FormField>
                </div>
              </ProfileCard>
            </TabsContent>

            {/* TAB 4: AMERICAS FOOTPRINT & TRACK RECORD */}
            <TabsContent value="americas" className="mt-4 space-y-4">
              <ProfileCard
                title="Americas Geographic Scope & Partner Ecosystem"
                description="Coverage across Canadian provinces and Latin American jurisdictions, established partners and donor history."
                icon={<Globe2 className="h-5 w-5 text-primary" />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Operating regions & field delivery zones"
                    description="Where project benefits and field pilots take place"
                  >
                    <Controller
                      control={form.control}
                      name="operating_regions"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Canada, Ontario, Quebec, Latin America, Costa Rica"
                          suggestions={[
                            { value: "Canada", label: "Canada (National)" },
                            { value: "Ontario", label: "Ontario" },
                            { value: "Quebec", label: "Quebec" },
                            { value: "British Columbia", label: "British Columbia" },
                            { value: "Latin America", label: "Latin America (General)" },
                            { value: "Costa Rica", label: "Costa Rica" },
                            { value: "Colombia", label: "Colombia" },
                            { value: "Peru", label: "Peru" },
                            { value: "Mexico", label: "Mexico" },
                          ]}
                        />
                      )}
                    />
                  </FormField>

                  <FormField
                    label="Working languages"
                    description="Languages used in grant drafting, partner dialogue & field tools"
                  >
                    <Controller
                      control={form.control}
                      name="languages"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="en, fr, es"
                          suggestions={[
                            { value: "en", label: "English" },
                            { value: "fr", label: "French" },
                            { value: "es", label: "Spanish" },
                          ]}
                          lowercase
                        />
                      )}
                    />
                  </FormField>

                  <FormField
                    label="Established consortium network & partners"
                    description="Frequent co-applicants and institutions (Universities, Cooperatives, Off-takers)"
                  >
                    <Controller
                      control={form.control}
                      name="partner_network"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Lambton College, SOCODEVI, Nahua Canada, Université Laval"
                          suggestions={[
                            {
                              value: "Lambton College",
                              label: "Lambton College (Postsecondary Lead)",
                            },
                            {
                              value: "SOCODEVI",
                              label: "SOCODEVI (Territorial Governance Lead)",
                            },
                            {
                              value: "Nahua Canada",
                              label: "Nahua Canada (Commercial Off-taker)",
                            },
                            {
                              value: "Université Laval",
                              label: "Université Laval (Academic Lead)",
                            },
                            {
                              value: "FIMI",
                              label: "FIMI (Indigenous Women's Fund)",
                            },
                          ]}
                        />
                      )}
                    />
                  </FormField>

                  <FormField
                    label="Past funders & grant track record"
                    description="Funding agencies where the organization has prior award or review experience"
                  >
                    <Controller
                      control={form.control}
                      name="past_funders"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Global Affairs Canada, NRC-IRAP, SSHRC, CFLI"
                          suggestions={[
                            {
                              value: "Global Affairs Canada (GAC)",
                              label: "Global Affairs Canada (GAC)",
                            },
                            { value: "NRC-IRAP", label: "NRC-IRAP" },
                            { value: "SSHRC", label: "SSHRC" },
                            {
                              value: "CFLI / FCIL",
                              label: "CFLI / FCIL (Canada Fund for Local Initiatives)",
                            },
                            { value: "CanExport", label: "CanExport" },
                            { value: "Agri-Innovate", label: "Agri-Innovate" },
                            { value: "IDRC", label: "IDRC" },
                          ]}
                        />
                      )}
                    />
                  </FormField>
                </div>

                <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    Bilateral & Multi-Partner Synergy
                  </p>
                  <p className="mt-1">
                    Maintaining an active partner network enables GrantDesk to recommend viable
                    Consortium Routes (e.g. Lambton College as Academic Lead + IIAL as Technical
                    Partner) whenever a call requires accredited postsecondary or multi-year audit
                    prerequisites.
                  </p>
                </div>
              </ProfileCard>
            </TabsContent>
          </Tabs>

          {/* Sticky Bottom Actions Bar */}
          <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3.5 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              <span>
                Saving profile for <strong className="text-foreground">{organizationName}</strong>.
                Updates immediately refresh deterministic fit scoring.
              </span>
            </div>

            <Button
              type="submit"
              disabled={mut.isPending}
              className="flex items-center gap-2 px-5 font-semibold shadow-sm"
            >
              {mut.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving profile…
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Save Organization Profile
                </>
              )}
            </Button>
          </div>
        </form>
      </section>
    </PageTransition>
  );
}

// -----------------------------------------------------------------------------
// Helper UI Components & Cards
// -----------------------------------------------------------------------------

function ProfileCard({
  children,
  description,
  title,
  icon,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border bg-card shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
          </div>
        </div>
        <div className="mt-5">{children}</div>
      </CardContent>
    </Card>
  );
}

function NumberField({
  form,
  label,
  max,
  name,
  description,
}: {
  form: UseFormReturn<OrgFormValues>;
  label: string;
  max?: number;
  name: keyof OrgFormValues;
  description?: string;
}) {
  return (
    <FormField label={label} description={description}>
      <Input type="number" min="0" max={max} step="any" {...form.register(name)} />
    </FormField>
  );
}

function ProgressRing({ ready, value }: { ready: boolean; value: number }) {
  const circumference = 2 * Math.PI * 20;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg width="64" height="64" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--muted)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke={ready ? "#10b981" : "var(--primary)"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
        {value}%
      </div>
    </div>
  );
}

export function optionalNumber(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Card definitions for Financial Statement Audit Levels
const AUDIT_LEVEL_CARDS = [
  {
    id: "unaudited" as const,
    title: "Unaudited Internal Statements",
    badge: "Seed / Early Stage",
    description:
      "Internal founder/management books. Eligible for proof-of-concept seed grants. Blocked for NRC-IRAP or Horizon Europe lead roles.",
  },
  {
    id: "notice_to_reader" as const,
    title: "Notice to Reader / Compilation",
    badge: "GAC Unsolicited & Regional",
    description:
      "Statements compiled by an external CPA and signed by Board. Qualifies for Global Affairs Canada Unsolicited proposals and consortium technical partner roles.",
  },
  {
    id: "review_engagement" as const,
    title: "Review Engagement (1–2 Yrs)",
    badge: "SME R&D / NRC-IRAP Ready",
    description:
      "CPA analytical review procedures. Qualifies for NRC-IRAP, Agri-Innovate, and federal SME innovation programs without requiring a full external audit.",
  },
  {
    id: "external_audit_1yr" as const,
    title: "Full External Audit (1 Year)",
    badge: "Public Grant Ready",
    description:
      "Independent licensed auditor's report with clean opinion. Unlocks standard federal, provincial, and institutional foundation grants.",
  },
  {
    id: "external_audit_3yr" as const,
    title: "Full External Audit (2–3+ Yrs)",
    badge: "Tier 1 Bilateral / Multilateral",
    description:
      "Multi-year audited statements. Fully unlocks Tier 1 Global Affairs Canada bilateral grants, Horizon Europe lead roles, and major international programs.",
  },
];

// Definitions for Consortium Roles
const CONSORTIUM_ROLES_OPTIONS = [
  {
    id: "lead_applicant",
    title: "Lead Applicant (Direct Signatory)",
    tag: "Contribution Agreement Holder",
    description:
      "Signs primary contribution agreement with funder, bears fiduciary compliance, administers disbursements, and oversees reporting.",
  },
  {
    id: "technical_partner",
    title: "Technical & Innovation Partner",
    tag: "WCIS / Software / Protocols",
    description:
      "Provides Whole Chain Integrity Standard (WCIS) validation, digital traceability software, curriculum development, and scientific impact verification.",
  },
  {
    id: "governance_lead",
    title: "Territorial Governance & Field Lead",
    tag: "SOCODEVI / Producer Coops",
    description:
      "Mobilizes field producers, cooperative federations, and local communities (e.g. SOCODEVI or Indigenous territorial governance).",
  },
  {
    id: "commercial_partner",
    title: "Commercial Off-taker & Market Deployment",
    tag: "Nahua Canada / Exporters",
    description:
      "Purchases commodities, validates market economics, tests pilot ingredients in manufacturing, or scales export distribution across the Americas.",
  },
];
