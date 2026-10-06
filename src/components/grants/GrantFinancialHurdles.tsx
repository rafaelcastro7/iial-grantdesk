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
            Financial Architecture &amp; Critical Application Hurdles
          </CardTitle>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Audit requirements, matching thresholds, and fiduciary criteria
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
                  Audit Level
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
                  {financial.auditLevel.allowsInternalSigned ? "Internal Signed OK" : "External Audit"}
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
                  <span>Does not block IIAL directly</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>Requires postsecondary lead (Lambton)</span>
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
                  Cost Share / Matching
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
                  {financial.matchingFunds.inKindAllowed ? "In-Kind Eligible" : "Cash Match Required"}
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
                  ? "Coverable via team hours & WCIS standard assets"
                  : "Requires confirmed banking deposit commitment"}
              </span>
            </div>
          </div>

          {/* 3. Canadian Legal Status */}
          <div className="rounded-xl border bg-background/80 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  Legal Standing
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
              <span>IIAL qualifies as federal NPO with CRA</span>
            </div>
          </div>

          {/* 4. Intake Window & Timelines */}
          <div className="rounded-xl border bg-background/80 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Intake &amp; Timeline
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
                  {financial.disbursementTimeline.intakeMode === "rolling" ? "Continuous Intake" : "Fixed Deadline"}
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-foreground leading-snug mb-1.5">
                Response: {financial.disbursementTimeline.initialResponseTime}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {financial.disbursementTimeline.detail}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t text-[11px] text-muted-foreground flex items-center gap-1">
              <span>Disbursement lag:</span>
              <strong className="text-foreground">{financial.disbursementTimeline.disbursementLag}</strong>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
