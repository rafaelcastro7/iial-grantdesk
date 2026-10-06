// SOP Stage 4: Grant Strategic Roadmap & Consortium Delivery Model.
// Formulated from the actual working methodology of Rocío Cruz & ChatGPT
// for IIAL (WCIS, Cocoa, Lambton, SOCODEVI, GAC, SSHRC, FIMI).

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

  // 1. Consortium Routes Matrix
  let directViability: "high" | "conditional" | "blocked" = "conditional";
  let directViabilityLabel = "Conditional on Legal & Financial Track Record";
  let directKeyBarrier = "Requires validating organizational fiduciary capacity and federal Canadian registration.";
  let directTacticalValue = `${orgName} retains 100% of project governance, intellectual direction, and budget allocation.`;

  if (isIndigenousFunder) {
    directViability = "blocked";
    directViabilityLabel = "Blocked Directly (Indigenous/Territorial Lead Required)";
    directKeyBarrier = "The fund explicitly mandates grassroots community or Indigenous women leadership.";
    directTacticalValue = "Not viable as sole lead applicant; must enter as technical delivery partner via Route C.";
  } else if (isSSHRC || isNSERC) {
    directViability = "blocked";
    directViabilityLabel = "Blocked Directly (Requires Eligible Tri-Council Lead)";
    directKeyBarrier = "Grant funds are exclusively administered by recognized Canadian postsecondary research institutions.";
    directTacticalValue = "Unlocked by applying through Lambton College or a partner university (Route B).";
  } else if (isGAC) {
    directViability = "high";
    directViabilityLabel = "High (Unsolicited Concept Note)";
    directKeyBarrier = "Requires Canadian CRA registration number and 2 years of financial statements (signed internal statements accepted).";
    directTacticalValue = "Allows submitting an initiative continuously without waiting for a scheduled thematic call.";
  } else if (isSTDF) {
    directViability = "conditional";
    directViabilityLabel = "Conditional on Beneficiary Country Partner";
    directKeyBarrier = "Must address official Sanitary and Phytosanitary (SPS) barriers in implementation country (e.g. cocoa in Peru/Costa Rica).";
    directTacticalValue = "Viable when co-formulated with local research institutes (CITA/UCR) or technical ministries.";
  }

  // Route B: Academic Consortium
  let academicViability: "high" | "conditional" | "blocked" = "high";
  let academicViabilityLabel = "High (Recommended R&D Route)";
  let academicBarrier = "Finalize institutional overhead terms, IP sharing, and dedicated budget allocation for IIAL.";
  let academicTacticalValue = `Lambton College or university manages the award; ${orgName} leads technical implementation utilizing the WCIS framework.`;
  let academicPartner = "Lambton College / Seneca Polytechnic / University of Costa Rica";
  if (isFedDev) {
    academicViability = "conditional";
    academicViabilityLabel = "Moderate (Commercial SME Focus Preferred)";
    academicBarrier = "FedDev prioritizes direct commercial impact and job growth in Southern Ontario SMEs.";
  }

  // Route C: Latin America Territorial Consortium
  let territorialViability: "high" | "conditional" | "blocked" = "high";
  let territorialViabilityLabel = "High (For Value Chain & Producer Impact)";
  let territorialBarrier = "Coordinate letters of commitment, governance MOU, and community validation.";
  let territorialTacticalValue = `Local cooperative / producer association leads with statutory legitimacy; SOCODEVI provides fiduciary governance; ${orgName} implements traceability, digitalization, and WCIS certification.`;
  let territorialPartner = "SOCODEVI / APP CACAO / Indigenous Women Producers Network";
  if (isFedDev) {
    territorialViability = "blocked";
    territorialViabilityLabel = "Geographically Ineligible";
    territorialBarrier = "Fund strictly restricted to Southern Ontario (Canada) geographic footprint.";
  }

  // Route D: Commercial / Impact Enterprise Consortium
  let commercialViability: "high" | "conditional" | "blocked" = isFedDev ? "high" : "conditional";
  let commercialViabilityLabel = isFedDev ? "High (Ontario SME Focus)" : "Conditional on Private Match";
  let commercialBarrier = "Requires confirmed private co-funding (cash/in-kind) and commercial viability justification.";
  let commercialTacticalValue = `Private impact enterprise (e.g. Nahua Canada) leads commercial scale-up of sustainable cocoa/food products; ${orgName} provides WCIS certification and impact verification.`;
  let commercialPartner = "Nahua Canada / Southern Ontario Agrifood SMEs";

  const routes: ConsortiumRoute[] = [
    {
      id: "direct",
      title: "Route A: Direct Lead Application",
      leadEntity: `${orgName} (Sole Lead Applicant)`,
      iialRole: "Lead applicant and sole fiduciary administrator of the project",
      partnerRequirement: "Optional (letters of support from end beneficiaries recommended)",
      viability: directViability,
      viabilityLabel: directViabilityLabel,
      keyBarrier: directKeyBarrier,
      tacticalValue: directTacticalValue,
      recommendedPartner: "N/A (Autonomous)",
      nextStep: "Verify portal registration with the funder and assemble institutional Concept Note.",
    },
    {
      id: "academic",
      title: "Route B: Academic / R&D Consortium",
      leadEntity: "Eligible Canadian Postsecondary Institution (e.g. Lambton College)",
      iialRole: "Non-academic technical co-applicant (delivering methodology, traceability, and WCIS framework)",
      partnerRequirement: "Mandatory (Independent principal investigator and accredited college/university)",
      viability: academicViability,
      viabilityLabel: academicViabilityLabel,
      keyBarrier: academicBarrier,
      tacticalValue: academicTacticalValue,
      recommendedPartner: academicPartner,
      nextStep: "Schedule alignment session with Lambton College Applied Research Office to draft Letter of Intent.",
    },
    {
      id: "territorial",
      title: "Route C: LATAM Territorial Consortium",
      leadEntity: "Territorial Organization / Local Cooperative (e.g. Indigenous Base or APP CACAO)",
      iialRole: "International technical partner (traceability, WCIS certification, climate and gender impact measurement)",
      partnerRequirement: "Mandatory (Fiduciary NGO e.g. SOCODEVI + local women-led producer cooperative)",
      viability: territorialViability,
      viabilityLabel: territorialViabilityLabel,
      keyBarrier: territorialBarrier,
      tacticalValue: territorialTacticalValue,
      recommendedPartner: territorialPartner,
      nextStep: "Finalize project scope with SOCODEVI and local cooperative leadership in Peru/Costa Rica/Colombia.",
    },
    {
      id: "commercial",
      title: "Route D: Enterprise / Commercial Innovation",
      leadEntity: "Impact Enterprise or Commercial SME (e.g. Nahua Canada)",
      iialRole: "Applied research and sustainability standard design partner (WCIS)",
      partnerRequirement: "Mandatory (Commercial agrifood enterprise with co-funding capacity)",
      viability: commercialViability,
      viabilityLabel: commercialViabilityLabel,
      keyBarrier: commercialBarrier,
      tacticalValue: commercialTacticalValue,
      recommendedPartner: commercialPartner,
      nextStep: "Execute co-investment MOU and supply chain commercial rollout plan.",
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
  const auditLevel = isSSHRC || isNSERC
    ? {
        type: "audited_external" as const,
        label: "External Audit Required (3 Years)",
        allowsInternalSigned: false,
        status: "warn" as const,
        detail: "Direct fiduciary management requires 3 years of audited financial statements. Overcome by applying via Lambton College as administrative lead (Route B).",
      }
    : isGAC
      ? {
          type: "internal_signed_cpa" as const,
          label: "Accepts Signed Internal Financial Statements",
          allowsInternalSigned: true,
          status: "pass" as const,
          detail: "Global Affairs Canada accepts signed financial statements for the past 2 fiscal years from the legal representative / internal CPA. Lack of external audit does not disqualify IIAL.",
        }
      : {
          type: "notice_to_reader" as const,
          label: "Formal Financial Statements",
          allowsInternalSigned: true,
          status: "pass" as const,
          detail: "Submit balance sheet and income statements for the last two operating fiscal years.",
        };

  const costSharePct = input.costSharePct ?? (isSSHRC && /connection/i.test(title) ? 50 : isFedDev ? 50 : isNSERC ? 25 : 0);
  const allowsInKind = isSSHRC || isGAC || isSTDF || costSharePct > 0;
  const matchingFunds = {
    percentage: costSharePct,
    inKindAllowed: allowsInKind,
    cashRequired: isNSERC || (/mitacs/i.test(text) ? true : false),
    inKindCapPct: allowsInKind ? 50 : null,
    label: costSharePct > 0 ? `${costSharePct}% Matching Contribution` : "100% Non-Repayable (No Matching Required)",
    detail: costSharePct > 0
      ? (allowsInKind
          ? "Permits covering matching contribution through eligible in-kind support: researcher hours, methodologies, and WCIS platform tools."
          : "Requires verifiable cash contributions deposited into a dedicated project bank account.")
      : "The grant covers 100% of eligible project activities without requiring cost-sharing or co-investment.",
  };

  const canadianLegal = {
    requiresCraCharity: /charity|charitable status|bienfaisance/i.test(text),
    requiresNpoFederal: true,
    craNumberSufficient: isGAC || /business number|cra/i.test(text),
    label: isGAC ? "Canadian Entity CRA Business Number" : "Federal Non-Profit or Postsecondary Entity",
    detail: isGAC
      ? "Requires recognized Canadian legal status and active Canada Revenue Agency (CRA) Business Number."
      : "Must maintain federal or provincial non-profit corporate incorporation in good standing.",
  };

  const isRolling = /rolling|continu|unsolicited/i.test(`${input.deadlineKind ?? ""} ${title} ${summary}`);
  const disbursementTimeline = {
    intakeMode: isRolling ? ("rolling" as const) : input.deadline ? ("fixed" as const) : ("unknown" as const),
    initialResponseTime: isGAC ? "~2 months (Concept Note assessment)" : isFID ? "~12 months to first disbursement" : "~3 to 4 months post-deadline",
    disbursementLag: isFID ? "12 months" : "2 to 3 months post contribution agreement",
    detail: isRolling
      ? "Rolling window open continuously throughout the year. Evaluates a concept note first, then invites full proposal."
      : input.deadline
        ? `Fixed competitive intake cycle closing on ${input.deadline}.`
        : "Periodic annual competitive call governed by funder calendar.",
  };

  const financial: FinancialConditions = {
    auditLevel,
    matchingFunds,
    canadianLegal,
    disbursementTimeline,
  };

  // 3. Strategic Value Return & Revenue Model for IIAL
  const strategicReturn: StrategicReturn = {
    opexCoverage: {
      salariesAndFees: `Full technical fees and management compensation for ${orgName} core personnel (researchers, agronomists, and supply chain specialists).`,
      travelAndFieldwork: "Direct financing for international field missions, cooperative site visits, and community participatory work.",
      communityWorkshops: "Logistical expenses, workshop venues, materials, and facilitation for local stakeholder consultation sessions.",
      managementAdmin: "Eligible administrative overhead, software licenses, impact monitoring systems, and fiduciary reporting.",
    },
    wcisAssetCreation: {
      standardFocus: "Whole Chain Integrity Standard (WCIS): Comprehensive standard for traceability, climate governance, and gender equity across agricultural value chains.",
      useCaseValidation: "Rigorous field piloting and proof-of-concept of the WCIS framework in operating cocoa and coffee supply chains with partner cooperatives.",
      fieldTesting: "Quantitative verification of smallholder household income gains, post-harvest loss reduction, and women producer economic autonomy.",
    },
    futureRevenueLines: [
      {
        line: "WCIS Maturity Diagnostics",
        targetClient: "Agrifood export enterprises, agricultural cooperatives, and development agencies",
        model: "Initial integrity audit and supply chain traceability readiness assessment",
        priceRange: "CAD $8,000 – $20,000 per assessment",
        examples: "Corporate supply chain due diligence benchmark against EUDR and ESG compliance standards.",
      },
      {
        line: "Professional Certifications (CSIP, CSCIP, CARP)",
        targetClient: "Individual professionals, ESG auditors, supply chain consultants, and agronomists",
        model: "Modular enrollment fee, certification examination, and annual credential renewal",
        priceRange: "CAD $300/module · CAD $1,120 full designation",
        examples: "CSIP-A in applied sustainability and CSCIP in supply chain integrity and traceability.",
      },
      {
        line: "Live Cohorts & Corporate Training Programs",
        targetClient: "Producer federations, commodity boards, corporate agrifood buyers",
        model: "Custom institutional cohorts delivered live with IIAL subject matter experts",
        priceRange: "CAD $5,000 – $15,000 per institutional cohort",
        examples: "Closed corporate masterclass on ethical data governance and verified origin tracking.",
      },
      {
        line: "University Partnerships with Tuition Share",
        targetClient: "Canadian and Latin American universities and polytechnics",
        model: "Joint micro-credentials and executive diplomas with revenue sharing",
        priceRange: "30% – 50% tuition share per enrolled student",
        examples: "Joint executive credential with Lambton College or UCR on regenerative agricultural standards.",
      },
    ],
  };

  // 4. Outreach Action Kit
  const funderDisplay = input.funderName || "the funding agency";
  const outreach: OutreachKit = {
    immediateSteps: [
      isSSHRC || isNSERC
        ? "1. Contact the Lambton College Applied Research & Innovation Office to confirm interest as postsecondary lead applicant."
        : isGAC
          ? "1. Access Partners@International portal to verify IIAL CRA business number and upload signed financial statements."
          : "1. Download official applicant guides to verify strategic alignment with published thematic priority areas.",
      "2. Draft a 2-page project Concept Note highlighting the innovative WCIS methodology.",
      "3. Request formal Letters of Intent from territorial partners (SOCODEVI, producer cooperatives, research centers).",
      "4. Schedule a 15-minute alignment call with the Program Officer to validate project scope prior to formal submission.",
    ],
    templates: [
      {
        id: "academic_outreach",
        targetAudience: "academic",
        title: "Academic Partner Outreach (Lambton College)",
        subject: `Applied Research Consortium Proposal: ${input.title} / WCIS Framework`,
        body: `Dear Director of Applied Research & Innovation,\n\nI am reaching out on behalf of the Institute of Innovation and Advanced Learning (IIAL). We have identified an immediate strategic opportunity in the call "${input.title}" funded by ${funderDisplay}.\n\nWe propose structuring a joint consortium where your institution serves as the postsecondary lead applicant, while IIAL serves as the technical delivery co-applicant leading field implementation of the Whole Chain Integrity Standard (WCIS) for traceability, gender equity, and climate resilience in agrifood value chains.\n\nThis partnership offers significant advantages: accredited research publications, funded student internships and field missions, and validated real-world impact metrics, without requiring your department to manage grassroots field operations.\n\nWould you have 20 minutes for a brief introductory call this week to review the concept?\n\nWarm regards,\nRocío Cruz / Executive Leadership Team\nInstitute of Innovation and Advanced Learning (IIAL)`,
      },
      {
        id: "territorial_outreach",
        targetAudience: "territorial",
        title: "Territorial Partner Outreach (SOCODEVI / Cooperative)",
        subject: `Strategic Funding Partnership Opportunity: ${input.title}`,
        body: `Dear Leadership Team,\n\nIIAL is reaching out to explore joining forces for the newly open opportunity "${input.title}" offered by ${funderDisplay}.\n\nWe envision a collaborative consortium where the local producer organization maintains territorial leadership and community ownership, complemented by IIAL's technical support through the WCIS framework for digital traceability, institutional strengthening, and value-added market access.\n\nThe project budget includes direct dedicated allocations to compensate local staff hours, host community training workshops, and cover field operational expenses.\n\nWe would welcome the opportunity to coordinate a brief working session to review the draft concept note and align roles.\n\nBest regards,\nRocío Cruz / Project Strategy Direction\nInstitute of Innovation and Advanced Learning (IIAL)`,
      },
      {
        id: "funder_inquiry",
        targetAudience: "funder_officer",
        title: "Program Officer Pre-Application Inquiry",
        subject: `Concept Scope Alignment Inquiry: ${input.title}`,
        body: `Dear Program Officer,\n\nI am writing on behalf of the Institute of Innovation and Advanced Learning (IIAL), a Canadian institute dedicated to applied sustainability, value chain integrity, and socio-economic empowerment.\n\nWe are preparing a concept note for "${input.title}" focusing on empowering women producers and cooperatives through the Whole Chain Integrity Standard (WCIS) for climate resilience and verifiable traceability.\n\nWe would appreciate confirming whether an initiative combining Canadian technical leadership with Latin American cooperative partners aligns fully with your current funding priorities for this cycle.\n\nWe would be grateful for the opportunity to share a 2-page concept overview for brief feedback.\n\nBest regards,\nExecutive Direction / Strategic Partnerships\nInstitute of Innovation and Advanced Learning (IIAL)`,
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
