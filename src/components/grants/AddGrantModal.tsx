import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Loader2, Plus, Sparkles } from "lucide-react";
import { addGrantByUrl } from "@/lib/grants.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTr } from "@/lib/ui-lang";

export function AddGrantModal({ triggerBtn }: { triggerBtn?: React.ReactNode }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addGrantFn = useServerFn(addGrantByUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await addGrantFn({ data: { url: url.trim() } });
      await queryClient.invalidateQueries({ queryKey: ["grants"] });
      setOpen(false);
      setUrl("");
      // Navigate to detail page where auto-enrichment and evaluation run live
      navigate({
        to: "/grants/$id",
        params: { id: res.grantId },
        search: res.isNew ? { analyze: "1" } : {},
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : tr("Failed to add grant by URL.", "No se pudo agregar el grant por URL."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerBtn || (
          <Button size="sm" className="gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            <span>{tr("Add grant by URL", "Agregar grant por URL")}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-primary" />
              {tr("Analyze External Grant", "Analizar grant externo")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {tr(
                "Paste the URL of any grant or funding program call. GrantDesk will fetch, extract eligibility requirements, and evaluate fit for your organization.",
                "Pega la URL de cualquier grant o convocatoria de financiamiento. GrantDesk la descargará, extraerá los requisitos de elegibilidad y evaluará el encaje con tu organización.",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="grant-url-input" className="text-xs font-medium text-foreground">
                {tr("Grant Page URL", "URL de la página del grant")}
              </label>
              <div className="relative flex items-center">
                <Link2 className="absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="grant-url-input"
                  type="url"
                  placeholder="https://www.canada.ca/en/services/business/grants.html"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-9 text-sm"
                  disabled={loading}
                  required
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <p className="rounded border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {tr("Cancel", "Cancelar")}
            </Button>
            <Button type="submit" disabled={loading || !url.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tr("Analyzing...", "Analizando...")}
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {tr("Add & Analyze", "Agregar y analizar")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
