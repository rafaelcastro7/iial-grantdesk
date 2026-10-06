import {
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  DollarSign,
  GraduationCap,
  Layers,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StrategicReturn } from "@/lib/grant-roadmap";

export function GrantStrategicRevenue({
  strategicReturn,
}: {
  strategicReturn: StrategicReturn;
}) {
  return (
    <Card className="border-border/70 shadow-sm bg-card overflow-hidden">
      <CardHeader className="bg-muted/15 border-b px-4 py-3 sm:px-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Retorno Estratégico y Modelo de Revenue para IIAL
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Desglose de valor: OPEX inmediato + Activo WCIS + Monetización posterior
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-5">
        {/* Capa 1 & Capa 2 (Grid 2 columnas) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Capa 1: Financiación de Operación (OPEX) */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Capa 1: Cobertura Inmediata (OPEX)
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold">
                  Fondos No Reembolsables
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-foreground mb-2">
                Qué financia el fondo para la operación de IIAL
              </h4>

              <ul className="space-y-2 text-xs leading-relaxed text-foreground/90">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Salarios y Honorarios:</strong> {strategicReturn.opexCoverage.salariesAndFees}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Misiones a Terreno:</strong> {strategicReturn.opexCoverage.travelAndFieldwork}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Talleres y Capacitación:</strong> {strategicReturn.opexCoverage.communityWorkshops}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Gestión Fiduciaria:</strong> {strategicReturn.opexCoverage.managementAdmin}</span>
                </li>
              </ul>
            </div>

            <p className="mt-3 pt-2.5 border-t border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
              💡 Resultado: Ejecución de actividades sustantivas de IIAL sin quemar capital de trabajo propio.
            </p>
          </div>

          {/* Capa 2: Creación de Activo Estratégico (WCIS) */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Capa 2: Creación de Activo Estratégico
                </span>
                <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary font-semibold">
                  Validación de Metodología
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-foreground mb-2">
                Validación y Prueba en Terreno del Estándar WCIS
              </h4>

              <div className="space-y-2 text-xs leading-relaxed text-foreground/90">
                <div className="rounded-lg bg-background/80 p-2.5 border border-primary/20">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                    Estándar Central
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    {strategicReturn.wcisAssetCreation.standardFocus}
                  </p>
                </div>

                <div className="rounded-lg bg-background/80 p-2.5 border border-primary/20">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                    Caso de Uso en Cadenas de Valor
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    {strategicReturn.wcisAssetCreation.useCaseValidation}
                  </p>
                </div>

                <div className="rounded-lg bg-background/80 p-2.5 border border-primary/20">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                    Métricas de Impacto Social
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    {strategicReturn.wcisAssetCreation.fieldTesting}
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-3 pt-2.5 border-t border-primary/20 text-[11px] text-primary font-medium">
              💡 Resultado: Evidencia empírica, casos de éxito publicados y legitimidad del estándar ante mercados internacionales.
            </p>
          </div>
        </div>

        {/* Capa 3: Monetización Comercial Posterior (Revenue Futuro de IIAL) */}
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" />
                Capa 3: Monetización Posterior &amp; Líneas de Ingresos de IIAL
              </h4>
              <p className="text-xs text-muted-foreground">
                Cómo el grant y el estándar WCIS se convierten en ingresos comerciales recurrentes para IIAL post-proyecto
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {strategicReturn.futureRevenueLines.map((line, idx) => (
              <div key={idx} className="rounded-lg border bg-background/90 p-3 flex flex-col justify-between">
                <div>
                  <Badge variant="secondary" className="text-[10px] font-semibold py-0.5 px-2 mb-1.5">
                    {line.priceRange}
                  </Badge>
                  <h5 className="font-bold text-xs text-foreground leading-snug mb-1">
                    {line.line}
                  </h5>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                    {line.examples}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground space-y-0.5">
                  <div><strong>Cliente:</strong> {line.targetClient}</div>
                  <div><strong>Modelo:</strong> {line.model}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
