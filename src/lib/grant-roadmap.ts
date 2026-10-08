// SOP Stage 4: Grant Strategic Roadmap & Consortium Delivery Model.
// Formulated from the actual working methodology of Rocío Cruz & ChatGPT
// for IIAL (WCIS, Cocoa, Lambton, SOCODEVI, GAC, SSHRC, FIMI).

import { pick, type UiLang } from "@/lib/ui-lang";

export type RouteId = "direct" | "academic" | "territorial" | "commercial";

export type ConsortiumRoute = {
  id: RouteId;
  title: string;
  leadEntity: string;
  iialRole: string;
  partnerRequirement: string;
  viability: "high" | "conditional" | "blocked";
  viabilityLabel: string;
  keyBarrier: string;
  tacticalValue: string;
  recommendedPartner: string;
  nextStep: string;
};

export type FinancialConditions = {
  auditLevel: {
    type: "audited_external" | "internal_signed_cpa" | "notice_to_reader" | "unspecified";
    label: string;
    allowsInternalSigned: boolean;
    status: "pass" | "warn" | "fail";
    detail: string;
  };
  matchingFunds: {
    percentage: number | null;
    inKindAllowed: boolean;
    cashRequired: boolean;
    inKindCapPct: number | null;
    label: string;
    detail: string;
  };
  canadianLegal: {
    requiresCraCharity: boolean;
    requiresNpoFederal: boolean;
    craNumberSufficient: boolean;
    label: string;
    detail: string;
  };
  disbursementTimeline: {
    intakeMode: "rolling" | "fixed" | "unsolicited" | "unknown";
    initialResponseTime: string;
    disbursementLag: string;
    detail: string;
  };
};

export type StrategicReturn = {
  opexCoverage: {
    salariesAndFees: string;
    travelAndFieldwork: string;
    communityWorkshops: string;
    managementAdmin: string;
  };
  wcisAssetCreation: {
    standardFocus: string;
    useCaseValidation: string;
    fieldTesting: string;
  };
  futureRevenueLines: {
    line: string;
    targetClient: string;
    model: string;
    priceRange: string;
    examples: string;
  }[];
};

export type OutreachKit = {
  immediateSteps: string[];
  templates: {
    id: string;
    targetAudience: "academic" | "territorial" | "funder_officer";
    title: string;
    subject: string;
    body: string;
  }[];
};

export type GrantRoadmap = {
  routes: ConsortiumRoute[];
  financial: FinancialConditions;
  strategicReturn: StrategicReturn;
  outreach: OutreachKit;
  recommendedRouteId: RouteId;
};

export type GrantRoadmapInput = {
  id: string;
  title: string;
  funderName?: string | null;
  summary?: string | null;
  amountCadMax?: number | null;
  costSharePct?: number | null;
  applicantTypes?: string[] | null;
  sectors?: string[] | null;
  deadline?: string | null;
  deadlineKind?: string | null;
  jurisdiction?: string | null;
  requirements?: { requirement: string; isCritical?: boolean; value?: string }[] | null;
  eligibilityNote?: string | null;
  orgName?: string;
};

/**
 * Builds the complete strategic grant roadmap matching Rocío Cruz's exact
 * working structure with ChatGPT, in professional Canadian/US English.
 */
