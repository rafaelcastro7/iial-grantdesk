// One opportunity found on the internet: the essentials in one row, the rest
// on demand. "Interested" imports it, opens it and lets the agents research
// and verify it, so nothing has to be completed by hand.
import { useState } from "react";
import { CheckCircle2, ChevronDown, Copy, ExternalLink, Loader2, Sparkles } from "lucide-react";
import type { DiscoveredWebGrant } from "@/lib/grant-web-scout.functions";
import { Button } from "@/components/ui/button";
import { decisionMakerLabel, useTeamSettings } from "@/lib/team-settings";
import { useActiveTenant } from "@/lib/tenant-context";
import { useTr, useUiLang } from "@/lib/ui-lang";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  upcoming: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  continuous: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

export function WebResultRow({
  grant,
  orgName,
  importedId,
  busy,
  onInterested,
}: {
  grant: DiscoveredWebGrant;
  orgName: string;
  importedId?: string | null;
  busy: boolean;
  onInterested: (grant: DiscoveredWebGrant) => void;
}) {
  const tr = useTr();
  const lang = useUiLang();
  const { activeOrgId } = useActiveTenant();
  const { settings: team } = useTeamSettings(activeOrgId);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const status =
    grant.status === "open"
      ? tr("Open", "Abierta")
      : grant.status === "upcoming"
        ? tr("Upcoming", "Por abrir")
        : grant.status === "continuous"
          ? tr("Continuous", "Continua")
          : tr("Closed", "Cerrada");
  const why = grant.applicant_fit || grant.summary;

  const copyBrief = async () => {
    const hi = team.decisionMaker ? ` ${team.decisionMaker}` : "";
    const brief =
      lang === "es"
        ? `Asunto: Oportunidad: ${grant.title} (${grant.funder})\n\nHola${hi},\n\nEncontré esta oportunidad para ${orgName}:\n- Programa: ${grant.title}\n- Financiador: ${grant.funder} (${grant.country})\n- Monto (por verificar): ${grant.amount_range}\n- Fecha límite (por verificar): ${grant.deadline} (${status})\n- Por qué encaja: ${why}\n- Enlace oficial: ${grant.url}\n\n¿La priorizamos?\n\nSaludos,\n${team.sender}`
        : `Subject: Opportunity: ${grant.title} (${grant.funder})\n\nHi${hi},\n\nI found this opportunity for ${orgName}:\n- Program: ${grant.title}\n- Funder: ${grant.funder} (${grant.country})\n- Amount (to verify): ${grant.amount_range}\n- Deadline (to verify): ${grant.deadline} (${status})\n- Why it fits: ${why}\n- Official link: ${grant.url}\n\nShall we prioritize it?\n\nBest,\n${team.sender}`;
    try {
      await navigator.clipboard.writeText(brief.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <li className="py-3">
      <div className="grid gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1fr)_7rem_9rem_auto] md:items-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 items-start gap-1.5 text-left"
        >
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
          <span className="min-w-0">
            <span className="block font-medium text-foreground">{grant.title}</span>
            <span className="block text-xs text-muted-foreground">
              {[grant.funder, grant.country, grant.applicant].filter(Boolean).join(" · ")}
            </span>
          </span>
        </button>
        <span className="pl-6 text-xs md:pl-0">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              STATUS_TONE[grant.status] ?? "bg-muted text-muted-foreground",
            )}
          >
            {status}
          </span>
        </span>
        <span className="pl-6 text-xs text-muted-foreground md:pl-0">
          <span className="block text-foreground">{grant.deadline}</span>
          {grant.amount_range}
        </span>
        <div className="flex items-center gap-1.5 pl-6 md:pl-0">
          <Button
            size="sm"
            variant={importedId ? "outline" : "default"}
            className="h-8 gap-1.5"
            disabled={busy}
            onClick={() => onInterested(grant)}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : importedId ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {importedId ? tr("Open", "Abrir") : tr("Interested", "Nos interesa")}
          </Button>
          <a
            href={grant.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            title={tr("Official page", "Página oficial")}
            aria-label={tr("Official page", "Página oficial")}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-2 pl-6 text-sm">
          {grant.summary && <p className="text-muted-foreground">{grant.summary}</p>}
          {grant.applicant_fit && (
            <p>
              <strong>{tr(`Why it fits ${orgName}: `, `Por qué encaja con ${orgName}: `)}</strong>
              {grant.applicant_fit}
            </p>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={copyBrief}
          >
            {copied ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied
              ? tr("Copied", "Copiado")
              : tr(
                  `Copy a note for ${decisionMakerLabel(team, lang)}`,
                  `Copiar nota para ${decisionMakerLabel(team, lang)}`,
                )}
          </Button>
        </div>
      )}
    </li>
  );
}
