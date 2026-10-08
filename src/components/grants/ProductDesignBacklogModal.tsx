import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Send, AlertCircle, Loader2, ChevronDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { submitProductDesignBacklogItem } from "@/lib/grant-copilot.functions";
import { useActiveTenant } from "@/lib/tenant-context";
import { useTr, useUiLang } from "@/lib/ui-lang";
import {
  TOPIC_LABEL,
  autofillBacklog,
  type BacklogCategory,
  type BacklogContext,
  type BacklogImpact,
} from "@/lib/backlog-autofill.shared";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grantId?: string;
  /** Optional: skips the grant lookup when the caller already knows the title. */
  grantTitle?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultCategory?: BacklogCategory;
  onSuccess?: () => void;
};

const CATEGORIES = [
  { id: "consorcio_rutas", label: "Consortia & Routes" },
  { id: "fuentes_latam", label: "Americas & International Sources" },
  { id: "contrapartida_fondos", label: "Matching Funds & In-Kind" },
  { id: "filtros_busqueda", label: "Search & Filters" },
  { id: "ui_ux", label: "UI / UX Experience" },
  { id: "moneda_region", label: "Currency & Region" },
  { id: "otro", label: "Other Enhancement" },
] as const;

const CATEGORY_ES: Record<string, string> = {
  consorcio_rutas: "Consorcios y rutas",
  fuentes_latam: "Fuentes de las Américas e internacionales",
  contrapartida_fondos: "Contrapartida y aportes en especie",
  filtros_busqueda: "Búsqueda y filtros",
  ui_ux: "Experiencia UI / UX",
  moneda_region: "Moneda y región",
  otro: "Otra mejora",
};

type Touched = { title: boolean; description: boolean; category: boolean; impact: boolean };
const UNTOUCHED: Touched = { title: false, description: false, category: false, impact: false };

