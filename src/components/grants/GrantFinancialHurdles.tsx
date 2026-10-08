import {
  AlertTriangle,
  Building,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTr } from "@/lib/ui-lang";
import type { FinancialConditions } from "@/lib/grant-roadmap";

export function GrantFinancialHurdles({
  financial,
  orgName: orgNameProp,
}: {
  financial: FinancialConditions;
  orgName?: string;
}) {
  const tr = useTr();
  const orgName = orgNameProp ?? tr("Organization", "Organización");
  return (
    <Card className="border-border/70 shadow-sm bg-card overflow-hidden">
      <CardHeader className="bg-muted/15 border-b px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            {tr(
              "Financial Architecture & Critical Application Hurdles",
              "Arquitectura financiera y obstáculos críticos de la postulación",
            )}
          </CardTitle>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {tr(
              "Audit requirements, matching thresholds, and fiduciary criteria",
              "Requisitos de auditoría, umbrales de contrapartida y criterios fiduciarios",
            )}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Audit Level */}
          <div className="rounded-xl border bg-background/80 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <FileCheck className="h-3.5 w-3.5 text-primary" />
                  {tr("Audit Level", "Nivel de auditoría")}
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
                  {financial.auditLevel.allowsInternalSigned
                    ? tr("Internal Signed OK", "Firma interna aceptada")
                    : tr("External Audit", "Auditoría externa")}
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
                  <span>
                    {tr(
                      `Does not block ${orgName} directly`,
                      `No bloquea a ${orgName} en forma directa`,
                    )}
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>
                    {tr(
                      "Requires institutional lead (e.g. Lambton)",
                      "Requiere un líder institucional (p. ej., Lambton)",
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 2. Cost Share & In-Kind */}
          <div className="rounded-xl border bg-background/80 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-primary" />
                  {tr("Cost Share / Matching", "Cofinanciamiento / contrapartida")}
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
                  {financial.matchingFunds.inKindAllowed
                    ? tr("In-Kind Eligible", "Aporte en especie admitido")
                    : tr("Cash Match Required", "Se requiere contrapartida en efectivo")}
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
                  ? tr(
                      "Coverable via team hours & standard institutional assets",
                      "Cubrible con horas del equipo y activos institucionales estándar",
                    )
                  : tr(
                      "Requires confirmed banking deposit commitment",
                      "Requiere un compromiso confirmado de depósito bancario",
                    )}
              </span>
            </div>
          </div>

          {/* 3. Canadian Legal Status */}
          <div className="rounded-xl border bg-background/80 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  {tr("Legal Standing", "Situación legal")}
                </span>
                <Badge variant="secondary" className="text-[10px] font-semibold py-0.5">
                  Canada / CRA
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
              <span>
                {tr(
                  `${orgName} matches active CRA / corporate eligibility`,
                  `${orgName} cumple la elegibilidad vigente ante la CRA / corporativa`,
                )}
              </span>
            </div>
          </div>

          {/* 4. Intake Window & Timelines */}
          <div className="rounded-xl border bg-background/80 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {tr("Intake & Timeline", "Convocatoria y plazos")}
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
                  {financial.disbursementTimeline.intakeMode === "rolling"
                    ? tr("Continuous Intake", "Convocatoria continua")
                    : tr("Fixed Deadline", "Fecha límite fija")}
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-foreground leading-snug mb-1.5">
                {tr("Response:", "Respuesta:")} {financial.disbursementTimeline.initialResponseTime}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {financial.disbursementTimeline.detail}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t text-[11px] text-muted-foreground flex items-center gap-1">
              <span>{tr("Disbursement lag:", "Plazo de desembolso:")}</span>
              <strong className="text-foreground">
                {financial.disbursementTimeline.disbursementLag}
              </strong>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
