import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Lightbulb,
  Plus,
  Filter,
  Clock,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listProductDesignBacklog } from "@/lib/grant-copilot.functions";
import { useActiveTenant } from "@/lib/tenant-context";
import { ProductDesignBacklogModal } from "@/components/grants/ProductDesignBacklogModal";

export const Route = createFileRoute("/_authenticated/backlog")({
  component: ProductDesignBacklogPage,
});

type BacklogItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  impact: string;
  source: string;
  created_at: string;
  grant?: { id: string; title: string } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  consorcio_rutas: "Consorcios y Rutas",
  fuentes_latam: "Fuentes de Toda América",
  contrapartida_fondos: "Contrapartida / In-Kind",
  filtros_busqueda: "Filtros y Búsqueda",
  ui_ux: "Experiencia UI / UX",
  moneda_region: "Moneda y Región",
  otro: "General",
};

function ProductDesignBacklogPage() {
  const { activeOrgId, activeOrgName } = useActiveTenant();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["product-design-backlog", activeOrgId],
    queryFn: () => listProductDesignBacklog({ data: { orgId: activeOrgId ?? undefined } }),
  });

  const items: BacklogItem[] = (data?.items ?? []) as BacklogItem[];

  const filteredItems = items.filter((item: BacklogItem) => {
    if (selectedCategory === "all") return true;
    return item.category === selectedCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <Lightbulb className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Backlog de Diseño y Mejoras
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Casos de uso, necesidades de consorcio y solicitudes de producto capturadas para{" "}
                <strong className="text-foreground">{activeOrgName}</strong>.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={() => setModalOpen(true)} className="gap-2 font-semibold shadow-xs">
          <Plus className="h-4 w-4" />
          <span>Nueva Solicitud al Backlog</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Total Solicitudes
          </span>
          <span className="text-2xl font-bold text-foreground mt-1 block">{items.length}</span>
        </Card>
        <Card className="p-4 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Consorcios &amp; Rutas
          </span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {items.filter((i: BacklogItem) => i.category === "consorcio_rutas").length}
          </span>
        </Card>
        <Card className="p-4 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Fuentes América
          </span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {items.filter((i: BacklogItem) => i.category === "fuentes_latam").length}
          </span>
        </Card>
        <Card className="p-4 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Impacto Alto
          </span>
          <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 block">
            {items.filter((i: BacklogItem) => i.impact === "alto").length}
          </span>
        </Card>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 shrink-0">
          <Filter className="h-3.5 w-3.5" /> Filtrar:
        </span>
        <Badge
          variant={selectedCategory === "all" ? "default" : "outline"}
          className="cursor-pointer text-xs py-1 px-3"
          onClick={() => setSelectedCategory("all")}
        >
          Todos ({items.length})
        </Badge>
        {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
          const count = items.filter((i: BacklogItem) => i.category === catKey).length;
          return (
            <Badge
              key={catKey}
              variant={selectedCategory === catKey ? "default" : "outline"}
              className="cursor-pointer text-xs py-1 px-3 whitespace-nowrap"
              onClick={() => setSelectedCategory(catKey)}
            >
              {catLabel} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Items List */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Cargando backlog de diseño...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Lightbulb className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
          <h3 className="text-base font-semibold text-foreground">No hay solicitudes registradas</h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Puedes registrar mejoras desde el Grant Copilot mientras analizas cualquier convocatoria,
            o hacer clic en el botón superior para agregar una nueva solicitud de diseño.
          </p>
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)} className="mt-2">
            Registrar la primera mejora
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((item: BacklogItem) => (
            <Card key={item.id} className="p-4 sm:p-5 hover:border-primary/40 transition-all shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-semibold">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[11px] capitalize ${
                        item.impact === "alto"
                          ? "border-rose-500/40 text-rose-600 bg-rose-500/5 font-bold"
                          : item.impact === "medio"
                            ? "border-amber-500/40 text-amber-600 bg-amber-500/5"
                            : "border-slate-500/40 text-muted-foreground"
                      }`}
                    >
                      Impacto {item.impact}
                    </Badge>
                    <Badge
                      className={`text-[11px] capitalize ${
                        item.status === "nuevo"
                          ? "bg-blue-600 text-white"
                          : item.status === "en_triage"
                            ? "bg-purple-600 text-white"
                            : "bg-emerald-600 text-white"
                      }`}
                    >
                      {item.status}
                    </Badge>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-foreground">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {item.description}
                  </p>
                </div>

                {item.grant && (
                  <div className="sm:max-w-[240px] shrink-0 rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                    <span className="font-semibold block text-foreground truncate flex items-center gap-1">
                      <FileText className="h-3 w-3 text-primary" />
                      {item.grant.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Originado en este grant
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Registrado: {new Date(item.created_at).toLocaleDateString()}
                </span>
                <span>Origen: {item.source}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <ProductDesignBacklogModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
