import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { searchWebGrants, type DiscoveredWebGrant } from "@/lib/grant-web-scout.functions";
import { addGrantByUrl } from "@/lib/grants.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useActiveTenant } from "@/lib/tenant-context";

const QUICK_PROMPTS = [
  {
    label: "🌾 Canada Agri-Food 2026",
    query: "Canada agriculture and food innovation grant calls 2026 sustainable food distribution",
  },
  {
    label: "🍫 Cacao & Bioeconomy (Peru/LATAM)",
    query: "Convocatorias y grants de cacao, bioeconomia y agricultura sostenible en Peru o Latinoamerica 2026",
  },
  {
    label: "🎓 Canadian Academic Consortium",
    query: "Canadian college research partnership grants SSHRC agri-food applied research 2026",
  },
  {
    label: "🌍 GAC & International Rolling Calls",
    query: "Global Affairs Canada international assistance unsolicited concept notes CFLI Peru 2026",
  },
];

export function WebGrantScoutModal({ triggerBtn }: { triggerBtn?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoveredWebGrant[]>([]);
  const [importingUrls, setImportingUrls] = useState<Set<string>>(new Set());
  const [importedMap, setImportedMap] = useState<Map<string, string>>(new Map());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { activeTenant, activeOrgId } = useActiveTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const searchFn = useServerFn(searchWebGrants);
  const addGrantFn = useServerFn(addGrantByUrl);

  const searchMutation = useMutation({
    mutationFn: async (text: string) => {
      setErrorMessage(null);
      const res = await searchFn({
        data: {
          query: text.trim(),
          orgId: activeOrgId ?? undefined,
        },
      });
      if (!res.ok) {
        throw new Error(res.error || "Web search could not retrieve grant results.");
      }
      return res.grants;
    },
    onSuccess: (data) => {
      setResults(data);
      // Pre-populate already existing grants
      const existing = new Map<string, string>();
      for (const g of data) {
        if (g.alreadyInCatalog && g.existingGrantId) {
          existing.set(g.url, g.existingGrantId);
        }
      }
      setImportedMap(existing);
    },
    onError: (err: unknown) => {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || searchMutation.isPending) return;
    searchMutation.mutate(query);
  };

  const handleQuickPrompt = (promptQuery: string) => {
    setQuery(promptQuery);
    searchMutation.mutate(promptQuery);
  };

  const handleImportGrant = async (grant: DiscoveredWebGrant) => {
    setImportingUrls((prev) => new Set(prev).add(grant.url));
    try {
      const res = await addGrantFn({ data: { url: grant.url } });
      await queryClient.invalidateQueries({ queryKey: ["grants"] });
      setImportedMap((prev) => new Map(prev).set(grant.url, res.grantId));
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : `Failed to import "${grant.title}" to Radar.`,
      );
    } finally {
      setImportingUrls((prev) => {
        const next = new Set(prev);
        next.delete(grant.url);
        return next;
      });
    }
  };

  const orgLabel = activeTenant?.legal_name || "IIAL";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerBtn || (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary shadow-sm"
          >
            <Globe className="h-4 w-4 text-primary" />
            <span className="font-medium">AI Web Scout</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Web Grant Scout
            </DialogTitle>
            <Badge variant="secondary" className="text-xs">
              Client: {orgLabel}
            </Badge>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Search Google and funder portals in real-time for live or upcoming grant calls, then
            import opportunities with 1 click directly into your Radar and Pipeline.
          </DialogDescription>
        </DialogHeader>

        {/* Search input form */}
        <form onSubmit={handleSearchSubmit} className="my-3 space-y-3">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Ask anything, e.g. 'Canada agriculture and food innovation calls 2026' or 'Peru cacao grants'..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-24 text-sm"
              disabled={searchMutation.isPending}
              autoFocus
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-1.5 h-7 gap-1 px-3 text-xs"
              disabled={searchMutation.isPending || !query.trim()}
            >
              {searchMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Scouting...
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  Search
                </>
              )}
            </Button>
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">Quick queries:</span>
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleQuickPrompt(p.query)}
                disabled={searchMutation.isPending}
                className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </form>

        {/* Error message banner */}
        {errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">{errorMessage}</p>
          </div>
        )}

        {/* Loading state indicator */}
        {searchMutation.isPending && (
          <div className="my-8 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Browsing the live web via Google Search...
              </p>
              <p className="text-xs text-muted-foreground">
                Identifying authoritative funder press releases, RFP calls, deadlines, and amounts.
              </p>
            </div>
          </div>
        )}

        {/* Results display */}
        {!searchMutation.isPending && results.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b pb-2 text-xs text-muted-foreground">
              <span>Found {results.length} funding opportunities on the web</span>
              <span>Sorted by relevance to {orgLabel}</span>
            </div>

            <div className="space-y-3">
              {results.map((grant) => {
                const isImporting = importingUrls.has(grant.url);
                const importedId = importedMap.get(grant.url);

                return (
                  <div
                    key={grant.url}
                    className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition hover:border-border hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">
                            {grant.title}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {grant.country}
                          </Badge>
                          <Badge
                            variant={
                              grant.status === "open"
                                ? "default"
                                : grant.status === "upcoming"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[10px] capitalize"
                          >
                            {grant.status}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-primary/80">{grant.funder}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {importedId ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 gap-1 px-2.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                            onClick={() => {
                              setOpen(false);
                              navigate({ to: "/grants/$id", params: { id: importedId } });
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            In Radar (View)
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 gap-1 px-2.5 text-xs shadow-sm"
                            disabled={isImporting}
                            onClick={() => handleImportGrant(grant)}
                          >
                            {isImporting ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Importing...
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5" />
                                Import to Radar
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {grant.summary}
                    </p>

                    {/* Metadata indicators */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 text-foreground/80 font-medium">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{grant.amount_range}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Deadline: {grant.deadline}</span>
                      </div>
                      <a
                        href={grant.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-1 text-primary hover:underline ml-auto"
                      >
                        <span>Official page</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    {/* Organization fit highlight */}
                    {grant.applicant_fit && (
                      <div className="rounded bg-muted/60 px-3 py-2 text-xs text-foreground/90">
                        <strong className="text-foreground">Why it fits {orgLabel}: </strong>
                        <span>{grant.applicant_fit}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
