// SOP Stage 4: Grant Strategic Roadmap & Consortium Delivery Model.
// Formulated from the actual working methodology of Rocío Cruz & ChatGPT
// for IIAL (WCIS, Cacao, Lambton, SOCODEVI, GAC, SSHRC, FIMI).

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
 * working structure with ChatGPT.
 */
export function synthesizeGrantRoadmap(input: GrantRoadmapInput): GrantRoadmap {
  const funder = (input.funderName ?? "").toLowerCase();
  const title = (input.title ?? "").toLowerCase();
  const summary = (input.summary ?? "").toLowerCase();
  const text = `${funder} ${title} ${summary} ${input.eligibilityNote ?? ""}`;
  const orgName = input.orgName || "IIAL";

  const isGAC = /global affairs|affaires mondiales|international assistance|cfli|fcil/i.test(funder) || /unsolicited/i.test(title);
  const isSSHRC = /sshrc|crsh|social sciences and humanities/i.test(funder) || /partnership development|partnership engage|connection grant/i.test(title);
  const isNSERC = /nserc|crsng|natural sciences/i.test(funder) || /applied research and development|ard|ccsif/i.test(title);
  const isFedDev = /feddev|southern ontario|regional development/i.test(funder);
  const isSTDF = /stdf|standards and trade/i.test(funder);
  const isFID = /fund for innovation in development|fid/i.test(funder);
  const isIndigenousFunder = /fimi|ayni|indigenous|first nation|inuit|métis|autóctono/i.test(text);
  const isUniversityMandatory = isSSHRC || isNSERC || /postsecondary|university|college eligible/i.test(text);

  // 1. Matriz de Rutas de Consorcio
  let directViability: "high" | "conditional" | "blocked" = "conditional";
  let directViabilityLabel = "Condicionada a personería y finanzas";
  let directKeyBarrier = "Requiere validar capacidad fiduciaria y registro canadiense.";
  let directTacticalValue = `${orgName} retiene el 100% del control y del presupuesto del proyecto.`;

  if (isIndigenousFunder) {
    directViability = "blocked";
    directViabilityLabel = "Bloqueada para postulación directa";
    directKeyBarrier = "El fondo exige expresamente liderazgo de base comunitaria o mujeres indígenas.";
    directTacticalValue = "No viable como solicitante principal; debe entrar como socio técnico en Ruta C.";
  } else if (isSSHRC || isNSERC) {
    directViability = "blocked";
    directViabilityLabel = "Bloqueada directo (Requiere entidad elegible tri-council)";
    directKeyBarrier = "Fondos administrados únicamente por instituciones postsecundarias reconocidas.";
    directTacticalValue = "Se desbloquea postulando a través de Lambton College o universidad aliada (Ruta B).";
  } else if (isGAC) {
    directViability = "high";
    directViabilityLabel = "Alta (Nota Conceptual Espontánea)";
    directKeyBarrier = "Requiere número CRA de entidad canadiense y estados financieros de 2 años (internos firmados válidos).";
    directTacticalValue = "Permite presentar iniciativa continua sin esperar convocatoria temática abierta.";
  } else if (isSTDF) {
    directViability = "conditional";
    directViabilityLabel = "Condicionada a actor de país beneficiario";
    directKeyBarrier = "Debe abordar requisitos oficiales SPS en país de implementación (ej. cacao en Perú/Costa Rica).";
    directTacticalValue = "Viable formulando proyecto con CITA/UCR o ministerio técnico.";
  }

  // Ruta B: Consorcio Académico
  let academicViability: "high" | "conditional" | "blocked" = "high";
  let academicViabilityLabel = "Muy Alta (Ruta Recomendada I+D)";
  let academicBarrier = "Acordar términos de overhead, IP y porcentaje de asignación presupuestaria a IIAL.";
  let academicTacticalValue = `Lambton College o universidad postsecundaria administra el fondo; ${orgName} lidera como socio técnico con el framework WCIS.`;
  let academicPartner = "Lambton College / Seneca Polytechnic / UCR";
  if (isFedDev) {
    academicViability = "conditional";
    academicViabilityLabel = "Media (Preferencia empresarial)";
    academicBarrier = "FedDev prioriza impacto directo en PYMEs comerciales del sur de Ontario.";
  }

  // Ruta C: Consorcio Territorial LATAM
  let territorialViability: "high" | "conditional" | "blocked" = "high";
  let territorialViabilityLabel = "Alta (Para impacto en cadenas de valor)";
  let territorialBarrier = "Coordinación de cartas de apoyo, MoU de gobernanza y validación comunitaria.";
  let territorialTacticalValue = `Organización local / cooperativa lidera con legitimidad; SOCODEVI aporta gobernanza fiduciaria; ${orgName} implementa trazabilidad, digitalización y estándar WCIS.`;
  let territorialPartner = "SOCODEVI / APP CACAO / Red de Mujeres Indígenas";
  if (isFedDev) {
    territorialViability = "blocked";
    territorialViabilityLabel = "No elegible geográficamente";
    territorialBarrier = "Fondo limitado exclusivamente al sur de Ontario (Canadá).";
  }

  // Ruta D: Consorcio Comercial / Industrial
  let commercialViability: "high" | "conditional" | "blocked" = isFedDev ? "high" : "conditional";
  let commercialViabilityLabel = isFedDev ? "Alta (Foco Pymes Ontario)" : "Condicionada a cofinanciamiento";
  let commercialBarrier = "Exige cofinanciamiento privado (cash/in-kind) y justificar rentabilidad comercial.";
  let commercialTacticalValue = `Empresa privada (ej. Nahua Canada) lidera para escalamiento comercial de cacao/alimentos de impacto; ${orgName} certifica con WCIS.`;
  let commercialPartner = "Nahua Canada / PYMEs agroalimentarias de Ontario";

  const routes: ConsortiumRoute[] = [
    {
      id: "direct",
      title: "Ruta A: Postulación Directa",
      leadEntity: `${orgName} (Solicitante Principal Directo)`,
      iialRole: "Solicitante principal y administrador fiduciario del proyecto",
      partnerRequirement: "Opcional (cartas de apoyo de beneficiarios)",
      viability: directViability,
      viabilityLabel: directViabilityLabel,
      keyBarrier: directKeyBarrier,
      tacticalValue: directTacticalValue,
      recommendedPartner: "N/A (Autónomo)",
      nextStep: "Verificar registro en portal del funder y preparar Nota Conceptual institucional.",
    },
    {
      id: "academic",
      title: "Ruta B: Consorcio Académico / I+D",
      leadEntity: "Institución Postsecundaria Canadiense (ej. Lambton College)",
      iialRole: "Socio técnico no académico (desarrollo de metodología, trazabilidad y framework WCIS)",
      partnerRequirement: "Obligatorio (Investigador principal independiente y centro universitario)",
      viability: academicViability,
      viabilityLabel: academicViabilityLabel,
      keyBarrier: academicBarrier,
      tacticalValue: academicTacticalValue,
      recommendedPartner: academicPartner,
      nextStep: "Coordinar llamada con el decanato de investigación aplicada de Lambton College para firmar Letter of Intent.",
    },
    {
      id: "territorial",
      title: "Ruta C: Consorcio Territorial LATAM",
      leadEntity: "Organización Territorial / Cooperativa Local (ej. Base Indígena o APP CACAO)",
      iialRole: "Socio técnico internacional (trazabilidad, certificación WCIS, medición de impacto y género)",
      partnerRequirement: "Obligatorio (ONG fiduciaria ej. SOCODEVI + cooperativa de productoras)",
      viability: territorialViability,
      viabilityLabel: territorialViabilityLabel,
      keyBarrier: territorialBarrier,
      tacticalValue: territorialTacticalValue,
      recommendedPartner: territorialPartner,
      nextStep: "Acordar alcance con SOCODEVI y líderes locales de la cooperativa de cacao/café.",
    },
    {
      id: "commercial",
      title: "Ruta D: Consorcio Empresarial / Innovación",
      leadEntity: "Empresa de Impacto o PYME Comercial (ej. Nahua Canada)",
      iialRole: "Socio de investigación y diseño de estándar de sostenibilidad WCIS",
      partnerRequirement: "Obligatorio (Empresa comercial con capacidad de contrapartida)",
      viability: commercialViability,
      viabilityLabel: commercialViabilityLabel,
      keyBarrier: commercialBarrier,
      tacticalValue: commercialTacticalValue,
      recommendedPartner: commercialPartner,
      nextStep: "Formalizar acuerdo de coinversión y alcance de mercado para la cadena de suministro.",
    },
  ];

  // Determinar ruta recomendada
  let recommendedRouteId: RouteId = "academic";
  if (isGAC) recommendedRouteId = "direct";
  else if (isIndigenousFunder) recommendedRouteId = "territorial";
  else if (isFedDev) recommendedRouteId = "commercial";
  else if (isSSHRC || isNSERC) recommendedRouteId = "academic";
  else if (directViability === "high") recommendedRouteId = "direct";

  // 2. Condiciones Financieras Críticas (Auditoría, In-Kind, CRA)
  const auditLevel = isSSHRC || isNSERC
    ? {
        type: "audited_external" as const,
        label: "Auditoría Externa Requerida (3 Años)",
        allowsInternalSigned: false,
        status: "warn" as const,
        detail: "Para administrar fondos directos exige estados auditados por auditor independiente. Se resuelve postulando a través de Lambton College (Ruta B).",
      }
    : isGAC
      ? {
          type: "internal_signed_cpa" as const,
          label: "Acepta Estados Financieros Internos Firmados",
          allowsInternalSigned: true,
          status: "pass" as const,
          detail: "Global Affairs Canada acepta estados financieros de los últimos 2 años firmados por el representante legal / CPA interno. No tener auditoría externa no excluye a IIAL.",
        }
      : {
          type: "notice_to_reader" as const,
          label: "Estados Financieros Formales",
          allowsInternalSigned: true,
          status: "pass" as const,
          detail: "Presentar balances y estados de resultados de los dos últimos ejercicios contables.",
        };

  const costSharePct = input.costSharePct ?? (isSSHRC && /connection/i.test(title) ? 50 : isFedDev ? 50 : isNSERC ? 25 : 0);
  const allowsInKind = isSSHRC || isGAC || isSTDF || costSharePct > 0;
  const matchingFunds = {
    percentage: costSharePct,
    inKindAllowed: allowsInKind,
    cashRequired: isNSERC || (/mitacs/i.test(text) ? true : false),
    inKindCapPct: allowsInKind ? 50 : null,
    label: costSharePct > 0 ? `${costSharePct}% de Contrapartida` : "100% No Reembolsable (Sin contrapartida)",
    detail: costSharePct > 0
      ? (allowsInKind
          ? `Permite cubrir la contrapartida con aportes en especie (in-kind): horas de equipo de investigación, metodologías y plataforma WCIS.`
          : `Exige aporte en efectivo (cash match) bancario verificable.`)
      : "El fondo cubre el 100% de los costos elegibles del proyecto sin requerir fondos de contrapartida.",
  };

  const canadianLegal = {
    requiresCraCharity: /charity|charitable status|bienfaisance/i.test(text),
    requiresNpoFederal: true,
    craNumberSufficient: isGAC || /business number|cra/i.test(text),
    label: isGAC ? "Número CRA de Entidad Canadiense" : "Entidad Sin Fines de Lucro o Postsecundaria",
    detail: isGAC
      ? "Requiere personalidad jurídica canadiense y número de registro de Canada Revenue Agency (CRA)."
      : "Acreditación de registro federal de corporación sin fines de lucro en regla.",
  };

  const isRolling = /rolling|continu|unsolicited/i.test(`${input.deadlineKind ?? ""} ${title} ${summary}`);
  const disbursementTimeline = {
    intakeMode: isRolling ? ("rolling" as const) : input.deadline ? ("fixed" as const) : ("unknown" as const),
    initialResponseTime: isGAC ? "~2 meses (evaluación de Concept Note)" : isFID ? "~12 meses hasta desembolso" : "~3 a 4 meses tras cierre",
    disbursementLag: isFID ? "12 meses" : "2 a 3 meses post-acuerdo de contribución",
    detail: isRolling
      ? "Ventana de recepción abierta todo el año. Se presenta primero una nota conceptual y, al aprobarse, se invita a la propuesta completa."
      : input.deadline
        ? `Convocatoria de ciclo fijo con fecha de cierre ${input.deadline}.`
        : "Recepción periódica anual según calendario institucional.",
  };

  // 3. Retorno Estratégico y Líneas de Revenue para IIAL
  const strategicReturn: StrategicReturn = {
    opexCoverage: {
      salariesAndFees: `Cobertura de honorarios técnicos y coordinación de proyecto para el equipo de ${orgName} (investigadores, expertos en agroecología y trazabilidad).`,
      travelAndFieldwork: "Financiamiento de misiones a terreno, visitas a cooperativas de cacao/café y trabajo directo con productoras.",
      communityWorkshops: "Gastos logísticos, materiales y facilitación de talleres participativos y consultas con aliadas locales.",
      managementAdmin: "Costos de gestión administrativa, licencias de software, monitoreo de indicadores y reporte fiduciario.",
    },
    wcisAssetCreation: {
      standardFocus: "Whole Chain Integrity Standard (WCIS): Estándar integral de trazabilidad, gobernanza climática y equidad de género en cadenas de valor.",
      useCaseValidation: "Validación y prueba de concepto del framework WCIS en cadenas productivas reales de cacao y café con cooperativas socias.",
      fieldTesting: "Medición rigurosa de resultados sobre ingresos familiares, reducción de pérdidas de cosecha y autonomía económica de mujeres productoras.",
    },
    futureRevenueLines: [
      {
        line: "Diagnósticos de Madurez WCIS",
        targetClient: "Empresas exportadoras, cooperativas y organismos de desarrollo",
        model: "Auditoría inicial y evaluación de integridad de cadena de valor",
        priceRange: "CAD $8,000 – $20,000 por diagnóstico",
        examples: "Diagnóstico de debida diligencia de cadena de cacao ante normativas EUDR/ESG.",
      },
      {
        line: "Certificaciones Profesionales (CSIP, CSCIP, CARP)",
        targetClient: "Profesionales individuales, auditores, consultores ESG y agrónomos",
        model: "Inscripción por módulo, examen de certificación y renovación anual",
        priceRange: "CAD $300/módulo · CAD $1,120 programa completo",
        examples: "Certificación CSIP-A en sostenibilidad y CSCIP en integridad de suministros.",
      },
      {
        line: "Cohortes Live & Capacitaciones Corporativas",
        targetClient: "Gremios agrícolas, cooperativas, empresas agroalimentarias",
        model: "Programas en vivo cerrados o cohortes con facilitadores de IIAL",
        priceRange: "CAD $5,000 – $15,000 por cohorte institucional",
        examples: "Taller cerrado de gobernanza de datos y trazabilidad comunitaria.",
      },
      {
        line: "Alianzas Universitarias con Revenue Share",
        targetClient: "Colleges y Universidades canadienses y latinoamericanas",
        model: "Microcredenciales conjuntas y asignaturas con reparto de matrícula",
        priceRange: "30% – 50% de reparto de matrícula por estudiante",
        examples: "Diplomado conjunto con Lambton College o UCR sobre estándares regenerativos.",
      },
    ],
  };

  // 4. Outreach Kit
  const funderDisplay = input.funderName || "el organismo financiador";
  const outreach: OutreachKit = {
    immediateSteps: [
      isSSHRC || isNSERC
        ? "1. Contactar a la oficina de investigación aplicada de Lambton College para validar su interés como solicitante postsecundario."
        : isGAC
          ? "1. Acceder al portal Partners@International y verificar que el perfil de IIAL tenga número CRA y documentos contables cargados."
          : "1. Descargar las guías oficiales de postulación y verificar que las prioridades temáticas del proyecto coincidan con las bases.",
      "2. Redactar la Nota Conceptual (Concept Note) de 2 a 3 páginas con el hook metodológico de WCIS.",
      "3. Solicitar formalmente las cartas de interés / apoyo institucional a los aliados territoriales (SOCODEVI, cooperativas, investigadores).",
      "4. Agendar una sesión de 15 minutos con el Oficial de Programa (Program Officer) para consultar el alineamiento del concepto antes del envío formal.",
    ],
    templates: [
      {
        id: "academic_outreach",
        targetAudience: "academic",
        title: "Acercamiento a Socio Académico (Lambton College)",
        subject: `Propuesta de Consorcio de Investigación Aplicada: ${input.title} / Estándar WCIS`,
        body: `Estimado(a) Director(a) de Investigación Aplicada,\n\nLe escribo desde el Institute of Innovation and Advanced Learning (IIAL). Hemos identificado una oportunidad estratégica en la convocatoria "${input.title}" de ${funderDisplay}.\n\nProponemos estructurar una postulación conjunta donde su institución participe como solicitante principal postsecundario, e IIAL actúe como socio técnico liderando la implementación del framework WCIS (Whole Chain Integrity Standard) en trazabilidad, equidad de género y sostenibilidad en cadenas de valor agroalimentarias.\n\nEsta colaboración permitirá generar publicaciones de investigación aplicada, involucrar a estudiantes en pasantías de terreno y validar métricas de impacto real sin que su institución deba asumir la carga técnica de campo.\n\n¿Tendría disponibilidad para una breve llamada de 20 minutos esta semana para revisar los términos de la alianza?\n\nAtentamente,\nRocío Cruz / Equipo de Dirección Estratégica IIAL`,
      },
      {
        id: "territorial_outreach",
        targetAudience: "territorial",
        title: "Acercamiento a Socio Territorial (SOCODEVI / Cooperativa)",
        subject: `Alianza Estratégica para Fondos de Financiamiento: ${input.title}`,
        body: `Estimado equipo directivo,\n\nDesde IIAL nos ponemos en contacto para proponerles sumar esfuerzos de cara a la oportunidad "${input.title}" de ${funderDisplay}.\n\nEl objetivo es articular un consorcio donde la organización local mantenga el liderazgo territorial y la representatividad comunitaria, complementado con el soporte técnico y digital de IIAL a través del estándar WCIS para trazabilidad, fortalecimiento productivo y acceso a mercados internacionales con valor agregado.\n\nEl proyecto contempla presupuesto dedicado para remunerar las horas del equipo técnico local, facilitar talleres comunitarios y cubrir viáticos en terreno.\n\nNos encantaría coordinar una reunión de trabajo para revisar la nota conceptual preliminar y consensuar los roles del consorcio.\n\nSaludos cordiales,\nRocío Cruz / Dirección de Proyectos IIAL`,
      },
      {
        id: "funder_inquiry",
        targetAudience: "funder_officer",
        title: "Consulta Previa a Oficial de Programa",
        subject: `Inquiry on Project Concept Scope: ${input.title}`,
        body: `Dear Program Officer,\n\nI am writing on behalf of the Institute of Innovation and Advanced Learning (IIAL), a Canadian institute dedicated to applied sustainability, value chain integrity, and socio-economic empowerment.\n\nWe are preparing a concept note addressing "${input.title}" focusing on empowering women producers and cooperatives through the Whole Chain Integrity Standard (WCIS) for climate resilience and verifiable traceability.\n\nWe would appreciate confirming whether an initiative combining Canadian technical leadership with Latin American cooperative partners aligns fully with your current funding priorities for this cycle.\n\nWe would be grateful for the opportunity to briefly present a 2-page concept overview.\n\nBest regards,\nExecutive Direction / Strategic Partnerships\nInstitute of Innovation and Advanced Learning (IIAL)`,
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
