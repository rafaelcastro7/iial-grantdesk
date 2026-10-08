import { useState } from "react";
import { Lightbulb, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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
import { submitProductDesignBacklogItem } from "@/lib/grant-copilot.functions";
import { useActiveTenant } from "@/lib/tenant-context";
import { useTr, useUiLang } from "@/lib/ui-lang";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grantId?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultCategory?:
    | "consorcio_rutas"
    | "fuentes_latam"
    | "contrapartida_fondos"
    | "filtros_busqueda"
    | "ui_ux"
    | "moneda_region"
    | "otro";
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

export function ProductDesignBacklogModal({
  open,
  onOpenChange,
  grantId,
  defaultTitle = "",
  defaultDescription = "",
  defaultCategory = "consorcio_rutas",
  onSuccess,
}: Props) {
  const { activeOrgId } = useActiveTenant();
  const tr = useTr();
  const lang = useUiLang();
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [category, setCategory] = useState<typeof defaultCategory>(defaultCategory);
  const [impact, setImpact] = useState<"alto" | "medio" | "bajo">("medio");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError(
        tr(
          "Please provide both a title and description for this request.",
          "Indica un título y una descripción para esta solicitud.",
        ),
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitProductDesignBacklogItem({
        data: {
          title: title.trim(),
          description: description.trim(),
          category,
          impact,
          grantId,
          orgId: activeOrgId ?? undefined,
        },
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
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

        {success ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-semibold">
              {tr("Request recorded successfully!", "¡Solicitud registrada con éxito!")}
            </h4>
            <p className="text-xs text-muted-foreground">
              {tr(
                "Added to the system product backlog for team prioritization.",
                "Agregada al backlog del producto para que el equipo la priorice.",
              )}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr("Enhancement or Need Title", "Título de la mejora o necesidad")}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tr(
                  "e.g. Compare two consortium routes for the same opportunity",
                  "p. ej., Comparar dos rutas de consorcio para la misma oportunidad",
                )}
                className="text-sm"
                required
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
                    onClick={() => setCategory(cat.id)}
                  >
                    {lang === "es" ? CATEGORY_ES[cat.id] : cat.label}
                  </Badge>
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
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tr(
                  "Explain the operational challenge encountered, why it matters, and how GrantDesk should resolve it...",
                  "Explica el desafío operativo encontrado, por qué importa y cómo debería resolverlo GrantDesk...",
                )}
                rows={4}
                className="text-sm leading-relaxed"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tr("Priority Impact Level", "Nivel de impacto")}
              </label>
              <div className="flex gap-2">
                {[
                  { id: "alto", label: tr("High Impact", "Impacto alto") },
                  { id: "medio", label: tr("Medium Impact", "Impacto medio") },
                  { id: "bajo", label: tr("Low Impact", "Impacto bajo") },
                ].map((lvl) => (
                  <Button
                    key={lvl.id}
                    type="button"
                    size="sm"
                    variant={impact === lvl.id ? "secondary" : "ghost"}
                    className={`capitalize text-xs ${impact === lvl.id ? "border font-bold" : ""}`}
                    onClick={() => setImpact(lvl.id as "alto" | "medio" | "bajo")}
                  >
                    {lvl.label}
                  </Button>
                ))}
              </div>
            </div>

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
              <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>{tr("Save to Backlog", "Guardar en el backlog")}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
