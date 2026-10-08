import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { describeCheck } from "@/lib/eligibility-explain";
import { useTr } from "@/lib/ui-lang";

type Check = { id?: string; label: string; status?: string; detail?: string; hard?: boolean };

/**
 * Each failed or flagged eligibility rule, side by side: what the grant asks,
 * what the organization profile says, and what to do — so a consultant can
 * tell a profile setting they can fix from a grant they should not pursue.
 */
export function EligibilityIssues({ checks }: { checks: Check[] }) {
  const tr = useTr();
  const issues = checks.filter((check) => check.status === "fail" || check.status === "warn");
  if (issues.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2">
      {issues.map((check, index) => {
        const info = describeCheck(check);
        return (
          <li
            key={`${check.id ?? check.label}-${index}`}
            className="rounded-md border bg-background p-3 text-xs"
          >
            <p className="font-medium text-foreground">{info.title}</p>
            {(info.grantSays || info.profileSays) && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {info.grantSays && (
                  <>
                    <dt className="text-muted-foreground">
                      {tr("Grant asks for", "El grant pide")}
                    </dt>
                    <dd className="text-foreground">{info.grantSays}</dd>
                  </>
                )}
                {info.profileSays && (
                  <>
                    <dt className="text-muted-foreground">{tr("Your profile", "Tu perfil")}</dt>
                    <dd className="text-foreground">{info.profileSays}</dd>
                  </>
                )}
              </dl>
            )}
            <p className="mt-2 text-muted-foreground">{info.fix}</p>
            {info.profileFixable && (
              <Link
                to="/org"
                className="mt-1.5 inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
              >
                {tr("Review my profile", "Revisar mi perfil")} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
