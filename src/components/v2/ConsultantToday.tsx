// "Today" for the consultant: deadlines, overdue steps, missing documents,
// partners waiting and pending decisions, built from the application plans.
// Replaces the generic hero on Home. Deterministic, no AI.
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarClock,
  FileWarning,
  Mail,
  Radar,
  Scale,
  Search,
  Users,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { todayAgenda, type AgendaItem } from "@/lib/consultant-desk.shared";
import { listGrantWorkspaces } from "@/lib/grant-workspace.functions";
import { useActiveTenant } from "@/lib/tenant-context";
import { cn } from "@/lib/utils";
import { useTr, useUiLang } from "@/lib/ui-lang";

const ICON: Record<AgendaItem["kind"], ComponentType<{ className?: string }>> = {
  deadline: CalendarClock,
  milestone: CalendarClock,
  missing: FileWarning,
  partner: Users,
  decision: Scale,
};

export function ConsultantToday({ greeting }: { greeting: string }) {
  const tr = useTr();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  // Search first: in the system and on the internet (Find grants runs both).
  const search = () => {
    const text = q.trim();
    if (!text) return;
    try {
      const key = "grants.radar.filters.v1";
      const prev = JSON.parse(window.sessionStorage.getItem(key) ?? "{}");
      window.sessionStorage.setItem(key, JSON.stringify({ ...prev, search: text }));
      if (!/^https?:\/\//i.test(text)) window.sessionStorage.setItem("grants.autoWeb", text);
    } catch {
      /* storage unavailable: Find grants still opens */
    }
    void navigate({ to: "/grants" });
  };
  const lang = useUiLang();
  const { activeOrgId, activeOrgName } = useActiveTenant();
  const fetchRows = useServerFn(listGrantWorkspaces);
  const { data, isLoading } = useQuery({
    queryKey: ["grant-pipeline", activeOrgId],
    queryFn: () => fetchRows({ data: { orgId: activeOrgId as string } }),
    enabled: !!activeOrgId,
  });
  const agenda = data ? todayAgenda(data.rows, undefined, undefined, lang) : [];
  const today = new Date().toISOString().slice(0, 10);
  const working = data?.rows.filter((r) => r.workspace.priority !== "discard").length ?? 0;

  return (
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_320px]">
        <div className="p-5 sm:p-6">
          <form
            className="relative mb-5"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={tr("Search grants", "Buscar grants")}
              placeholder={tr(
                "Search grants in the system and on the internet: name, funder, topic or a link",
                "Buscar grants en el sistema y en internet: nombre, financiador, tema o un enlace",
              )}
              className="h-12 pl-10 pr-28 text-base"
            />
            <Button type="submit" className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2">
              {tr("Search", "Buscar")}
            </Button>
          </form>
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{greeting}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeOrgName ? `${activeOrgName} · ` : ""}
            {tr(
              `${working} grant${working === 1 ? "" : "s"} in the pipeline. This is what needs you in the next 3 weeks.`,
              `${working} grant${working === 1 ? "" : "s"} en el pipeline. Esto es lo que requiere su atención en las próximas 3 semanas.`,
            )}
          </p>
          <div className="mt-4">
            {isLoading && (
              <p className="text-sm text-muted-foreground">{tr("Loading…", "Cargando…")}</p>
            )}
            {data && agenda.length === 0 && (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {tr(
                  "Nothing pending. Find new opportunities in the Grant radar and save an Application plan to track them here.",
                  "Nada pendiente. Encuentre nuevas oportunidades en el Radar de grants y guarde un Plan de postulación para darles seguimiento aquí.",
                )}
              </p>
            )}
            {agenda.length > 0 && (
              <ul className="divide-y rounded-md border" aria-label={tr("Today", "Hoy")}>
                {agenda.slice(0, 10).map((a, i) => {
                  const Icon = ICON[a.kind];
                  const overdue = a.date != null && a.date < today;
                  return (
                    <li key={`${a.grantId}-${a.kind}-${i}`}>
                      <Link
                        to="/grants/$id"
                        params={{ id: a.grantId }}
                        className="flex items-start gap-3 px-3 py-2.5 text-sm hover:bg-accent/50"
                      >
                        {overdue ? (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        ) : (
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className={cn("font-medium", overdue && "text-destructive")}>
                            {a.text}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {a.grantTitle}
                          </span>
                        </span>
                        {a.date && (
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {a.date}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {agenda.length > 10 && (
              <Link
                to="/pipeline"
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                {tr(
                  `${agenda.length - 10} more in the Pipeline`,
                  `${agenda.length - 10} más en el Pipeline`,
                )}
              </Link>
            )}
          </div>
        </div>
        <aside className="space-y-2 border-t bg-muted/35 p-5 lg:border-l lg:border-t-0">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">
            {tr("Quick actions", "Acciones rápidas")}
          </div>
          <Button asChild className="w-full justify-start gap-2">
            <Link to="/grants">
              <Radar className="h-4 w-4" /> {tr("Find grants", "Buscar grants")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start gap-2">
            <Link to="/pipeline">
              <Mail className="h-4 w-4" />{" "}
              {tr("Email Marcelo about our grants", "Escribir a Marcelo sobre nuestros grants")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start gap-2">
            <Link to="/partners">
              <Users className="h-4 w-4" /> {tr("Partners and contacts", "Socios y contactos")}
            </Link>
          </Button>
        </aside>
      </div>
    </section>
  );
}
