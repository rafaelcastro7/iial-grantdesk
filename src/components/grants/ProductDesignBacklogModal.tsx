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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grantId?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultCategory?: "consorcio_rutas" | "fuentes_latam" | "contrapartida_fondos" | "filtros_busqueda" | "ui_ux" | "moneda_region" | "otro";
  onSuccess?: () => void;
};

const CATEGORIES = [
  { id: "consorcio_rutas", label: "Consorcios y Rutas" },
  { id: "fuentes_latam", label: "Fuentes de Toda América" },
  { id: "contrapartida_fondos", label: "Contrapartida / In-Kind" },
  { id: "filtros_busqueda", label: "Filtros y Búsqueda" },
  { id: "ui_ux", label: "Experiencia UI / UX" },
  { id: "moneda_region", label: "Moneda y Región" },
  { id: "otro", label: "Otra mejora" },
] as const;

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
      setError("Por favor completa el título y la descripción de la mejora.");
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
      setError(err instanceof Error ? err.message : "Error al registrar la sugerencia.");
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
                Registrar Solicitud en el Backlog de Diseño
              </DialogTitle>
              <DialogDescription className="text-xs">
                Captura una necesidad, caso de uso no cubierto o mejora requerida para el roadmap de GrantDesk.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-semibold">¡Sugerencia registrada con éxito!</h4>
            <p className="text-xs text-muted-foreground">
              Se ha agregado al backlog del sistema para priorización del equipo.
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
                Título de la mejora o necesidad
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ej. Comparar dos rutas de consorcio para un mismo grant"
                className="text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Categoría
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant={category === cat.id ? "default" : "outline"}
                    className="cursor-pointer text-xs py-1 px-2.5 transition-all"
                    onClick={() => setCategory(cat.id)}
                  >
                    {cat.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Descripción detallada del caso y resultado esperado
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explica qué problema operativo encontraste, por qué es necesario y cómo debería funcionar la solución en GrantDesk..."
                rows={4}
                className="text-sm leading-relaxed"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nivel de impacto para la postulación
              </label>
              <div className="flex gap-2">
                {(["alto", "medio", "bajo"] as const).map((lvl) => (
                  <Button
                    key={lvl}
                    type="button"
                    size="sm"
                    variant={impact === lvl ? "secondary" : "ghost"}
                    className={`capitalize text-xs ${impact === lvl ? "border font-bold" : ""}`}
                    onClick={() => setImpact(lvl)}
                  >
                    Impacto {lvl}
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
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Guardar en Backlog</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