export function ProductDesignBacklogModal({
  open,
  onOpenChange,
  grantId,
  grantTitle,
  defaultTitle = "",
  defaultDescription = "",
  defaultCategory,
  onSuccess,
}: Props) {
  const { activeOrgId, activeOrganization } = useActiveTenant();
  const tr = useTr();
  const lang = useUiLang();

  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<BacklogCategory>(defaultCategory ?? "otro");
  const [impact, setImpact] = useState<BacklogImpact>("medio");
  const [touched, setTouched] = useState<Touched>(UNTOUCHED);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState("");
  const [openedAt, setOpenedAt] = useState(() => new Date().toISOString());
  const [grantInfo, setGrantInfo] = useState<{ title?: string; funder?: string }>({});

  // Fetch the grant title/funder once per grant (RLS-scoped browser read; 0 tokens).
  useEffect(() => {
    if (!open || !grantId) {
      if (!grantId) setGrantInfo({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("grants")
          .select("title, funder:funders(name)")
          .eq("id", grantId)
          .maybeSingle();
        if (cancelled || !data) return;
        const row = data as { title?: string | null; funder?: { name?: string | null } | null };
        setGrantInfo({ title: row.title ?? undefined, funder: row.funder?.name ?? undefined });
      } catch {
        // Context is best effort; the request can still be sent.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, grantId]);

  const context: BacklogContext = useMemo(
    () => ({
      grantId: grantId ?? null,
      grantTitle: grantTitle || grantInfo.title || null,
      funderName: grantInfo.funder ?? null,
      page: page || null,
      orgName: activeOrganization?.name ?? null,
      date: openedAt,
      lang,
    }),
    [grantId, grantTitle, grantInfo, page, activeOrganization?.name, openedAt, lang],
  );

  const prefill = useMemo(
    () => ({
      title: defaultTitle || undefined,
      description: defaultDescription || undefined,
      category: defaultCategory,
    }),
    [defaultTitle, defaultDescription, defaultCategory],
  );

  // Reset to a freshly autofilled draft every time the modal opens.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setText(defaultDescription || defaultTitle || "");
      setTouched(UNTOUCHED);
      setDetailsOpen(false);
      setError(null);
      setOpenedAt(new Date().toISOString());
      setPage(typeof window !== "undefined" ? window.location.pathname : "");
    }
    wasOpen.current = open;
  }, [open, defaultDescription, defaultTitle]);

  const draft = useMemo(() => autofillBacklog(text, context, prefill), [text, context, prefill]);

  // Keep untouched fields in sync with the free text and context.
  useEffect(() => {
    if (!touched.title) setTitle(draft.title);
    if (!touched.description) setDescription(draft.description);
    if (!touched.category) setCategory(draft.category);
    if (!touched.impact) setImpact(draft.impact);
  }, [draft, touched]);

  const canSend = text.trim().length > 0 && title.trim().length >= 3 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim().slice(0, 200);
    const finalDescription = description.trim().slice(0, 4000);
    if (!text.trim() || finalTitle.length < 3 || finalDescription.length < 10) {
      setError(
        tr(
          "Tell us briefly what is missing or should work differently.",
          "Cuéntanos brevemente qué falta o qué debería funcionar distinto.",
        ),
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitProductDesignBacklogItem({
        data: {
          title: finalTitle,
          description: finalDescription,
          category,
          impact,
          grantId,
          orgId: activeOrgId ?? undefined,
        },
      });
      toast.success(tr("Request recorded successfully!", "¡Solicitud registrada con éxito!"), {
        description: tr(
          "Added to the product backlog for team prioritization.",
          "Agregada al backlog del producto para que el equipo la priorice.",
        ),
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tr("Error saving backlog request.", "Error al guardar la solicitud en el backlog."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const topicLabel = lang === "es" ? TOPIC_LABEL[draft.topic].es : TOPIC_LABEL[draft.topic].en;
  const categoryLabel = (id: string) =>
    lang === "es" ? CATEGORY_ES[id] : (CATEGORIES.find((c) => c.id === id)?.label ?? id);
  const impactOptions: Array<{ id: BacklogImpact; label: string }> = [
    { id: "alto", label: tr("High Impact", "Impacto alto") },
    { id: "medio", label: tr("Medium Impact", "Impacto medio") },
    { id: "bajo", label: tr("Low Impact", "Impacto bajo") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {tr(
                  "Log Request in Product Design Backlog",
                  "Registrar solicitud en el backlog de diseño de producto",
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {tr(
                  "Record an operational requirement, unaddressed consortium scenario, or feature request for the GrantDesk roadmap.",
                  "Registra un requisito operativo, un escenario de consorcio no cubierto o una solicitud de funcionalidad para la hoja de ruta de GrantDesk.",
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="backlog-free-text" className="text-sm font-semibold text-foreground">
              {tr(
                "What is missing or should work differently?",
                "¿Qué falta o debería funcionar distinto?",
              )}
            </label>
            <Textarea
              id="backlog-free-text"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={tr(
                "e.g. Compare two consortium routes for the same opportunity",
                "p. ej., Comparar dos rutas de consorcio para la misma oportunidad",
              )}
              rows={3}
              className="text-sm leading-relaxed"
            />
            {title && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-medium text-foreground truncate max-w-[16rem]">{title}</span>
                <Badge variant="outline" className="text-[10px] py-0">
                  {topicLabel}
                </Badge>
                <Badge variant="outline" className="text-[10px] py-0">
                  {impactOptions.find((o) => o.id === impact)?.label}
                </Badge>
                {context.grantTitle && (
                  <span className="truncate max-w-[12rem]">· {context.grantTitle}</span>
                )}
              </div>
            )}
          </div>

          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                />
                {tr("Details", "Detalles")}
                <span className="normal-case font-normal tracking-normal">
                  · {categoryLabel(category)}
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr("Enhancement or Need Title", "Título de la mejora o necesidad")}
                </label>
                <Input
                  value={title}
                  onChange={(e) => {
                    setTouched((t) => ({ ...t, title: true }));
                    setTitle(e.target.value);
                  }}
                  maxLength={200}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr("Category", "Categoría")}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant={category === cat.id ? "default" : "outline"}
                      className="cursor-pointer text-xs py-1 px-2.5 transition-all"
                      onClick={() => {
                        setTouched((t) => ({ ...t, category: true }));
                        setCategory(cat.id);
                      }}
                    >
                      {categoryLabel(cat.id)}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr("Priority Impact Level", "Nivel de impacto")}
                </label>
                <div className="flex gap-2">
                  {impactOptions.map((lvl) => (
                    <Button
                      key={lvl.id}
                      type="button"
                      size="sm"
                      variant={impact === lvl.id ? "secondary" : "ghost"}
                      className={`capitalize text-xs ${impact === lvl.id ? "border font-bold" : ""}`}
                      onClick={() => {
                        setTouched((t) => ({ ...t, impact: true }));
                        setImpact(lvl.id);
                      }}
                    >
                      {lvl.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr(
                    "Detailed Description & Expected Outcome",
                    "Descripción detallada y resultado esperado",
                  )}
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => {
                    setTouched((t) => ({ ...t, description: true }));
                    setDescription(e.target.value);
                  }}
                  maxLength={4000}
                  rows={6}
                  className="text-xs font-mono leading-relaxed"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {tr("Cancel", "Cancelar")}
            </Button>
            <Button type="submit" size="sm" disabled={!canSend} className="gap-1.5">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{tr("Send", "Enviar")}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
