import {
  Building2,
  CheckCircle2,
  GraduationCap,
  Network,
  ShieldAlert,
  Sparkles,
  Users2,
  Workflow,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ConsortiumRoute, RouteId } from "@/lib/grant-roadmap";

const ROUTE_ICONS: Record<RouteId, React.ComponentType<{ className?: string }>> = {
  direct: Building2,
  academic: GraduationCap,
  territorial: Users2,
  commercial: Network,
};

export function GrantConsortiumMatrix({
  routes,
  recommendedRouteId,
  selectedRouteId,
  onSelectRoute,
  orgName = "Organization",
}: {
  routes: ConsortiumRoute[];
  recommendedRouteId: RouteId;
  selectedRouteId: RouteId;
  onSelectRoute: (id: RouteId) => void;
  orgName?: string;
}) {
  return (
    <Card className="border-primary/25 shadow-sm overflow-hidden bg-card">
      <CardHeader className="bg-muted/20 border-b px-4 py-3 sm:px-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              Consortium &amp; Application Routes Matrix
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparative strategy: determines administrative lead, {orgName}'s delivery role, and how to bypass audit or territorial representation hurdles.
            </p>
          </div>
          <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30 text-primary self-start sm:self-auto py-1">
            <Sparkles className="h-3 w-3 mr-1" />
            Recommended: {routes.find((r) => r.id === recommendedRouteId)?.title.split(":")[1]?.trim() || "Academic R&D"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {routes.map((route) => {
            const Icon = ROUTE_ICONS[route.id] || Building2;
            const isSelected = selectedRouteId === route.id;
            const isRecommended = recommendedRouteId === route.id;

            return (
              <div
                key={route.id}
                onClick={() => onSelectRoute(route.id)}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer select-none",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/25"
                    : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/10",
                )}
              >
                {/* Header card */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className={cn(
                      "rounded-lg p-2 shrink-0",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          route.viability === "high"
                            ? "secondary"
                            : route.viability === "conditional"
                              ? "outline"
                              : "destructive"
                        }
                        className={cn(
                          "text-[10px] font-semibold py-0.5 px-2",
                          route.viability === "high" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
                          route.viability === "conditional" && "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
                        )}
                      >
                        {route.viability === "high" ? "Viable" : route.viability === "conditional" ? "Conditional" : "Blocked Directly"}
                      </Badge>
                      {isRecommended && (
                        <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                          ★ Recommended
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-foreground mb-1 leading-snug">
                    {route.title}
                  </h3>

                  {/* Lead and Role */}
                  <div className="space-y-2 mt-3 text-xs">
                    <div className="rounded-md bg-muted/40 p-2 border border-border/40">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                        Lead Applicant (Fiduciary)
                      </span>
                      <span className="font-semibold text-foreground text-xs leading-tight block">
                        {route.leadEntity}
                      </span>
                    </div>

                    <div className="rounded-md bg-muted/40 p-2 border border-border/40">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                        {orgName} Delivery Role
                      </span>
                      <span className="text-xs text-foreground/90 leading-tight block">
                        {route.iialRole}
                      </span>
                    </div>

                    {/* Key Strategic Partner */}
                    <div className="pt-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                        Key Partner
                      </span>
                      <span className="text-xs font-medium text-foreground block">
                        {route.recommendedPartner}
                      </span>
                    </div>

                    {/* Tactical Value */}
                    <div className="pt-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                        Strategy &amp; Barrier Unlock
                      </span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {route.tacticalValue}
                      </p>
                    </div>

                    {/* Critical Barrier */}
                    {route.keyBarrier && (
                      <div className="pt-1 border-t border-border/40">
                        <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block mb-0.5 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" /> Pre-Condition:
                        </span>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {route.keyBarrier}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer action */}
                <div className="mt-4 pt-3 border-t border-border/50">
                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "w-full text-xs h-7.5 font-semibold",
                      isSelected && "shadow-xs"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRoute(route.id);
                    }}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-white" />
                        Active Route
                      </>
                    ) : (
                      <>
                        Select Route
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
