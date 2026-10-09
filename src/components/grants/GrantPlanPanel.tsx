// The working plan, folded under the decision. It is only offered when the
// decision makes it useful: not before the grant is researched, not when no
// role is possible (unless a plan was already started). One line says where
// it stands; the plan itself opens on demand.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ClipboardList } from "lucide-react";
import { useState } from "react";
import { GrantApplicationWorkspace } from "@/components/grants/GrantApplicationWorkspace";
import { getGrantDossier } from "@/lib/grant-dossier.functions";
import type { DossierFit } from "@/lib/grant-dossier.shared";
import { getGrantWorkspace } from "@/lib/grant-workspace.functions";
import { useTr, useUiLang } from "@/lib/ui-lang";
import { cn } from "@/lib/utils";

export function GrantPlanPanel({ grantId, orgId }: { grantId: string; orgId: string }) {
  const tr = useTr();
  const lang = useUiLang();
  const [open, setOpen] = useState(false);
  // Same queries (and cache) as the dossier and the plan: no extra requests.
  const fetchDossier = useServerFn(getGrantDossier);
  const { data: dossier } = useQuery({
    queryKey: ["grant-dossier", grantId, orgId, lang],
    queryFn: () => fetchDossier({ data: { grantId, orgId, lang } }),
  });
  const fetchWs = useServerFn(getGrantWorkspace);
  const { data: plan } = useQuery({
    queryKey: ["grant-workspace", grantId, orgId, lang],
    queryFn: () => fetchWs({ data: { grantId, orgId, lang } }),
  });
  if (!dossier || !plan) return null;

  const fit = (dossier.saved?.dossier as { fit?: DossierFit } | undefined)?.fit;
  const started = !!plan.saved;
  // Nothing to plan yet (not researched) or nothing to plan at all (no role).
  if (!started && (!fit || fit === "not_eligible")) return null;

  const list = plan.workspace?.checklist ?? [];
  const ready = list.filter((c) => c.status === "have").length;
  const status = started
    ? tr(
        `${ready} of ${list.length} documents ready`,
        `${ready} de ${list.length} documentos listos`,
      )
    : fit === "next_cycle"
      ? tr(
          "Prepare it for the next cycle, with the decision's documents and dates",
          "Prepárelo para el próximo ciclo, con los documentos y fechas de la decisión",
        )
      : tr(
          "Starts with the documents and dates from the decision",
          "Empieza con los documentos y fechas de la decisión",
        );

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-semibold">{tr("Our working plan", "Nuestro plan de trabajo")}</span>
          <span className="truncate text-sm text-muted-foreground">· {status}</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {/* Kept mounted while folded, so unsaved edits are never lost. */}
      <div className={cn("border-t p-3 sm:p-4", !open && "hidden")}>
        <GrantApplicationWorkspace grantId={grantId} orgId={orgId} />
      </div>
    </section>
  );
}