export function synthesizeGrantRoadmap(
  input: GrantRoadmapInput,
  lang: UiLang = "en",
): GrantRoadmap {
  const t = (en: string, es: string) => pick(lang, en, es);
  const funder = (input.funderName ?? "").toLowerCase();
  const title = (input.title ?? "").toLowerCase();
  const summary = (input.summary ?? "").toLowerCase();
  const text = `${funder} ${title} ${summary} ${input.eligibilityNote ?? ""}`;
  const orgName = input.orgName || "IIAL";

  const isGAC =
    /global affairs|affaires mondiales|international assistance|cfli|fcil/i.test(funder) ||
    /unsolicited/i.test(title);
  const isSSHRC =
    /sshrc|crsh|social sciences and humanities/i.test(funder) ||
    /partnership development|partnership engage|connection grant/i.test(title);
  const isNSERC =
    /nserc|crsng|natural sciences/i.test(funder) ||
    /applied research and development|ard|ccsif/i.test(title);
  const isFedDev = /feddev|southern ontario|regional development/i.test(funder);
  const isSTDF = /stdf|standards and trade/i.test(funder);
  const isFID = /fund for innovation in development|fid/i.test(funder);
  const isIndigenousFunder = /fimi|ayni|indigenous|first nation|inuit|métis|autóctono/i.test(text);

  // 1. Consortium Routes Matrix
  let directViability: "high" | "conditional" | "blocked" = "conditional";
  let directViabilityLabel = t(
    "Conditional on Legal & Financial Track Record",
    "Condicionada a trayectoria legal y financiera",
  );
  let directKeyBarrier = t(
    "Requires validating organizational fiduciary capacity and federal Canadian registration.",
    "Requiere validar la capacidad fiduciaria de la organización y su registro federal en Canadá.",
  );
  let directTacticalValue = t(
    `${orgName} retains 100% of project governance, intellectual direction, and budget allocation.`,
    `${orgName} conserva el 100% de la gobernanza del proyecto, la dirección intelectual y la asignación del presupuesto.`,
  );

  if (isIndigenousFunder) {
    directViability = "blocked";
    directViabilityLabel = t(
      "Blocked Directly (Indigenous/Territorial Lead Required)",
      "Bloqueada como solicitante directo (se requiere liderazgo indígena/territorial)",
    );
    directKeyBarrier = t(
      "The fund explicitly mandates grassroots community or Indigenous women leadership.",
      "El fondo exige explícitamente liderazgo comunitario de base o de mujeres indígenas.",
    );
    directTacticalValue = t(
      "Not viable as sole lead applicant; must enter as technical delivery partner via Route C.",
      "No es viable como único solicitante principal; debe participar como socio técnico de ejecución por la Ruta C.",
    );
  } else if (isSSHRC || isNSERC) {
    directViability = "blocked";
    directViabilityLabel = t(
      "Blocked Directly (Requires Eligible Tri-Council Lead)",
      "Bloqueada como solicitante directo (requiere una institución líder elegible del Tri-Council)",
    );
    directKeyBarrier = t(
      "Grant funds are exclusively administered by recognized Canadian postsecondary research institutions.",
      "Los fondos del grant los administran exclusivamente instituciones canadienses de investigación postsecundaria reconocidas.",
    );
    directTacticalValue = t(
      "Unlocked by applying through Lambton College or a partner university (Route B).",
      "Se habilita postulando a través de Lambton College o una universidad socia (Ruta B).",
    );
  } else if (isGAC) {
    directViability = "high";
    directViabilityLabel = t(
      "High (Unsolicited Concept Note)",
      "Alta (nota conceptual no solicitada)",
    );
    directKeyBarrier = t(
      "Requires Canadian CRA registration number and 2 years of financial statements (signed internal statements accepted).",
      "Requiere número de registro CRA canadiense y 2 años de estados financieros (se aceptan estados internos firmados).",
    );
    directTacticalValue = t(
      `Allows ${orgName} to submit an initiative continuously without waiting for a scheduled thematic call, retaining 100% project leadership.`,
      `Permite a ${orgName} presentar una iniciativa en cualquier momento sin esperar una convocatoria temática, conservando el 100% del liderazgo del proyecto.`,
    );
  } else if (isSTDF) {
    directViability = "conditional";
    directViabilityLabel = t(
      "Conditional on Beneficiary Country Partner",
      "Condicionada a un socio en el país beneficiario",
    );
    directKeyBarrier = t(
      "Must address official Sanitary and Phytosanitary (SPS) barriers in implementation country (e.g. cocoa in Peru/Costa Rica).",
      "Debe abordar barreras sanitarias y fitosanitarias (MSF) oficiales en el país de implementación (p. ej. cacao en Perú/Costa Rica).",
    );
    directTacticalValue = t(
      "Viable when co-formulated with local research institutes (CITA/UCR) or technical ministries.",
      "Viable si se formula junto con institutos de investigación locales (CITA/UCR) o ministerios técnicos.",
    );
  }

  // Route B: Academic Consortium
  let academicViability: "high" | "conditional" | "blocked" = "high";
  let academicViabilityLabel = t("High (Recommended R&D Route)", "Alta (ruta de I+D recomendada)");
  let academicBarrier = t(
    `Finalize institutional overhead terms, IP sharing, and dedicated budget allocation for ${orgName}.`,
    `Cerrar los términos de gastos indirectos institucionales, la propiedad intelectual compartida y el presupuesto dedicado para ${orgName}.`,
  );
  const academicTacticalValue = t(
    `Lambton College or university manages the award; ${orgName} leads technical implementation utilizing the WCIS framework.`,
    `Lambton College o la universidad administra el grant; ${orgName} lidera la implementación técnica con el marco WCIS.`,
  );
  const academicPartner = "Lambton College / Seneca Polytechnic / University of Costa Rica";
  if (isFedDev) {
    academicViability = "conditional";
    academicViabilityLabel = t(
      "Moderate (Commercial SME Focus Preferred)",
      "Moderada (se prefiere enfoque en pymes comerciales)",
    );
    academicBarrier = t(
      "FedDev prioritizes direct commercial impact and job growth in Southern Ontario SMEs.",
      "FedDev prioriza el impacto comercial directo y la creación de empleo en pymes del sur de Ontario.",
    );
  }

  // Route C: Latin America Territorial Consortium
  let territorialViability: "high" | "conditional" | "blocked" = "high";
  let territorialViabilityLabel = t(
    "High (For Value Chain & Producer Impact)",
    "Alta (para impacto en cadena de valor y productores)",
  );
  let territorialBarrier = t(
    "Coordinate letters of commitment, governance MOU, and community validation.",
    "Coordinar cartas de compromiso, el MOU de gobernanza y la validación comunitaria.",
  );
  const territorialTacticalValue = t(
    `Local cooperative / producer association leads with statutory legitimacy; SOCODEVI provides fiduciary governance; ${orgName} implements traceability, digitalization, and WCIS certification.`,
    `La cooperativa / asociación de productores local lidera con legitimidad estatutaria; SOCODEVI aporta la gobernanza fiduciaria; ${orgName} implementa trazabilidad, digitalización y certificación WCIS.`,
  );
  const territorialPartner = "SOCODEVI / APP CACAO / Indigenous Women Producers Network";
  if (isFedDev) {
    territorialViability = "blocked";
    territorialViabilityLabel = t("Geographically Ineligible", "No elegible geográficamente");
    territorialBarrier = t(
      "Fund strictly restricted to Southern Ontario (Canada) geographic footprint.",
      "Fondo restringido estrictamente al sur de Ontario (Canadá).",
    );
  }

  // Route D: Commercial / Impact Enterprise Consortium
  const commercialViability: "high" | "conditional" | "blocked" = isFedDev ? "high" : "conditional";
  const commercialViabilityLabel = isFedDev
    ? t("High (Ontario SME Focus)", "Alta (enfoque en pymes de Ontario)")
    : t("Conditional on Private Match", "Condicionada a contrapartida privada");
  const commercialBarrier = t(
    "Requires confirmed private co-funding (cash/in-kind) and commercial viability justification.",
    "Requiere cofinanciamiento privado confirmado (en efectivo o en especie) y justificar la viabilidad comercial.",
  );
  const commercialTacticalValue = t(
    `Commercial partner leads commercial scale-up of sustainable food products; ${orgName} provides certification, traceability, and impact verification.`,
    `El socio comercial lidera el escalamiento comercial de productos alimentarios sostenibles; ${orgName} aporta certificación, trazabilidad y verificación de impacto.`,
  );
  const commercialPartner =
    orgName === "Nahua Canada"
      ? t(
          "Agrifood Distributors / Southern Ontario SMEs",
          "Distribuidores agroalimentarios / pymes del sur de Ontario",
        )
      : t(
          "Nahua Canada / Southern Ontario Agrifood SMEs",
          "Nahua Canada / pymes agroalimentarias del sur de Ontario",
        );

  const routes: ConsortiumRoute[] = [
    {
      id: "direct",
      title: t("Route A: Direct Lead Application", "Ruta A: Postulación directa como líder"),
      leadEntity: t(`${orgName} (Sole Lead Applicant)`, `${orgName} (único solicitante principal)`),
      iialRole: t(
        "Lead applicant and sole fiduciary administrator of the project",
        "Solicitante principal y único administrador fiduciario del proyecto",
      ),
      partnerRequirement: t(
        "Optional (letters of support from end beneficiaries recommended)",
        "Opcional (se recomiendan cartas de apoyo de los beneficiarios finales)",
      ),
      viability: directViability,
      viabilityLabel: directViabilityLabel,
      keyBarrier: directKeyBarrier,
      tacticalValue: directTacticalValue,
      recommendedPartner: t("N/A (Autonomous)", "N/A (autónomo)"),
      nextStep: t(
        "Verify portal registration with the funder and assemble institutional Concept Note.",
        "Verificar el registro en el portal del financiador y preparar la nota conceptual institucional.",
      ),
    },
    {
      id: "academic",
      title: t("Route B: Academic / R&D Consortium", "Ruta B: Consorcio académico / de I+D"),
      leadEntity: t(
        "Eligible Canadian Postsecondary Institution (e.g. Lambton College)",
        "Institución postsecundaria canadiense elegible (p. ej. Lambton College)",
      ),
      iialRole: t(
        "Non-academic technical co-applicant (delivering methodology, traceability, and WCIS framework)",
        "Co-solicitante técnico no académico (aporta metodología, trazabilidad y el marco WCIS)",
      ),
      partnerRequirement: t(
        "Mandatory (Independent principal investigator and accredited college/university)",
        "Obligatorio (investigador principal independiente y college/universidad acreditada)",
      ),
      viability: academicViability,
      viabilityLabel: academicViabilityLabel,
      keyBarrier: academicBarrier,
      tacticalValue: academicTacticalValue,
      recommendedPartner: academicPartner,
      nextStep: t(
        "Schedule alignment session with Lambton College Applied Research Office to draft Letter of Intent.",
        "Agendar una sesión de alineación con la Oficina de Investigación Aplicada de Lambton College para redactar la carta de intención.",
      ),
    },
    {
      id: "territorial",
      title: t("Route C: LATAM Territorial Consortium", "Ruta C: Consorcio territorial LATAM"),
      leadEntity: t(
        "Territorial Organization / Local Cooperative (e.g. Indigenous Base or APP CACAO)",
        "Organización territorial / cooperativa local (p. ej. base indígena o APP CACAO)",
      ),
      iialRole: t(
        "International technical partner (traceability, WCIS certification, climate and gender impact measurement)",
        "Socio técnico internacional (trazabilidad, certificación WCIS, medición de impacto climático y de género)",
      ),
      partnerRequirement: t(
        "Mandatory (Fiduciary NGO e.g. SOCODEVI + local women-led producer cooperative)",
        "Obligatorio (ONG fiduciaria p. ej. SOCODEVI + cooperativa local de productoras liderada por mujeres)",
      ),
      viability: territorialViability,
      viabilityLabel: territorialViabilityLabel,
      keyBarrier: territorialBarrier,
      tacticalValue: territorialTacticalValue,
      recommendedPartner: territorialPartner,
      nextStep: t(
        "Finalize project scope with SOCODEVI and local cooperative leadership in Peru/Costa Rica/Colombia.",
        "Cerrar el alcance del proyecto con SOCODEVI y la dirigencia de la cooperativa local en Perú/Costa Rica/Colombia.",
      ),
    },
    {
      id: "commercial",
      title: t(
        "Route D: Enterprise / Commercial Innovation",
        "Ruta D: Empresa / innovación comercial",
      ),
      leadEntity: t(
        "Impact Enterprise or Commercial SME (e.g. Nahua Canada)",
        "Empresa de impacto o pyme comercial (p. ej. Nahua Canada)",
      ),
      iialRole: t(
        "Applied research and sustainability standard design partner (WCIS)",
        "Socio de investigación aplicada y diseño del estándar de sostenibilidad (WCIS)",
      ),
      partnerRequirement: t(
        "Mandatory (Commercial agrifood enterprise with co-funding capacity)",
        "Obligatorio (empresa agroalimentaria comercial con capacidad de cofinanciamiento)",
      ),
      viability: commercialViability,
      viabilityLabel: commercialViabilityLabel,
      keyBarrier: commercialBarrier,
      tacticalValue: commercialTacticalValue,
      recommendedPartner: commercialPartner,
      nextStep: t(
        "Execute co-investment MOU and supply chain commercial rollout plan.",
        "Firmar el MOU de coinversión y el plan de despliegue comercial en la cadena de suministro.",
      ),
    },
  ];

  // Determine recommended route
  let recommendedRouteId: RouteId = "academic";
  if (isGAC) recommendedRouteId = "direct";
  else if (isIndigenousFunder) recommendedRouteId = "territorial";
  else if (isFedDev) recommendedRouteId = "commercial";
  else if (isSSHRC || isNSERC) recommendedRouteId = "academic";
  else if (directViability === "high") recommendedRouteId = "direct";

  // 2. Financial Conditions & Critical Hurdles
  const auditLevel =
    isSSHRC || isNSERC
      ? {
          type: "audited_external" as const,
          label: t("External Audit Required (3 Years)", "Se requiere auditoría externa (3 años)"),
          allowsInternalSigned: false,
          status: "warn" as const,
          detail: t(
            `Direct fiduciary management requires 3 years of audited financial statements. Overcome by applying via Lambton College or eligible postsecondary partner as administrative lead (Route B).`,
            `La gestión fiduciaria directa requiere 3 años de estados financieros auditados. Se resuelve postulando a través de Lambton College u otro socio postsecundario elegible como líder administrativo (Ruta B).`,
          ),
        }
      : isGAC
        ? {
            type: "internal_signed_cpa" as const,
            label: t(
              "Accepts Signed Internal Financial Statements",
              "Acepta estados financieros internos firmados",
            ),
            allowsInternalSigned: true,
            status: "pass" as const,
            detail: t(
              `Global Affairs Canada accepts signed financial statements for the past 2 fiscal years from the legal representative / internal CPA. Lack of external audit does not disqualify ${orgName}.`,
              `Global Affairs Canada acepta estados financieros firmados de los últimos 2 ejercicios por el representante legal / contador interno. No tener auditoría externa no descalifica a ${orgName}.`,
            ),
          }
        : {
            type: "notice_to_reader" as const,
            label: t("Formal Financial Statements", "Estados financieros formales"),
            allowsInternalSigned: true,
            status: "pass" as const,
            detail: t(
              "Submit balance sheet and income statements for the last two operating fiscal years.",
              "Presentar balance general y estado de resultados de los dos últimos ejercicios fiscales.",
            ),
          };

  const costSharePct =
    input.costSharePct ??
    (isSSHRC && /connection/i.test(title) ? 50 : isFedDev ? 50 : isNSERC ? 25 : 0);
  const allowsInKind = isSSHRC || isGAC || isSTDF || costSharePct > 0;
  const matchingFunds = {
    percentage: costSharePct,
    inKindAllowed: allowsInKind,
    cashRequired: isNSERC || (/mitacs/i.test(text) ? true : false),
    inKindCapPct: allowsInKind ? 50 : null,
    label:
      costSharePct > 0
        ? t(`${costSharePct}% Matching Contribution`, `Contrapartida del ${costSharePct}%`)
        : t(
            "100% Non-Repayable (No Matching Required)",
            "100% no reembolsable (sin contrapartida)",
          ),
    detail:
      costSharePct > 0
        ? allowsInKind
          ? t(
              "Permits covering matching contribution through eligible in-kind support: researcher hours, methodologies, and technical platform tools.",
              "Permite cubrir la contrapartida con aportes en especie elegibles: horas de investigadores, metodologías y herramientas de plataforma técnica.",
            )
          : t(
              "Requires verifiable cash contributions deposited into a dedicated project bank account.",
              "Requiere aportes en efectivo verificables depositados en una cuenta bancaria exclusiva del proyecto.",
            )
        : t(
            "The grant covers 100% of eligible project activities without requiring cost-sharing or co-investment.",
            "El grant cubre el 100% de las actividades elegibles del proyecto sin exigir costos compartidos ni coinversión.",
          ),
  };

  const canadianLegal = {
    requiresCraCharity: /charity|charitable status|bienfaisance/i.test(text),
    requiresNpoFederal: true,
    craNumberSufficient: isGAC || /business number|cra/i.test(text),
    label: isGAC
      ? t("Canadian Entity CRA Business Number", "Número de empresa CRA de entidad canadiense")
      : t(
          "Federal Entity or Recognized Corporate Registration",
          "Entidad federal o registro corporativo reconocido",
        ),
    detail: isGAC
      ? t(
          "Requires recognized Canadian legal status and active Canada Revenue Agency (CRA) Business Number.",
          "Requiere personería jurídica canadiense reconocida y un número de empresa activo de la Canada Revenue Agency (CRA).",
        )
      : t(
          "Must maintain federal or provincial incorporation in good standing.",
          "Debe mantener una constitución federal o provincial vigente y al día.",
        ),
  };

  const isRolling = /rolling|continu|unsolicited/i.test(
    `${input.deadlineKind ?? ""} ${title} ${summary}`,
  );
  const disbursementTimeline = {
    intakeMode: isRolling
      ? ("rolling" as const)
      : input.deadline
        ? ("fixed" as const)
        : ("unknown" as const),
    initialResponseTime: isGAC
      ? t("~2 months (Concept Note assessment)", "~2 meses (evaluación de la nota conceptual)")
      : isFID
        ? t("~12 months to first disbursement", "~12 meses hasta el primer desembolso")
        : t("~3 to 4 months post-deadline", "~3 a 4 meses después del cierre"),
    disbursementLag: isFID
      ? t("12 months", "12 meses")
      : t(
          "2 to 3 months post contribution agreement",
          "2 a 3 meses después del acuerdo de contribución",
        ),
    detail: isRolling
      ? t(
          "Rolling window open continuously throughout the year. Evaluates a concept note first, then invites full proposal.",
          "Ventanilla abierta de forma continua todo el año. Primero evalúa una nota conceptual y luego invita a la propuesta completa.",
        )
      : input.deadline
        ? t(
            `Fixed competitive intake cycle closing on ${input.deadline}.`,
            `Convocatoria competitiva con cierre fijo el ${input.deadline}.`,
          )
        : t(
            "Periodic annual competitive call governed by funder calendar.",
            "Convocatoria competitiva anual según el calendario del financiador.",
          ),
  };

  const financial: FinancialConditions = {
    auditLevel,
    matchingFunds,
    canadianLegal,
    disbursementTimeline,
  };

  // 3. Strategic Value Return & Revenue Model
  const strategicReturn: StrategicReturn = {
    opexCoverage: {
      salariesAndFees: t(
        `Full technical fees and management compensation for ${orgName} core personnel (researchers, agronomists, and supply chain specialists).`,
        `Honorarios técnicos completos y compensación de gestión para el personal clave de ${orgName} (investigadores, agrónomos y especialistas en cadena de suministro).`,
      ),
      travelAndFieldwork: t(
        "Direct financing for international field missions, cooperative site visits, and community participatory work.",
        "Financiamiento directo de misiones de campo internacionales, visitas a cooperativas y trabajo participativo comunitario.",
      ),
      communityWorkshops: t(
        "Logistical expenses, workshop venues, materials, and facilitation for local stakeholder consultation sessions.",
        "Gastos logísticos, sedes de talleres, materiales y facilitación de sesiones de consulta con actores locales.",
      ),
      managementAdmin: t(
        "Eligible administrative overhead, software licenses, impact monitoring systems, and fiduciary reporting.",
        "Gastos administrativos elegibles, licencias de software, sistemas de monitoreo de impacto e informes fiduciarios.",
      ),
    },
    wcisAssetCreation: {
      standardFocus: t(
        "Whole Chain Integrity Standard (WCIS): Comprehensive standard for traceability, climate governance, and gender equity across agricultural value chains.",
        "Whole Chain Integrity Standard (WCIS): estándar integral de trazabilidad, gobernanza climática y equidad de género en cadenas de valor agrícolas.",
      ),
      useCaseValidation: t(
        "Rigorous field piloting and proof-of-concept of the methodology in operating cocoa and coffee supply chains with partner cooperatives.",
        "Pilotaje riguroso en campo y prueba de concepto de la metodología en cadenas de cacao y café en operación con cooperativas socias.",
      ),
      fieldTesting: t(
        "Quantitative verification of smallholder household income gains, post-harvest loss reduction, and women producer economic autonomy.",
        "Verificación cuantitativa del aumento de ingresos de hogares de pequeños productores, la reducción de pérdidas poscosecha y la autonomía económica de las productoras.",
      ),
    },
    futureRevenueLines: [
      {
        line: t("WCIS Maturity Diagnostics", "Diagnósticos de madurez WCIS"),
        targetClient: t(
          "Agrifood export enterprises, agricultural cooperatives, and development agencies",
          "Empresas agroexportadoras, cooperativas agrícolas y agencias de desarrollo",
        ),
        model: t(
          "Initial integrity audit and supply chain traceability readiness assessment",
          "Auditoría inicial de integridad y evaluación de preparación para la trazabilidad",
        ),
        priceRange: t("CAD $8,000 – $20,000 per assessment", "CAD $8,000 – $20,000 por evaluación"),
        examples: t(
          "Corporate supply chain due diligence benchmark against EUDR and ESG compliance standards.",
          "Debida diligencia de la cadena de suministro corporativa frente a los estándares EUDR y ESG.",
        ),
      },
      {
        line: t(
          "Professional Certifications (CSIP, CSCIP, CARP)",
          "Certificaciones profesionales (CSIP, CSCIP, CARP)",
        ),
        targetClient: t(
          "Individual professionals, ESG auditors, supply chain consultants, and agronomists",
          "Profesionales independientes, auditores ESG, consultores de cadena de suministro y agrónomos",
        ),
        model: t(
          "Modular enrollment fee, certification examination, and annual credential renewal",
          "Matrícula por módulo, examen de certificación y renovación anual de la credencial",
        ),
        priceRange: t(
          "CAD $300/module · CAD $1,120 full designation",
          "CAD $300/módulo · CAD $1,120 designación completa",
        ),
        examples: t(
          "CSIP-A in applied sustainability and CSCIP in supply chain integrity and traceability.",
          "CSIP-A en sostenibilidad aplicada y CSCIP en integridad y trazabilidad de la cadena de suministro.",
        ),
      },
      {
        line: t(
          "Live Cohorts & Corporate Training Programs",
          "Cohortes en vivo y programas de capacitación corporativa",
        ),
        targetClient: t(
          "Producer federations, commodity boards, corporate agrifood buyers",
          "Federaciones de productores, juntas de productos básicos, compradores agroalimentarios corporativos",
        ),
        model: t(
          "Custom institutional cohorts delivered live with subject matter experts",
          "Cohortes institucionales a medida, en vivo, con expertos temáticos",
        ),
        priceRange: t(
          "CAD $5,000 – $15,000 per institutional cohort",
          "CAD $5,000 – $15,000 por cohorte institucional",
        ),
        examples: t(
          "Closed corporate masterclass on ethical data governance and verified origin tracking.",
          "Masterclass corporativa cerrada sobre gobernanza ética de datos y rastreo de origen verificado.",
        ),
      },
      {
        line: t(
          "University Partnerships with Tuition Share",
          "Alianzas universitarias con reparto de matrícula",
        ),
        targetClient: t(
          "Canadian and Latin American universities and polytechnics",
          "Universidades y politécnicos de Canadá y América Latina",
        ),
        model: t(
          "Joint micro-credentials and executive diplomas with revenue sharing",
          "Microcredenciales y diplomados ejecutivos conjuntos con reparto de ingresos",
        ),
        priceRange: t(
          "30% – 50% tuition share per enrolled student",
          "30% – 50% de la matrícula por estudiante inscrito",
        ),
        examples: t(
          "Joint executive credential with Lambton College or UCR on regenerative agricultural standards.",
          "Credencial ejecutiva conjunta con Lambton College o la UCR sobre estándares de agricultura regenerativa.",
        ),
      },
    ],
  };

  // 4. Outreach Action Kit
  const funderDisplay = input.funderName || t("the funding agency", "la agencia financiadora");
  const orgDisplayName =
    orgName === "IIAL" ? "Institute of Innovation and Advanced Learning (IIAL)" : orgName;

  const outreach: OutreachKit = {
    immediateSteps: [
      isSSHRC || isNSERC
        ? t(
            "1. Contact the Lambton College Applied Research & Innovation Office to confirm interest as postsecondary lead applicant.",
            "1. Contactar a la Oficina de Investigación Aplicada e Innovación de Lambton College para confirmar su interés como solicitante principal postsecundario.",
          )
        : isGAC
          ? t(
              `1. Access Partners@International portal to verify ${orgName} CRA business number and upload signed financial statements.`,
              `1. Entrar al portal Partners@International para verificar el número de empresa CRA de ${orgName} y subir los estados financieros firmados.`,
            )
          : t(
              "1. Download official applicant guides to verify strategic alignment with published thematic priority areas.",
              "1. Descargar las guías oficiales para solicitantes y verificar la alineación estratégica con las áreas temáticas prioritarias publicadas.",
            ),
      t(
        "2. Draft a 2-page project Concept Note highlighting the innovative methodology and delivery capacity.",
        "2. Redactar una nota conceptual de 2 páginas que destaque la metodología innovadora y la capacidad de ejecución.",
      ),
      t(
        "3. Request formal Letters of Intent from territorial partners (SOCODEVI, producer cooperatives, research centers).",
        "3. Solicitar cartas de intención formales a los socios territoriales (SOCODEVI, cooperativas de productores, centros de investigación).",
      ),
      t(
        "4. Schedule a 15-minute alignment call with the Program Officer to validate project scope prior to formal submission.",
        "4. Agendar una llamada de alineación de 15 minutos con el Program Officer para validar el alcance antes de la postulación formal.",
      ),
    ],
    templates: [
      {
        id: "academic-partner",
        targetAudience: "academic",
        title: t(
          "Academic Partner Outreach (Lambton College)",
          "Contacto con socio académico (Lambton College)",
        ),
        subject: t(
          `Applied Research Consortium Proposal: ${input.title} / WCIS Framework`,
          `Propuesta de consorcio de investigación aplicada: ${input.title} / marco WCIS`,
        ),
        body: t(
          `Dear Director of Applied Research & Innovation,\n\nI am reaching out on behalf of ${orgDisplayName}. We have identified an immediate strategic opportunity in the call "${input.title}" funded by ${funderDisplay}.\n\nWe propose structuring a joint consortium where your institution serves as the postsecondary lead applicant, while ${orgName} serves as the technical delivery co-applicant leading field implementation of the Whole Chain Integrity Standard (WCIS) for traceability, gender equity, and climate resilience in agrifood value chains.\n\nThis partnership offers significant advantages: accredited research publications, funded student internships and field missions, and validated real-world impact metrics, without requiring your department to manage grassroots field operations.\n\nWould you have 20 minutes for a brief introductory call this week to review the concept?\n\nWarm regards,\nRocío Cruz / Executive Leadership Team\n${orgDisplayName}`,
          `Estimada Dirección de Investigación Aplicada e Innovación:\n\nLe escribo en nombre de ${orgDisplayName}. Identificamos una oportunidad estratégica inmediata en la convocatoria "${input.title}" financiada por ${funderDisplay}.\n\nProponemos conformar un consorcio en el que su institución sea el solicitante principal postsecundario y ${orgName} el co-solicitante técnico que lidere la implementación en campo del Whole Chain Integrity Standard (WCIS) para trazabilidad, equidad de género y resiliencia climática en cadenas de valor agroalimentarias.\n\nEsta alianza ofrece ventajas importantes: publicaciones de investigación acreditadas, pasantías y misiones de campo financiadas para estudiantes, y métricas de impacto validadas en terreno, sin que su departamento tenga que gestionar operaciones de campo.\n\n¿Tendría 20 minutos esta semana para una breve llamada de presentación del concepto?\n\nSaludos cordiales,\nRocío Cruz / Equipo de Dirección Ejecutiva\n${orgDisplayName}`,
        ),
      },
      {
        id: "territorial-partner",
        targetAudience: "territorial",
        title: t(
          "Territorial Partner Outreach (SOCODEVI / Cooperative)",
          "Contacto con socio territorial (SOCODEVI / cooperativa)",
        ),
        subject: t(
          `Strategic Funding Partnership Opportunity: ${input.title}`,
          `Oportunidad de alianza estratégica de financiamiento: ${input.title}`,
        ),
        body: t(
          `Dear Leadership Team,\n\n${orgName} is reaching out to explore joining forces for the newly open opportunity "${input.title}" offered by ${funderDisplay}.\n\nWe envision a collaborative consortium where the local producer organization maintains territorial leadership and community ownership, complemented by ${orgName}'s technical support through the WCIS framework for digital traceability, institutional strengthening, and value-added market access.\n\nThe project budget includes direct dedicated allocations to compensate local staff hours, host community training workshops, and cover field operational expenses.\n\nWe would welcome the opportunity to coordinate a brief working session to review the draft concept note and align roles.\n\nBest regards,\nRocío Cruz / Project Strategy Direction\n${orgDisplayName}`,
          `Estimado equipo directivo:\n\n${orgName} se comunica con ustedes para explorar una alianza en la oportunidad recién abierta "${input.title}" ofrecida por ${funderDisplay}.\n\nImaginamos un consorcio colaborativo en el que la organización de productores local mantenga el liderazgo territorial y la apropiación comunitaria, complementado por el apoyo técnico de ${orgName} mediante el marco WCIS para trazabilidad digital, fortalecimiento institucional y acceso a mercados de valor agregado.\n\nEl presupuesto del proyecto incluye asignaciones directas para compensar las horas del personal local, realizar talleres de capacitación comunitaria y cubrir gastos operativos de campo.\n\nNos encantaría coordinar una breve sesión de trabajo para revisar el borrador de la nota conceptual y alinear roles.\n\nSaludos cordiales,\nRocío Cruz / Dirección de Estrategia de Proyectos\n${orgDisplayName}`,
        ),
      },
      {
        id: "program-officer",
        targetAudience: "funder_officer",
        title: t("Program Officer Pre-Application Inquiry", "Consulta previa al Program Officer"),
        subject: t(
          `Concept Scope Alignment Inquiry: ${input.title}`,
          `Consulta de alineación del alcance del concepto: ${input.title}`,
        ),
        body: t(
          `Dear Program Officer,\n\nI am writing on behalf of ${orgDisplayName}, dedicated to applied sustainability, value chain integrity, and socio-economic empowerment.\n\nWe are preparing a concept note for "${input.title}" focusing on empowering women producers and cooperatives through the Whole Chain Integrity Standard (WCIS) for climate resilience and verifiable traceability.\n\nWe would appreciate confirming whether an initiative combining Canadian technical leadership with Latin American cooperative partners aligns fully with your current funding priorities for this cycle.\n\nWe would be grateful for the opportunity to share a 2-page concept overview for brief feedback.\n\nBest regards,\nExecutive Direction / Strategic Partnerships\n${orgDisplayName}`,
          `Estimado/a Program Officer:\n\nLe escribo en nombre de ${orgDisplayName}, organización dedicada a la sostenibilidad aplicada, la integridad de las cadenas de valor y el empoderamiento socioeconómico.\n\nEstamos preparando una nota conceptual para "${input.title}" centrada en empoderar a productoras y cooperativas mediante el Whole Chain Integrity Standard (WCIS) para la resiliencia climática y la trazabilidad verificable.\n\nAgradeceríamos confirmar si una iniciativa que combina liderazgo técnico canadiense con cooperativas socias de América Latina se alinea plenamente con sus prioridades de financiamiento para este ciclo.\n\nNos complacería compartir un resumen conceptual de 2 páginas para recibir sus comentarios.\n\nSaludos cordiales,\nDirección Ejecutiva / Alianzas Estratégicas\n${orgDisplayName}`,
        ),
      },
    ],
  };

  return {
    routes,
    financial,
    strategicReturn,
    outreach,
    recommendedRouteId,
  };
}
