// Outreach emails the team sends while working a grant, filled from the grant
// and its application plan. Deterministic (no AI, no cost). English or
// Spanish. Partner- and funder-facing templates never include internal
// blockers or weaknesses: they only use public facts and the plan's role,
// project idea and dates.
import { whatsappIntro } from "@/lib/consultant-desk.shared";
import {
  amountText,
  deadlineText,
  type Partner,
  type Workspace,
  type WorkspaceGrant,
} from "@/lib/grant-workspace.shared";

export const TEMPLATE_IDS = [
  "partner_intro",
  "academic_partnership",
  "meeting_invite",
  "meeting_follow_up",
  "deadline_reminder",
  "portal_registration",
  "package_request",
  "submission_step2",
  "program_officer",
  "whatsapp_intro",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export type Lang = "en" | "es";

export const TEMPLATE_LABEL: Record<TemplateId, { en: string; es: string; audience: string }> = {
  partner_intro: { en: "Partner invitation", es: "Invitación a socio", audience: "Partner" },
  academic_partnership: {
    en: "Academic partnership (applied research & WCIS)",
    es: "Alianza académica (investigación aplicada y WCIS)",
    audience: "Partner",
  },
  meeting_invite: {
    en: "Meeting invitation (proposed time)",
    es: "Invitación a reunión (hora propuesta)",
    audience: "Partner",
  },
  whatsapp_intro: {
    en: "WhatsApp: who we are",
    es: "WhatsApp: quiénes somos",
    audience: "Partner",
  },
  meeting_follow_up: {
    en: "Follow-up after a meeting",
    es: "Seguimiento tras reunión",
    audience: "Partner",
  },
  deadline_reminder: {
    en: "Deadline reminder / letter of support",
    es: "Recordatorio de plazo / carta de apoyo",
    audience: "Partner",
  },
  package_request: {
    en: "Step 1: Request application package / Register intent",
    es: "Paso 1: Solicitar paquete de aplicación / Registrar intención",
    audience: "Funder",
  },
  submission_step2: {
    en: "Step 2: Submit concept note & attestation package",
    es: "Paso 2: Presentar paquete de nota conceptual y atestación",
    audience: "Funder",
  },
  portal_registration: {
    en: "Funder portal registration",
    es: "Registro en el portal del financiador",
    audience: "Funder",
  },
  program_officer: {
    en: "Question to the program officer",
    es: "Consulta al oficial del programa",
    audience: "Funder",
  },
};

export type ComposeInput = {
  template: TemplateId;
  lang: Lang;
  grant: WorkspaceGrant;
  workspace: Workspace;
  orgName: string;
  senderName: string;
  senderTitle?: string;
  partner?: Partner | null;
  recipientName?: string;
  /** Proposed meeting, e.g. "Monday, June 1 at 11:00 (Peru time) on Teams". */
  meetingWhen?: string;
  /** Links shared in the WhatsApp introduction (presentation, website). */
  links?: string[];
  /** When true, includes Dr. Juan Marcelo Gómez's doctoral research reference and paper link. */
  includeAcademicCredentials?: boolean;
};

const ROLE_TEXT: Record<Lang, Record<string, string>> = {
  en: {
    lead: "lead applicant",
    co_lead: "co-applicant",
    partner: "partner organization",
    beneficiary: "beneficiary",
  },
  es: {
    lead: "aplicante principal",
    co_lead: "co-aplicante",
    partner: "organización socia",
    beneficiary: "beneficiario",
  },
};

function dateText(grant: WorkspaceGrant, ws: Workspace, lang: Lang): string {
  if (lang === "en") return deadlineText(grant, ws);
  if (!grant.deadline) return "sin fecha fija";
  const d = new Date(`${grant.deadline.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = [ws.deadline_time, ws.deadline_timezone].filter(Boolean).join(" ");
  return time ? `${d}, ${time}` : d;
}

function nextMilestone(ws: Workspace) {
  const today = new Date().toISOString().slice(0, 10);
  return ws.milestones.find((m) => !m.done && m.date >= today) ?? null;
}

/** Subject and body for one outreach email. Never includes ws.blockers. */
export function composeOutreach(input: ComposeInput): { subject: string; body: string } {
  const { grant, workspace: ws, lang, orgName, senderName } = input;
  const program = `"${grant.title}"`;
  const funder = grant.funder?.name ?? (lang === "en" ? "the funder" : "el financiador");
  const greetingName = input.recipientName?.trim() || input.partner?.name || "";
  const hi =
    lang === "en"
      ? `Dear ${greetingName || "colleague"},`
      : `Estimado/a ${greetingName || "colega"}:`;
  const signoff = [
    lang === "en" ? "Best regards," : "Saludos cordiales,",
    senderName,
    input.senderTitle,
    orgName,
  ]
    .filter(Boolean)
    .join("\n");
  const deadline = dateText(grant, ws, lang);
  const idea = ws.project_title?.trim();
  const wcis = ws.wcis_angle?.trim();
  const ourRole = ws.route ? ROLE_TEXT[lang][ws.route] : null;
  const partnerRole = input.partner?.role?.trim();
  const ms = nextMilestone(ws);
  let subject = "";
  let lines: string[] = [];

  switch (input.template) {
    case "whatsapp_intro":
      return {
        subject: "",
        body: whatsappIntro({
          lang,
          recipientName: input.recipientName,
          senderName,
          orgName,
          links: input.links,
          reason: idea
            ? lang === "en"
              ? `We are preparing a project ("${idea}") for ${program} and think your organization could be a great partner.`
              : `Estamos preparando un proyecto ("${idea}") para ${program} y creemos que su organización podría ser un gran socio.`
            : undefined,
        }),
      };
    case "meeting_invite": {
      const when =
        input.meetingWhen?.trim() ||
        (lang === "en" ? "[day and time, time zone]" : "[día y hora, zona horaria]");
      subject =
        lang === "en" ? `Meeting proposal: ${grant.title}` : `Propuesta de reunión: ${grant.title}`;
      lines =
        lang === "en"
          ? [
              hi,
              "",
              `I am writing on behalf of ${orgName} about ${program}${idea ? ` and the project "${idea}"` : ""}.`,
              `I have just sent you an invitation for a meeting on ${when}. It is only a proposal: please feel free to suggest another time if it suits you better; we are happy to adjust.`,
              `For reference, the deadline is ${deadline} and the funding available is ${amountText(grant)}.`,
              "",
              "Thank you, and I look forward to talking with you.",
              "",
              signoff,
            ]
          : [
              hi,
              "",
              `Le escribo en nombre de ${orgName} en relación con ${program}${idea ? ` y el proyecto "${idea}"` : ""}.`,
              `Le acabo de enviar una invitación para una reunión el ${when}. Es solo una propuesta: siéntase en libertad de sugerir otro horario si le acomoda mejor; con gusto nos ajustamos.`,
              `Como referencia, la fecha límite es ${deadline} y el monto disponible es ${amountText(grant)}.`,
              "",
              "Muchas gracias; quedo atenta a su respuesta.",
              "",
              signoff,
            ];
      break;
    }
    case "academic_partnership": {
      subject =
        lang === "en"
          ? `Academic collaboration & applied research: ${grant.title}`
          : `Colaboración académica e investigación aplicada: ${grant.title}`;
      const academicAngleEn =
        "The initiative builds on the doctoral research of Dr. Juan Marcelo Gómez at Henley Business School (University of Reading, UK) on sustainable value chains, producer livelihoods, traceability, and market governance (https://centaur.reading.ac.uk/115792/8/Gomez%2Band%2BMcKenzie%2B036.pdf).";
      const academicAngleEs =
        "La iniciativa se respalda en la investigación doctoral del Dr. Juan Marcelo Gómez en Henley Business School (Universidad de Reading, Reino Unido), enfocada en sostenibilidad en negocios internacionales, medios de vida de los productores, trazabilidad y gobernanza en cadenas de valor del cacao fino (https://centaur.reading.ac.uk/115792/8/Gomez%2Band%2BMcKenzie%2B036.pdf).";
      lines =
        lang === "en"
          ? [
              hi,
              "",
              `I am writing on behalf of ${orgName}. Following up on our recent conversation, we would like to explore structured collaboration on ${program}, funded by ${funder}.`,
              idea ? `Our project concept is "${idea}".` : "",
              wcis
                ? `Rather than conventional student exercises, ${orgName} anchors collaboration in the Whole-Chain International Standard (WCIS) and applied executive microcredentials (CSIP, CSCIP, CARP) to transfer measurable impact to agrifood value chains: ${wcis}`
                : `${orgName} brings established applied learning programs (CSIP, CSCIP, CARP) and the Whole-Chain International Standard (WCIS) to translate research into field impact with producers and cooperatives.`,
              academicAngleEn,
              partnerRole
                ? `We envision your institution as ${partnerRole}, focusing on scientific rigor and impact transfer, while leaving operational work packages open to co-design together.`
                : "We would welcome defining research questions and work packages together based on your academic priorities.",
              `The available funding is ${amountText(grant)} and the deadline is ${deadline}.`,
              "",
              "Could we schedule a 20-minute call this week to align on next steps?",
              "",
              signoff,
            ]
          : [
              hi,
              "",
              `Le escribo en nombre de ${orgName}. Dando seguimiento a nuestro contacto previo, quisiéramos explorar una colaboración estructurada en torno a ${program}, financiado por ${funder}.`,
              idea ? `El concepto de proyecto que proponemos es "${idea}".` : "",
              wcis
                ? `Más allá de proyectos capstone convencionales, ${orgName} estructura la colaboración con el Whole-Chain International Standard (WCIS) y sus programas profesionales aplicados (CSIP, CSCIP, CARP) para generar impacto verificable en cadenas agroalimentarias: ${wcis}`
                : `${orgName} aporta programas profesionales aplicados (CSIP, CSCIP, CARP) y el estándar Whole-Chain International Standard (WCIS) para vincular investigación con productores y cooperativas en territorio.`,
              academicAngleEs,
              partnerRole
                ? `Visualizamos a su institución como ${partnerRole}, aportando solidez científica y transferencia de conocimiento, manteniendo los roles abiertos a co-diseño conjunto.`
                : "Nos gustaría co-diseñar los paquetes de trabajo y las líneas de acción conjuntamente según sus prioridades académicas.",
              `El monto disponible es ${amountText(grant)} y la fecha límite es ${deadline}.`,
              "",
              "¿Tendría 20 minutos esta semana para coordinar los próximos pasos?",
              "",
              signoff,
            ];
      break;
    }
    case "partner_intro": {
      subject =
        lang === "en"
          ? `Collaboration opportunity: ${grant.title}`
          : `Oportunidad de colaboración: ${grant.title}`;
      const credEn = input.includeAcademicCredentials
        ? "The initiative builds on the doctoral research of Dr. Juan Marcelo Gómez at Henley Business School (University of Reading, UK) on sustainable value chains and traceability (https://centaur.reading.ac.uk/115792/8/Gomez%2Band%2BMcKenzie%2B036.pdf)."
        : "";
      const credEs = input.includeAcademicCredentials
        ? "El proyecto se apoya en la investigación doctoral del Dr. Juan Marcelo Gómez en Henley Business School (Universidad de Reading, Reino Unido) sobre cadenas de valor y trazabilidad (https://centaur.reading.ac.uk/115792/8/Gomez%2Band%2BMcKenzie%2B036.pdf)."
        : "";
      lines =
        lang === "en"
          ? [
              hi,
              "",
              `I am writing on behalf of ${orgName}. We are preparing an application to ${program}, funded by ${funder}, and we would like to explore whether your organization would join us.`,
              idea ? `The project we have in mind is "${idea}".` : "",
              wcis
                ? `${orgName} would contribute the Whole-Chain International Standard (WCIS) as the applied framework: ${wcis}`
                : "",
              credEn,
              partnerRole
                ? `We see your organization as ${partnerRole}, and we are open to shaping the roles together.`
                : "We would like to define the roles together, based on your priorities.",
              `The funding available is ${amountText(grant)} and the deadline is ${deadline}.`,
              "",
              "Would you have 20 minutes in the coming days for a short call?",
              "",
              signoff,
            ]
          : [
              hi,
              "",
              `Le escribo en nombre de ${orgName}. Estamos preparando una aplicación a ${program}, financiado por ${funder}, y nos gustaría explorar si su organización querría participar con nosotros.`,
              idea ? `El proyecto que proponemos es "${idea}".` : "",
              wcis
                ? `${orgName} aportaría el Whole-Chain International Standard (WCIS) como marco aplicado: ${wcis}`
                : "",
              credEs,
              partnerRole
                ? `Vemos a su organización como ${partnerRole}, y estamos abiertos a definir los roles juntos.`
                : "Nos gustaría definir los roles juntos, según sus prioridades.",
              `El monto disponible es ${amountText(grant)} y la fecha límite es ${deadline}.`,
              "",
              "¿Tendría 20 minutos en los próximos días para una breve llamada?",
              "",
              signoff,
            ];
      break;
    }
    case "meeting_follow_up":
      subject = lang === "en" ? `Follow-up: ${grant.title}` : `Seguimiento: ${grant.title}`;
      lines =
        lang === "en"
          ? [
              hi,
              "",
              `Thank you for your time today. It was a pleasure to talk about ${program}.`,
              "As agreed, these are the next steps:",
              ms
                ? `- ${ms.label}, by ${ms.date}`
                : "- Confirm your interest and the contact person for the application",
              "- Share any priorities or capacities you would like the proposal to reflect",
              `The application deadline is ${deadline}.`,
              "",
              "Please let me know if anything is missing.",
              "",
              signoff,
            ]
          : [
              hi,
              "",
              `Gracias por su tiempo hoy. Fue un gusto conversar sobre ${program}.`,
              "Como acordamos, estos son los próximos pasos:",
              ms
                ? `- ${ms.label}, antes del ${ms.date}`
                : "- Confirmar su interés y la persona de contacto para la aplicación",
              "- Compartir las prioridades o capacidades que quisieran ver reflejadas en la propuesta",
              `La fecha límite de la aplicación es ${deadline}.`,
              "",
              "Quedo atento/a por si falta algo.",
              "",
              signoff,
            ];
      break;
    case "deadline_reminder":
      subject =
        lang === "en"
          ? `Letter of support: ${grant.title} (deadline ${deadline})`
          : `Carta de apoyo: ${grant.title} (plazo ${deadline})`;
      lines =
        lang === "en"
          ? [
              hi,
              "",
              `A quick reminder about ${program}: the deadline is ${deadline}, so time is now short.`,
              "To complete the application we would need your letter of support (signed, on letterhead) describing your role in the project.",
              ms ? `It would help a lot to have it by ${ms.date}.` : "",
              "I am happy to send you a short draft to adapt if that is easier.",
              "",
              signoff,
            ]
          : [
              hi,
              "",
              `Un breve recordatorio sobre ${program}: la fecha límite es ${deadline}, por lo que el tiempo es ajustado.`,
              "Para completar la aplicación necesitaríamos su carta de apoyo (firmada, en papel membretado) describiendo su rol en el proyecto.",
              ms ? `Nos ayudaría mucho tenerla antes del ${ms.date}.` : "",
              "Con gusto le envío un borrador breve para adaptar, si le resulta más fácil.",
              "",
              signoff,
            ];
      break;
    case "portal_registration":
      subject =
        lang === "en" ? `Registration request — ${orgName}` : `Solicitud de registro — ${orgName}`;
      lines =
        lang === "en"
          ? [
              "Hello,",
              "",
              `${orgName} is exploring an application to ${program}. We would like to register our organization in your portal and would be grateful for guidance on the steps and documents required.`,
              "We can provide our proof of incorporation and business number.",
              "Please note that registering is part of our preparation; we have not yet submitted an application.",
              "",
              signoff,
            ]
          : [
              "Hola,",
              "",
              `${orgName} está explorando una aplicación a ${program}. Quisiéramos registrar a nuestra organización en su portal y agradeceríamos orientación sobre los pasos y documentos requeridos.`,
              "Podemos enviar nuestro certificado de constitución y número de empresa.",
              "El registro es parte de nuestra preparación; aún no hemos presentado una aplicación.",
              "",
              signoff,
            ];
      break;
    case "package_request":
      subject =
        lang === "en"
          ? `Request for application package — ${grant.title}`
          : `Solicitud del paquete de aplicación — ${grant.title}`;
      lines =
        lang === "en"
          ? [
              "Hello,",
              "",
              `On behalf of ${orgName}, I would like to request the application package for ${program}.`,
              ourRole ? `We intend to participate as ${ourRole}.` : "",
              idea ? `Our proposed project is "${idea}".` : "",
              "Thank you in advance for your help.",
              "",
              signoff,
            ]
          : [
              "Hola,",
              "",
              `En nombre de ${orgName}, quisiera solicitar el paquete de aplicación de ${program}.`,
              ourRole ? `Nuestra intención es participar como ${ourRole}.` : "",
              idea ? `El proyecto propuesto es "${idea}".` : "",
              "Muchas gracias de antemano por su ayuda.",
              "",
              signoff,
            ];
      break;
    case "submission_step2":
      subject =
        lang === "en"
          ? `Concept note submission — ${grant.title} (${orgName})`
          : `Presentación de nota conceptual — ${grant.title} (${orgName})`;
      lines =
        lang === "en"
          ? [
              "Dear Program Officer,",
              "",
              `On behalf of ${orgName}, please find enclosed our formal submission package for ${program}${idea ? `, project "${idea}"` : ""}.`,
              ourRole ? `We are submitting as ${ourRole}.` : "",
              "Our application package includes:",
              "1. Project concept note and operational summary",
              "2. Organization Attestation form signed by our authorized officer",
              "3. Proof of legal registration and CRA business documentation",
              "4. Comparative financial statements for the past two completed fiscal years",
              "",
              "We remain at your disposal should you require any additional information or clarifications.",
              "Kindly confirm receipt of this package.",
              "",
              signoff,
            ]
          : [
              "Estimado/a oficial del programa:",
              "",
              `En nombre de ${orgName}, le hago llegar nuestro paquete formal de postulación para ${program}${idea ? `, proyecto "${idea}"` : ""}.`,
              ourRole ? `Nos presentamos como ${ourRole}.` : "",
              "El paquete adjunto incluye:",
              "1. Nota conceptual y resumen operativo del proyecto",
              "2. Formulario de atestación organizacional firmado por el responsable autorizado",
              "3. Certificado de constitución y documentación de registro empresarial (CRA)",
              "4. Estados financieros comparativos de los dos últimos años fiscales cerrados",
              "",
              "Quedamos a su entera disposición ante cualquier consulta o requerimiento adicional.",
              "Agradeceremos confirmar la recepción de este paquete.",
              "",
              signoff,
            ];
      break;
    case "program_officer":
      subject =
        lang === "en"
          ? `Eligibility question — ${grant.title}`
          : `Consulta de elegibilidad — ${grant.title}`;
      lines =
        lang === "en"
          ? [
              hi,
              "",
              `${orgName} is preparing an application to ${program}${ourRole ? ` as ${ourRole}` : ""}.`,
              idea ? `The project would be "${idea}".` : "",
              "Before we invest more time, could you please confirm whether our organization and this project fit the current call priorities and eligibility?",
              "We would be glad to share a two-page concept overview if useful.",
              "",
              signoff,
            ]
          : [
              hi,
              "",
              `${orgName} está preparando una aplicación a ${program}${ourRole ? ` como ${ourRole}` : ""}.`,
              idea ? `El proyecto sería "${idea}".` : "",
              "Antes de avanzar, ¿podría confirmarnos si nuestra organización y este proyecto se ajustan a las prioridades y requisitos de elegibilidad de la convocatoria actual?",
              "Con gusto compartimos una nota conceptual de dos páginas si es útil.",
              "",
              signoff,
            ];
      break;
  }
  const body = lines
    .filter((l, i, all) => !(l === "" && all[i - 1] === ""))
    .filter((l) => l !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject, body };
}
