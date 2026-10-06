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
  { id: "consorcio_rutas", label: "Consortia & Routes" },
  { id: "fuentes_latam", label: "Americas & International Sources" },
  { id: "contrapartida_fondos", label: "Matching Funds & In-Kind" },
  { id: "filtros_busqueda", label: "Search & Filters" },
  { id: "ui_ux", label: "UI / UX Experience" },
  { id: "moneda_region", label: "Currency & Region" },
  { id: "otro", label: "Other Enhancement" },
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
      setError("Please provide both a title and description for this request.");
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
      setError(err instanceof Error ? err.message : "Error saving backlog request.");
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
                Log Request in Product Design Backlog
              </DialogTitle>
              <DialogDescription className="text-xs">
                Record an operational requirement, unaddressed consortium scenario, or feature request for the GrantDesk roadmap.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-semibold">Request recorded successfully!</h4>
            <p className="text-xs text-muted-foreground">
              Added to the system product backlog for team prioritization.
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
                Enhancement or Need Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Compare two consortium routes for the same opportunity"
                className="text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Category
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
                Detailed Description &amp; Expected Outcome
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the operational challenge encountered, why it matters, and how GrantDesk should resolve it..."
                rows={4}
                className="text-sm leading-relaxed"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Priority Impact Level
              </label>
              <div className="flex gap-2">
                {[
                  { id: "alto", label: "High Impact" },
                  { id: "medio", label: "Medium Impact" },
                  { id: "bajo", label: "Low Impact" },
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
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Save to Backlog</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
