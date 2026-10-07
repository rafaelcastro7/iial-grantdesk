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
  "meeting_invite",
  "meeting_follow_up",
  "deadline_reminder",
  "portal_registration",
  "package_request",
  "program_officer",
  "whatsapp_intro",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export type Lang = "en" | "es";

export const TEMPLATE_LABEL: Record<TemplateId, { en: string; es: string; audience: string }> = {
  partner_intro: { en: "Partner invitation", es: "Invitación a socio", audience: "Partner" },
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
  portal_registration: {
    en: "Funder portal registration",
    es: "Registro en el portal del financiador",
    audience: "Funder",
  },
  package_request: {
    en: "Request the application package",
    es: "Solicitar el paquete de aplicación",
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
    case "partner_intro":
      subject =
        lang === "en"
          ? `Collaboration opportunity: ${grant.title}`
          : `Oportunidad de colaboración: ${grant.title}`;
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
