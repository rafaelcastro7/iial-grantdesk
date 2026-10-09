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
import { useTr } from "@/lib/ui-lang";

const ES: Record<string, string> = {
  "Organization identity": "Identidad de la organización",
  "Legal / registration status": "Estado legal / de registro",
  "Eligible applicant types": "Tipos de solicitante elegibles",
  "Legal jurisdictions": "Jurisdicciones legales",
  "Regions served": "Regiones atendidas",
  Mission: "Misión",
  "Program sectors": "Sectores de programa",
  "Activities and programs": "Actividades y programas",
  "Delivery capabilities": "Capacidades de ejecución",
  "Populations served": "Poblaciones atendidas",
  "Annual operating budget": "Presupuesto operativo anual",
  "Useful award floor": "Monto mínimo útil",
  "Maximum affordable cost share": "Cofinanciamiento máximo asumible",
  "Financial statement audit level": "Nivel de auditoría de estados financieros",
  "Consortium capabilities": "Capacidades de consorcio",
  "Strategic standards & IP": "Estándares estratégicos y PI",
  Startup: "Startup",
  Sme: "PyME",
  Nonprofit: "Sin fines de lucro",
  Research: "Investigación",
  "Public Sector": "Sector público",
  "Registered Charity": "Organización benéfica registrada",
  "For Profit": "Con fines de lucro",
  "Public Body": "Organismo público",
  Academic: "Académica",
  Indigenous: "Indígena",
  Unregistered: "No registrada",
  Other: "Otra",
  Organization: "Organización",
  "Identity and Legal Eligibility": "Identidad y elegibilidad legal",
  "Core incorporation records used for deterministic Gate F1 and jurisdiction filters.":
    "Registros de constitución usados por la compuerta determinista F1 y los filtros de jurisdicción.",
  "Organization name": "Nombre de la organización",
  "Displayed across proposal headers and platform":
    "Se muestra en los encabezados de propuestas y en la plataforma",
  "Legal incorporation name": "Razón social",
  "Exact name on certificate of incorporation / letters patent":
    "Nombre exacto en el acta de constitución / cartas patentes",
  "e.g. Institute of Innovation and Advanced Learning":
    "p. ej. Institute of Innovation and Advanced Learning",
  "Legal registration status": "Estado de registro legal",
  "Primary hard filter for funding eligibility":
    "Filtro principal de elegibilidad para financiamiento",
  "Organization stage / type": "Etapa / tipo de organización",
  "Structural maturity classification": "Clasificación de madurez estructural",
  "Business / CRA registration number": "Número de registro empresarial / CRA",
  "CRA BN (9 digits, or 123456789RT0001)": "BN de la CRA (9 dígitos, o 123456789RT0001)",
  "e.g. 789456123 or 123456789RR0001": "p. ej. 789456123 o 123456789RR0001",
  "Official website URL": "URL del sitio web oficial",
  "Used by automated evidence collectors": "La usan los recolectores automáticos de evidencia",
  "Who decides (memos and summaries go to)": "Quién decide (a quién van los memos y resúmenes)",
  "First name or role, e.g. the executive director":
    "Nombre o cargo, p. ej. la dirección ejecutiva",
  "Credentials to cite in partner emails": "Credenciales para citar en correos a socios",
  "Optional: research, track record or reference with its link":
    "Opcional: investigación, trayectoria o referencia con su enlace",
  "Open URL": "Abrir URL",
  "Used for Gate F1 — list all that legally apply":
    "Se usa en la compuerta F1: indique todos los que apliquen legalmente",
  "nonprofit, research, education": "nonprofit, research, education",
  "For-Profit Enterprise": "Empresa con fines de lucro",
  "Small / Medium Enterprise (SME)": "Pequeña / mediana empresa (PyME)",
  "Academic / Postsecondary": "Académica / postsecundaria",
  "Research Institute": "Instituto de investigación",
  "Indigenous Organization": "Organización indígena",
  "Social Enterprise": "Empresa social",
  "Where organization is incorporated or maintains legal standing":
    "Dónde está constituida o tiene personería jurídica la organización",
  "Canada (Federal)": "Canadá (federal)",
  Quebec: "Quebec",
  "British Columbia": "Columbia Británica",
  Mexico: "México",
  Peru: "Perú",
  "Years in operation": "Años de operación",
  "Established operating history": "Trayectoria operativa",
  "Core team / employees": "Equipo / empleados",
  "FTE staff count": "Personal en equivalentes de tiempo completo",
  "Approved organizational mission statement": "Declaración de misión aprobada",
  "Approved wording injected into AI Copilot proposals and executive summaries.":
    "Texto aprobado que el Copilot de IA usa en propuestas y resúmenes ejecutivos.",
  "To empower individuals and organizations to innovate responsibly in response to global challenges...":
    "Empoderar a personas y organizaciones para innovar de forma responsable ante los desafíos globales...",
  "Financial Standing & RFP Audit Hurdle Readiness":
    "Solidez financiera y preparación para requisitos de auditoría",
  "Prevents fatal disqualifications on audit hurdles and guides cash vs in-kind co-funding calculations.":
    "Evita descalificaciones por requisitos de auditoría y orienta el cálculo de cofinanciamiento en efectivo vs. en especie.",
  "Annual operating budget (CAD)": "Presupuesto operativo anual (CAD)",
  "Total annual organizational revenue/expenditure":
    "Ingresos/gastos anuales totales de la organización",
  "In-kind contribution capacity (CAD / Year)": "Capacidad de aporte en especie (CAD / año)",
  "Value of senior staff time, lab facilities & standard IP":
    "Valor del tiempo del personal clave, laboratorios y PI estándar",
  "Maximum affordable cost share (%)": "Cofinanciamiento máximo asumible (%)",
  "Cash + in-kind ceiling the organization can carry":
    "Tope de efectivo + especie que la organización puede asumir",
  "Useful award floor (CAD)": "Monto mínimo útil (CAD)",
  "Grants below this amount are filtered out": "Se filtran los grants por debajo de este monto",
  "Manageable award ceiling (CAD)": "Monto máximo manejable (CAD)",
  "Upper limit of manageable single award": "Límite superior de una adjudicación manejable",
  "Indirect / overhead cost rate (%)": "Tasa de costos indirectos (%)",
  "Institutional recovery rate (usually 10–15%)":
    "Tasa de recuperación institucional (normalmente 10–15%)",
  "Consortium Capabilities, Standards & Assets": "Capacidades de consorcio, estándares y activos",
  "Defines multi-stakeholder roles (Lead vs Technical vs Commercial) and the organization's own standards or methodologies.":
    "Define los roles en alianzas (líder, técnico, comercial) y los estándares o metodologías propios de la organización.",
  "Strategic standards, certifications & intellectual property":
    "Estándares estratégicos, certificaciones y propiedad intelectual",
  "Proprietary assets monetized or deployed in grant projects":
    "Activos propios monetizados o usados en proyectos financiados",
  "Your standard or methodology, staff certifications, software platform":
    "Su estándar o metodología, certificaciones del equipo, plataforma de software",
  "ISO 9001 (Quality)": "ISO 9001 (calidad)",
  "ISO 14001 (Environment)": "ISO 14001 (ambiente)",
  "MRV Emissions Protocol": "Protocolo MRV de emisiones",
  "Impact Measurement Framework": "Marco de medición de impacto",
  "Software / Digital Platform": "Plataforma de software / digital",
  "Technical services and execution competencies": "Servicios técnicos y competencias de ejecución",
  "Applied research, curriculum design, traceability":
    "Investigación aplicada, diseño curricular, trazabilidad",
  "Applied Research": "Investigación aplicada",
  "Curriculum Design": "Diseño curricular",
  "Supply Chain Traceability": "Trazabilidad de la cadena de suministro",
  "Emissions Reduction": "Reducción de emisiones",
  "Knowledge Mobilization": "Movilización del conocimiento",
  "Farmer Coordination": "Coordinación de productores",
  "Audit & Verification Protocols": "Protocolos de auditoría y verificación",
  "Domains driving grant discovery and retrieval": "Áreas que orientan la búsqueda de grants",
  "education, agriculture, technology": "education, agriculture, technology",
  "Education & Workforce": "Educación y fuerza laboral",
  "Agriculture & Agroforestry": "Agricultura y agroforestería",
  "Clean Technology": "Tecnología limpia",
  "Technology & Software": "Tecnología y software",
  "Sustainability & ESG": "Sostenibilidad y ESG",
  "Supply Chain Integrity": "Integridad de la cadena de suministro",
  "Food Processing": "Procesamiento de alimentos",
  "Activities and active programs": "Actividades y programas activos",
  "Specific programs currently delivered": "Programas que se ejecutan actualmente",
  "applied training, greenhouse pilots": "capacitación aplicada, pilotos de invernadero",
  "Populations & beneficiaries served": "Poblaciones y beneficiarios atendidos",
  "Target groups for equity & impact scoring":
    "Grupos objetivo para la evaluación de equidad e impacto",
  "SMEs, cooperatives, smallholder producers": "PyMEs, cooperativas, pequeños productores",
  "Additional strategic focus areas": "Áreas de enfoque estratégico adicionales",
  "Contextual narratives used by the evaluator and Grant Copilot":
    "Contexto que usan el evaluador y el Grant Copilot",
  "The themes, value chains or communities your organization wants funders to associate with its work...":
    "Los temas, cadenas de valor o comunidades que su organización quiere que los financiadores asocien con su trabajo...",
  "Americas Geographic Scope & Partner Ecosystem":
    "Alcance geográfico en las Américas y red de socios",
  "Coverage across Canadian provinces and Latin American jurisdictions, established partners and donor history.":
    "Cobertura en provincias canadienses y jurisdicciones latinoamericanas, socios establecidos e historial de donantes.",
  "Operating regions & field delivery zones": "Regiones de operación y zonas de trabajo de campo",
  "Where project benefits and field pilots take place":
    "Dónde se generan los beneficios y se realizan los pilotos de campo",
  "Countries, provinces or regions where you deliver projects":
    "Países, provincias o regiones donde ejecuta proyectos",
  "Canada (National)": "Canadá (nacional)",
  "Latin America (General)": "América Latina (general)",
  "Working languages": "Idiomas de trabajo",
  "Languages used in grant drafting, partner dialogue & field tools":
    "Idiomas usados en la redacción, el diálogo con socios y las herramientas de campo",
  English: "Inglés",
  French: "Francés",
  Spanish: "Español",
  "Established consortium network & partners": "Red de consorcio y socios establecidos",
  "Frequent co-applicants and institutions (Universities, Cooperatives, Off-takers)":
    "Co-solicitantes e instituciones frecuentes (universidades, cooperativas, compradores)",
  "Names of partners, e.g. a college or university, a producer cooperative, a buyer":
    "Nombres de socios, p. ej. un college o universidad, una cooperativa de productores, un comprador",
  "Past funders & grant track record": "Financiadores anteriores e historial de grants",
  "Funding agencies where the organization has prior award or review experience":
    "Agencias en las que la organización ya obtuvo o presentó solicitudes",
  "CFLI / FCIL (Canada Fund for Local Initiatives)":
    "CFLI / FCIL (Fondo Canadiense para Iniciativas Locales)",
  "Unaudited Internal Statements": "Estados internos no auditados",
  "Seed / Early Stage": "Semilla / etapa inicial",
  "Internal founder/management books. Eligible for proof-of-concept seed grants. Blocked for NRC-IRAP or Horizon Europe lead roles.":
    "Libros internos de la gerencia. Elegible para grants semilla de prueba de concepto. Bloqueado para roles líderes en NRC-IRAP u Horizon Europe.",
  "Notice to Reader / Compilation": "Aviso al lector / compilación",
  "GAC Unsolicited & Regional": "GAC no solicitadas y regionales",
  "Statements compiled by an external CPA and signed by Board. Qualifies for Global Affairs Canada Unsolicited proposals and consortium technical partner roles.":
    "Estados compilados por un CPA externo y firmados por la Junta. Califica para propuestas no solicitadas de Global Affairs Canada y roles de socio técnico en consorcios.",
  "Review Engagement (1–2 Yrs)": "Revisión limitada (1–2 años)",
  "SME R&D / NRC-IRAP Ready": "I+D PyME / listo para NRC-IRAP",
  "CPA analytical review procedures. Qualifies for NRC-IRAP, Agri-Innovate, and federal SME innovation programs without requiring a full external audit.":
    "Procedimientos de revisión analítica de un CPA. Califica para NRC-IRAP, Agri-Innovate y programas federales de innovación para PyMEs sin exigir auditoría externa completa.",
  "Full External Audit (1 Year)": "Auditoría externa completa (1 año)",
  "Public Grant Ready": "Listo para grants públicos",
  "Independent licensed auditor's report with clean opinion. Unlocks standard federal, provincial, and institutional foundation grants.":
    "Informe de auditor independiente con opinión sin salvedades. Habilita grants federales, provinciales y de fundaciones institucionales.",
  "Full External Audit (2–3+ Yrs)": "Auditoría externa completa (2–3+ años)",
  "Tier 1 Bilateral / Multilateral": "Nivel 1 bilateral / multilateral",
  "Multi-year audited statements. Fully unlocks Tier 1 Global Affairs Canada bilateral grants, Horizon Europe lead roles, and major international programs.":
    "Estados auditados de varios años. Habilita por completo los grants bilaterales de nivel 1 de Global Affairs Canada, roles líderes en Horizon Europe y grandes programas internacionales.",
  "Lead Applicant (Direct Signatory)": "Solicitante principal (firmante directo)",
  "Contribution Agreement Holder": "Titular del acuerdo de contribución",
  "Signs primary contribution agreement with funder, bears fiduciary compliance, administers disbursements, and oversees reporting.":
    "Firma el acuerdo de contribución con el financiador, asume el cumplimiento fiduciario, administra los desembolsos y supervisa los informes.",
  "Technical & Innovation Partner": "Socio técnico y de innovación",
  "Standards / Software / Protocols": "Estándares / software / protocolos",
  "Provides the technical core: its own standard or methodology, software or digital tools, curriculum development, and impact verification.":
    "Aporta el núcleo técnico: su propio estándar o metodología, software o herramientas digitales, desarrollo curricular y verificación del impacto.",
  "Territorial Governance & Field Lead": "Gobernanza territorial y liderazgo de campo",
  "Cooperatives / Community Organizations": "Cooperativas / organizaciones comunitarias",
  "Mobilizes field producers, cooperative federations, and local communities (e.g. a cooperative development organization or Indigenous territorial governance).":
    "Moviliza a productores, federaciones cooperativas y comunidades locales (p. ej. una organización de desarrollo cooperativo o una gobernanza territorial indígena).",
  "Commercial Off-taker & Market Deployment": "Comprador comercial y despliegue en el mercado",
  "Buyers / Exporters": "Compradores / exportadores",
  "Purchases products, validates market economics, tests pilot outputs in manufacturing, or scales distribution and exports.":
    "Compra productos, valida la economía de mercado, prueba resultados piloto en la manufactura o escala la distribución y las exportaciones.",
  "Maintaining an active partner network enables GrantDesk to recommend viable Consortium Routes (e.g. a college or university as Academic Lead + your organization as Technical Partner) whenever a call requires accredited postsecondary or multi-year audit prerequisites. Partners listed here can be imported into the Partner directory.":
    "Mantener una red de socios activa permite a GrantDesk recomendar rutas de consorcio viables (p. ej. un college o universidad como líder académico + su organización como socio técnico) cuando una convocatoria exige una institución postsecundaria acreditada o auditorías de varios años. Los socios listados aquí pueden importarse al Directorio de socios.",
};

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
  const tr = useTr();
  const L = (text: string) => tr(text, ES[text] ?? text);
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
                  {L(humanize(values.stage || "organization"))}
                </Badge>
                {values.registration_status && (
                  <Badge variant="secondary" className="text-xs">
                    {L(humanize(values.registration_status))}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {tr("Organization Readiness Profile", "Perfil de preparación de la organización")}
              </h1>
              <p className="max-w-2xl text-xs text-muted-foreground sm:text-sm">
                {tr(
                  "Unified institutional ground truth for RFP eligibility gates (F1/F2), consortium matching, financial audit readiness, and reusable proposal intelligence.",
                  "Fuente única de datos institucionales para las compuertas de elegibilidad (F1/F2), el emparejamiento de consorcios, la preparación de auditoría financiera y la inteligencia reutilizable para propuestas.",
                )}
              </p>
            </div>

            {/* Quick Tenant Switcher (when multiple clients exist) */}
            {organizations.length > 1 && onSwitchOrg && (
              <div className="rounded-lg border bg-background/80 p-2.5 text-xs shadow-sm">
                <p className="mb-1.5 font-medium text-muted-foreground">
                  {tr("Active Workspace:", "Espacio de trabajo activo:")}
                </p>
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
              <h3 className="text-base font-semibold">
                {tr("Profile Readiness Score", "Puntaje de preparación del perfil")}
              </h3>
              <Badge variant={readiness.readyForVerifiedMatching ? "default" : "secondary"}>
                {readiness.readyForVerifiedMatching
                  ? tr("Verified Matching Ready", "Listo para emparejamiento verificado")
                  : tr(
                      `${readiness.criticalMissing.length} Blocker${readiness.criticalMissing.length === 1 ? "" : "s"}`,
                      `${readiness.criticalMissing.length} bloqueo${readiness.criticalMissing.length === 1 ? "" : "s"}`,
                    )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {readiness.readyForVerifiedMatching
                ? tr(
                    "All critical qualification facts confirmed. The deterministic rules engine and AI Copilot have high-fidelity grounding.",
                    "Todos los datos críticos de calificación están confirmados. El motor de reglas determinista y el Copilot de IA tienen una base de alta fidelidad.",
                  )
                : tr(
                    `${readiness.criticalMissing.length} essential fact${readiness.criticalMissing.length === 1 ? "" : "s"} still missing for full F1/F2 RFP pass assurance.`,
                    `Falta${readiness.criticalMissing.length === 1 ? "" : "n"} ${readiness.criticalMissing.length} dato${readiness.criticalMissing.length === 1 ? "" : "s"} esencial${readiness.criticalMissing.length === 1 ? "" : "es"} para asegurar las compuertas F1/F2.`,
                  )}
            </p>
            <div className="pt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{readiness.complete}</span>{" "}
              {tr(
                `of ${readiness.total} readiness facts confirmed across 4 strategic pillars.`,
                `de ${readiness.total} datos de preparación confirmados en 4 pilares estratégicos.`,
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold sm:text-sm">
              {readiness.readyForVerifiedMatching ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              {readiness.readyForVerifiedMatching
                ? tr("Tracked Facts Status", "Estado de los datos")
                : tr("Priority Fact Gaps", "Datos prioritarios faltantes")}
            </p>
            <div className="mt-2 space-y-1.5">
              {nextFacts.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => jumpToField(item.key)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span className="truncate">• {L(item.label)}</span>
                  <span className="text-[10px] font-medium text-primary underline">
                    {tr("Edit", "Editar")}
                  </span>
                </button>
              ))}
              {nextFacts.length === 0 && (
                <p className="text-xs text-emerald-600">
                  ✓{" "}
                  {tr(
                    `Full profile verification complete for ${organizationName}.`,
                    `Verificación completa del perfil de ${organizationName}.`,
                  )}
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
                <span>{tr("Identity & Legal", "Identidad y legal")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="financial"
                className="flex items-center gap-2 py-2 text-xs sm:text-sm font-medium"
              >
                <Banknote className="h-4 w-4 shrink-0 text-primary" />
                <span>{tr("Financial & Audit", "Finanzas y auditoría")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="consortium"
                className="flex items-center gap-2 py-2 text-xs sm:text-sm font-medium"
              >
                <Network className="h-4 w-4 shrink-0 text-primary" />
                <span>{tr("Consortium & Standards", "Consorcio y estándares")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="americas"
                className="flex items-center gap-2 py-2 text-xs sm:text-sm font-medium"
              >
                <Globe2 className="h-4 w-4 shrink-0 text-primary" />
                <span>{tr("Americas & Network", "Américas y red")}</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: IDENTITY & LEGAL ELIGIBILITY */}
            <TabsContent value="identity" className="mt-4 space-y-4">
              <ProfileCard
                title={L("Identity and Legal Eligibility")}
                description={L(
                  "Core incorporation records used for deterministic Gate F1 and jurisdiction filters.",
                )}
                icon={<Building2 className="h-5 w-5 text-primary" />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label={L("Organization name")}
                    error={form.formState.errors.org_name?.message}
                    description={L("Displayed across proposal headers and platform")}
                  >
                    <Input {...form.register("org_name")} required />
                  </FormField>

                  <FormField
                    label={L("Legal incorporation name")}
                    description={L("Exact name on certificate of incorporation / letters patent")}
                  >
                    <Input
                      {...form.register("legal_name")}
                      placeholder={L("e.g. Institute of Innovation and Advanced Learning")}
                    />
                  </FormField>

                  <FormField
                    label={L("Legal registration status")}
                    description={L("Primary hard filter for funding eligibility")}
                  >
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      {...form.register("registration_status")}
                    >
                      <option value="">
                        {tr(
                          "Select verified registration status",
                          "Seleccione el estado de registro verificado",
                        )}
                      </option>
                      {REGISTRATION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {L(humanize(status))}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label={L("Organization stage / type")}
                    description={L("Structural maturity classification")}
                  >
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      {...form.register("stage")}
                    >
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {L(humanize(stage))}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label={L("Business / CRA registration number")}
                    description={L("CRA BN (9 digits, or 123456789RT0001)")}
                    error={bnError ?? undefined}
                  >
                    <Input
                      {...form.register("business_number")}
                      placeholder={L("e.g. 789456123 or 123456789RR0001")}
                      className={bnError ? "border-destructive" : ""}
                    />
                  </FormField>

                  <FormField
                    label={L("Official website URL")}
                    description={L("Used by automated evidence collectors")}
                  >
                    <div className="relative">
                      <Input type="url" {...form.register("website")} placeholder="https://" />
                      {values.website && (
                        <a
                          href={values.website}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                          title={L("Open URL")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </FormField>

                  <FormField
                    label={L("Who decides (memos and summaries go to)")}
                    description={L("First name or role, e.g. the executive director")}
                  >
                    <Input {...form.register("decision_maker_name")} />
                  </FormField>

                  <FormField
                    label={L("Credentials to cite in partner emails")}
                    description={L("Optional: research, track record or reference with its link")}
                  >
                    <Textarea rows={2} {...form.register("outreach_credentials")} />
                  </FormField>

                  <FormField
                    label={L("Eligible applicant types")}
                    description={L("Used for Gate F1 — list all that legally apply")}
                  >
                    <Controller
                      control={form.control}
                      name="applicant_types"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder={L("nonprofit, research, education")}
                          suggestions={[
                            { value: "nonprofit", label: L("Nonprofit") },
                            { value: "registered charity", label: L("Registered Charity") },
                            { value: "for-profit", label: L("For-Profit Enterprise") },
                            { value: "sme", label: L("Small / Medium Enterprise (SME)") },
                            { value: "academic", label: L("Academic / Postsecondary") },
                            { value: "research", label: L("Research Institute") },
                            { value: "public body", label: L("Public Body") },
                            {
                              value: "indigenous organization",
                              label: L("Indigenous Organization"),
                            },
                            { value: "social enterprise", label: L("Social Enterprise") },
                          ]}
                          lowercase
                        />
                      )}
                    />
                  </FormField>

                  <FormField
                    label={L("Legal jurisdictions")}
                    description={L(
                      "Where organization is incorporated or maintains legal standing",
                    )}
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
                            { value: "CA", label: L("Canada (Federal)") },
                            { value: "ON", label: "Ontario" },
                            { value: "QC", label: L("Quebec") },
                            { value: "BC", label: L("British Columbia") },
                            { value: "AB", label: "Alberta" },
                            { value: "MB", label: "Manitoba" },
                            { value: "CR", label: "Costa Rica" },
                            { value: "CO", label: "Colombia" },
                            { value: "PE", label: L("Peru") },
                            { value: "MX", label: L("Mexico") },
                          ]}
                          uppercase
                        />
                      )}
                    />
                  </FormField>

                  <NumberField
                    form={form}
                    name="years_operating"
                    label={L("Years in operation")}
                    max={500}
                    description={L("Established operating history")}
                  />

                  <NumberField
                    form={form}
                    name="employee_count"
                    label={L("Core team / employees")}
                    description={L("FTE staff count")}
                  />
                </div>

                <div className="mt-4">
                  <FormField
                    label={L("Approved organizational mission statement")}
                    description={L(
                      "Approved wording injected into AI Copilot proposals and executive summaries.",
                    )}
                  >
                    <Textarea
                      rows={3}
                      {...form.register("mission")}
                      placeholder={L(
                        "To empower individuals and organizations to innovate responsibly in response to global challenges...",
                      )}
                    />
                  </FormField>
                </div>
              </ProfileCard>
            </TabsContent>

            {/* TAB 2: FINANCIAL MATURITY & AUDIT READINESS */}
            <TabsContent value="financial" className="mt-4 space-y-4">
              <ProfileCard
                title={L("Financial Standing & RFP Audit Hurdle Readiness")}
                description={L(
                  "Prevents fatal disqualifications on audit hurdles and guides cash vs in-kind co-funding calculations.",
                )}
                icon={<Banknote className="h-5 w-5 text-primary" />}
              >
                {/* Financial Statement Audit Degree Selector */}
                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">
                        {tr(
                          "Financial Statement Audit Level",
                          "Nivel de auditoría de estados financieros",
                        )}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {tr(
                          "Critical qualification criteria for Global Affairs Canada (GAC), NRC-IRAP, SSHRC, and Horizon Europe.",
                          "Criterio de calificación crítico para Global Affairs Canada (GAC), NRC-IRAP, SSHRC y Horizon Europe.",
                        )}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {tr("RFP Gate F2", "Compuerta F2")}
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
                            <span className="text-xs font-semibold">{L(card.title)}</span>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                          </div>
                          <Badge variant="secondary" className="my-1.5 text-[10px]">
                            {L(card.badge)}
                          </Badge>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {L(card.description)}
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
                    label={L("Annual operating budget (CAD)")}
                    description={L("Total annual organizational revenue/expenditure")}
                  />

                  <NumberField
                    form={form}
                    name="in_kind_capacity_cad"
                    label={L("In-kind contribution capacity (CAD / Year)")}
                    description={L("Value of senior staff time, lab facilities & standard IP")}
                  />

                  <NumberField
                    form={form}
                    name="cost_share_max_pct"
                    label={L("Maximum affordable cost share (%)")}
                    max={100}
                    description={L("Cash + in-kind ceiling the organization can carry")}
                  />

                  <NumberField
                    form={form}
                    name="funding_min_cad"
                    label={L("Useful award floor (CAD)")}
                    description={L("Grants below this amount are filtered out")}
                  />

                  <NumberField
                    form={form}
                    name="funding_max_cad"
                    label={L("Manageable award ceiling (CAD)")}
                    description={L("Upper limit of manageable single award")}
                  />

                  <NumberField
                    form={form}
                    name="indirect_cost_rate_pct"
                    label={L("Indirect / overhead cost rate (%)")}
                    max={100}
                    description={L("Institutional recovery rate (usually 10–15%)")}
                  />
                </div>

                {/* In-Kind Contribution Explanatory Callout */}
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      {tr(
                        "In-Kind Matching Leverage for Consortia",
                        "Aportes en especie como contrapartida en consorcios",
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {tr(
                        "Calls like Global Affairs Canada (Unsolicited Concept Notes) and SSHRC Partnership Development permit up to 50% in-kind matching. Specifying in-kind capacity unlocks high-value grant pipelines without straining liquid cash reserves.",
                        "Convocatorias como Global Affairs Canada (notas conceptuales no solicitadas) y SSHRC Partnership Development permiten hasta un 50% de contrapartida en especie. Indicar la capacidad en especie abre grants de alto valor sin comprometer la liquidez.",
                      )}
                    </p>
                  </div>
                </div>
              </ProfileCard>
            </TabsContent>

            {/* TAB 3: CONSORTIUM & STRATEGIC ASSETS */}
            <TabsContent value="consortium" className="mt-4 space-y-4">
              <ProfileCard
                title={L("Consortium Capabilities, Standards & Assets")}
                description={L(
                  "Defines multi-stakeholder roles (Lead vs Technical vs Commercial) and the organization's own standards or methodologies.",
                )}
                icon={<Network className="h-5 w-5 text-primary" />}
              >
                {/* Consortium Roles Multi-Selector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">
                        {tr("Eligible Consortium Roles", "Roles elegibles en consorcios")}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {tr(
                          "Select all capacities this organization can assume in multi-partner bids.",
                          "Seleccione todos los roles que esta organización puede asumir en postulaciones con varios socios.",
                        )}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {tr("Consortium Matrix", "Matriz de consorcio")}
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
                            <span className="text-xs font-semibold">{L(role.title)}</span>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-4 w-4 rounded text-primary focus:ring-primary"
                            />
                          </div>
                          <Badge variant="secondary" className="my-1.5 text-[10px]">
                            {L(role.tag)}
                          </Badge>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {L(role.description)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Standards & Delivery Capabilities */}
                <div className="mt-6 space-y-4">
                  <FormField
                    label={L("Strategic standards, certifications & intellectual property")}
                    description={L("Proprietary assets monetized or deployed in grant projects")}
                  >
                    <Controller
                      control={form.control}
                      name="strategic_standards"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder={L(
                            "Your standard or methodology, staff certifications, software platform",
                          )}
                          suggestions={[
                            { value: "ISO 9001 certification", label: L("ISO 9001 (Quality)") },
                            {
                              value: "ISO 14001 certification",
                              label: L("ISO 14001 (Environment)"),
                            },
                            {
                              value: "MRV emissions protocol",
                              label: L("MRV Emissions Protocol"),
                            },
                            {
                              value: "Impact measurement framework",
                              label: L("Impact Measurement Framework"),
                            },
                            {
                              value: "Proprietary software platform",
                              label: L("Software / Digital Platform"),
                            },
                          ]}
                        />
                      )}
                    />
                  </FormField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label={L("Delivery capabilities")}
                      description={
                        (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <RefreshCw className="h-3 w-3" />
                            {L("Technical services and execution competencies")}
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
                            placeholder={L("Applied research, curriculum design, traceability")}
                            suggestions={[
                              { value: "Applied research", label: L("Applied Research") },
                              {
                                value: "Curriculum and certification design",
                                label: L("Curriculum Design"),
                              },
                              {
                                value: "Supply chain traceability",
                                label: L("Supply Chain Traceability"),
                              },
                              { value: "Emissions reduction", label: L("Emissions Reduction") },
                              {
                                value: "Knowledge mobilization",
                                label: L("Knowledge Mobilization"),
                              },
                              {
                                value: "Farmer network coordination",
                                label: L("Farmer Coordination"),
                              },
                              {
                                value: "Audit and verification protocols",
                                label: L("Audit & Verification Protocols"),
                              },
                            ]}
                          />
                        )}
                      />
                    </FormField>

                    <FormField
                      label={L("Program sectors")}
                      description={L("Domains driving grant discovery and retrieval")}
                    >
                      <Controller
                        control={form.control}
                        name="sectors"
                        render={({ field }) => (
                          <TagInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder={L("education, agriculture, technology")}
                            suggestions={[
                              { value: "education", label: L("Education & Workforce") },
                              { value: "agriculture", label: L("Agriculture & Agroforestry") },
                              { value: "cleantech", label: L("Clean Technology") },
                              { value: "technology", label: L("Technology & Software") },
                              { value: "sustainability", label: L("Sustainability & ESG") },
                              {
                                value: "supply chain integrity",
                                label: L("Supply Chain Integrity"),
                              },
                              { value: "food processing", label: L("Food Processing") },
                            ]}
                            lowercase
                          />
                        )}
                      />
                    </FormField>

                    <FormField
                      label={L("Activities and active programs")}
                      description={L("Specific programs currently delivered")}
                    >
                      <Controller
                        control={form.control}
                        name="activities"
                        render={({ field }) => (
                          <TagInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder={L("applied training, greenhouse pilots")}
                          />
                        )}
                      />
                    </FormField>

                    <FormField
                      label={L("Populations & beneficiaries served")}
                      description={L("Target groups for equity & impact scoring")}
                    >
                      <Controller
                        control={form.control}
                        name="populations_served"
                        render={({ field }) => (
                          <TagInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder={L("SMEs, cooperatives, smallholder producers")}
                          />
                        )}
                      />
                    </FormField>
                  </div>

                  <FormField
                    label={L("Additional strategic focus areas")}
                    description={L("Contextual narratives used by the evaluator and Grant Copilot")}
                  >
                    <Textarea
                      rows={3}
                      {...form.register("focus_areas")}
                      placeholder={L(
                        "The themes, value chains or communities your organization wants funders to associate with its work...",
                      )}
                    />
                  </FormField>
                </div>
              </ProfileCard>
            </TabsContent>

            {/* TAB 4: AMERICAS FOOTPRINT & TRACK RECORD */}
            <TabsContent value="americas" className="mt-4 space-y-4">
              <ProfileCard
                title={L("Americas Geographic Scope & Partner Ecosystem")}
                description={L(
                  "Coverage across Canadian provinces and Latin American jurisdictions, established partners and donor history.",
                )}
                icon={<Globe2 className="h-5 w-5 text-primary" />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label={L("Operating regions & field delivery zones")}
                    description={L("Where project benefits and field pilots take place")}
                  >
                    <Controller
                      control={form.control}
                      name="operating_regions"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder={L(
                            "Countries, provinces or regions where you deliver projects",
                          )}
                          suggestions={[
                            { value: "Canada", label: L("Canada (National)") },
                            { value: "Ontario", label: "Ontario" },
                            { value: "Quebec", label: L("Quebec") },
                            { value: "British Columbia", label: L("British Columbia") },
                            { value: "Latin America", label: L("Latin America (General)") },
                            { value: "Costa Rica", label: "Costa Rica" },
                            { value: "Colombia", label: "Colombia" },
                            { value: "Peru", label: L("Peru") },
                            { value: "Mexico", label: L("Mexico") },
                          ]}
                        />
                      )}
                    />
                  </FormField>

                  <FormField
                    label={L("Working languages")}
                    description={L(
                      "Languages used in grant drafting, partner dialogue & field tools",
                    )}
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
                            { value: "en", label: L("English") },
                            { value: "fr", label: L("French") },
                            { value: "es", label: L("Spanish") },
                          ]}
                          lowercase
                        />
                      )}
                    />
                  </FormField>

                  <FormField
                    label={L("Established consortium network & partners")}
                    description={L(
                      "Frequent co-applicants and institutions (Universities, Cooperatives, Off-takers)",
                    )}
                  >
                    <Controller
                      control={form.control}
                      name="partner_network"
                      render={({ field }) => (
                        <TagInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder={L(
                            "Names of partners, e.g. a college or university, a producer cooperative, a buyer",
                          )}
                        />
                      )}
                    />
                  </FormField>

                  <FormField
                    label={L("Past funders & grant track record")}
                    description={L(
                      "Funding agencies where the organization has prior award or review experience",
                    )}
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
                              label: L("CFLI / FCIL (Canada Fund for Local Initiatives)"),
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
                    {tr("Bilateral & Multi-Partner Synergy", "Sinergia bilateral y multisocio")}
                  </p>
                  <p className="mt-1">
                    {L(
                      "Maintaining an active partner network enables GrantDesk to recommend viable Consortium Routes (e.g. a college or university as Academic Lead + your organization as Technical Partner) whenever a call requires accredited postsecondary or multi-year audit prerequisites. Partners listed here can be imported into the Partner directory.",
                    )}
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
                {tr("Saving profile for", "Guardando el perfil de")}{" "}
                <strong className="text-foreground">{organizationName}</strong>.{" "}
                {tr(
                  "Updates immediately refresh deterministic fit scoring.",
                  "Los cambios actualizan de inmediato el puntaje de encaje determinista.",
                )}
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
                  {tr("Saving profile…", "Guardando perfil…")}
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  {tr("Save Organization Profile", "Guardar perfil de la organización")}
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
    tag: "Standards / Software / Protocols",
    description:
      "Provides the technical core: its own standard or methodology, software or digital tools, curriculum development, and impact verification.",
  },
  {
    id: "governance_lead",
    title: "Territorial Governance & Field Lead",
    tag: "Cooperatives / Community Organizations",
    description:
      "Mobilizes field producers, cooperative federations, and local communities (e.g. a cooperative development organization or Indigenous territorial governance).",
  },
  {
    id: "commercial_partner",
    title: "Commercial Off-taker & Market Deployment",
    tag: "Buyers / Exporters",
    description:
      "Purchases products, validates market economics, tests pilot outputs in manufacturing, or scales distribution and exports.",
  },
];
