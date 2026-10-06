import {
  AlertTriangle,
  Building,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck,
  FileText,
  Info,
  Layers,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FinancialConditions } from "@/lib/grant-roadmap";

export function GrantFinancialHurdles({
  financial,
}: {
  financial: FinancialConditions;
}) {
  return (
    <Card className="border-border/70 shadow-sm bg-card overflow-hidden">
      <CardHeader className="bg-muted/15 border-b px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Condiciones Financieras y Barreras Críticas de Postulación
          </CardTitle>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Criterios de auditoría, contrapartida y solvencia fiduciaria
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Nivel de Auditoría */}
          <div className="rounded-xl border bg-background/80 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <FileCheck className="h-3.5 w-3.5 text-primary" />
                  Nivel de Auditoría
                </span>
                <Badge
                  variant={financial.auditLevel.status === "warn" ? "outline" : "secondary"}
                  className={cn(
                    "text-[10px] font-semibold py-0.5",
                    financial.auditLevel.status === "warn"
                      ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
                      : "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
                  )}
                >
                  {financial.auditLevel.allowsInternalSigned ? "Acepta Internos" : "Auditoría Externa"}
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-foreground leading-snug mb-1.5">
                {financial.auditLevel.label}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {financial.auditLevel.detail}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t text-[11px] font-medium text-foreground/80 flex items-center gap-1">
              {financial.auditLevel.allowsInternalSigned ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>No bloquea a IIAL directamente</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>Requiere Lead postsecundario (Lambton)</span>
                </>
              )}
            </div>
          </div>

          {/* 2. Contrapartida & In-Kind */}
          <div className="rounded-xl border bg-background/80 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-primary" />
                  Contrapartida (Match)
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold py-0.5",
                    financial.matchingFunds.inKindAllowed
                      ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {financial.matchingFunds.inKindAllowed ? "In-Kind Elegible" : "Efectivo Requerido"}
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-foreground leading-snug mb-1.5">
                {financial.matchingFunds.label}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {financial.matchingFunds.detail}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t text-[11px] font-medium text-foreground/80 flex items-center gap-1">
              <span className="text-primary font-bold">✓</span>
              <span>
                {financial.matchingFunds.inKindAllowed
                  ? "Cubrible con horas de equipo y framework WCIS"
                  : "Requiere fondos bancarios confirmados"}
              </span>
            </div>
          </div>

          {/* 3. Requisito Legal Canadiense */}
          <div className="rounded-xl border bg-background/80 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  Personería Legal
                </span>
                <Badge variant="secondary" className="text-[10px] font-semibold py-0.5">
                  Canadá / CRA
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-foreground leading-snug mb-1.5">
                {financial.canadianLegal.label}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {financial.canadianLegal.detail}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t text-[11px] font-medium text-foreground/80 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>IIAL cumple como NPO federal con CRA</span>
            </div>
          </div>

          {/* 4. Ventana de Recepción & Desembolso */}
          <div className="rounded-xl border bg-background/80 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Ventana &amp; Tiempos
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold py-0.5",
                    financial.disbursementTimeline.intakeMode === "rolling"
                      ? "border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/10"
                      : "text-muted-foreground",
                  )}
                >
                  {financial.disbursementTimeline.intakeMode === "rolling" ? "Recepción Continua" : "Convocatoria Fija"}
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-foreground leading-snug mb-1.5">
                Respuesta: {financial.disbursementTimeline.initialResponseTime}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {financial.disbursementTimeline.detail}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t text-[11px] text-muted-foreground flex items-center gap-1">
              <span>Lag desembolso:</span>
              <strong className="text-foreground">{financial.disbursementTimeline.disbursementLag}</strong>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
