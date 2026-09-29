import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGrantsForClient } from "@/lib/client-grants.functions";
import { meta } from "@/lib/head";

export const Route = createFileRoute("/clients_/$clientId/grants")({
  component: ClientGrantsPage,
  head: () => meta(
    "Client grants — Grant Desk",
    "Grant opportunities matched to this client, grouped by verdict and country.",
  ),
});

const grantsQueryOptions = (clientId: string) =>
  queryOptions({
    queryKey: ["clients", "grants", clientId],
    queryFn: () => listGrantsForClient({ clientId }),
    enabled: !!clientId,
  });

function ClientGrantsPage() {
  const { clientId } = Route.useParams();
  const { data } = useSuspenseQuery(grantsQueryOptions(clientId));

  const grants = data?.grants ?? [];

  const grouped = {
    eligible: grants.filter((g) => g.matches?.verdict === "eligible"),
    needs_input: grants.filter((g) => g.matches?.verdict === "needs_input"),
    ineligible: grants.filter((g) => g.matches?.verdict === "ineligible"),
  };

  const total = grants.length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        to="/clients/$clientId"
        params={{ clientId }}
        className="text-sm text-[var(--color-accent)]"
      >
        ← Back to client
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Grant Matches</h1>
      <p className="mt-2 max-w-prose text-sm text-[var(--color-ink-soft)]">
        All grant opportunities matched to this client. {total} total.
      </p>

      {total === 0 && (
        <p className="mt-8 text-sm text-[var(--color-ink-soft)]">
          No matches yet. Run matching from the client profile page.
        </p>
      )}

      {(["eligible", "needs_input", "ineligible"] as const).map((verdict) => {
        const rows = grouped[verdict];
        if (rows.length === 0) return null;

        const heading =
          verdict === "eligible"
            ? "Can apply"
            : verdict === "needs_input"
            ? "Needs an answer"
            : "Ruled out";

        return (
          <section key={verdict} className="mt-10">
            <h2 className="text-sm font-semibold">
              {heading}{" "}
              <span className="font-mono tabular-nums text-[var(--color-ink-soft)]">
                {rows.length}
              </span>
            </h2>
            <ul className="mt-3 flex flex-col gap-px overflow-hidden rounded-md border border-[var(--color-rule)] bg-[var(--color-rule)]">
              {rows.map((grant) => (
                <GrantRow key={grant.id} grant={grant} clientId={clientId} />
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

function GrantRow({ grant, clientId }: { grant: any; clientId: string }) {
  const match = grant.matches;
  const verdict = match?.verdict;
  const relevance = match?.relevance;
  const checks = match?.eligibility_checks ?? [];

  const VERDICT_COLOR: Record<string, string> = {
    eligible: "text-[var(--color-eligible)]",
    needs_input: "text-[var(--color-needs-input)]",
    ineligible: "text-[var(--color-ineligible)]",
  };

  const VERDICT_LABEL: Record<string, string> = {
    eligible: "Can apply",
    needs_input: "Needs an answer",
    ineligible: "Ruled out",
  };

  const amount = grant.amount_min && grant.amount_max
    ? `${grant.currency} ${grant.amount_min.toLocaleString()}–${grant.amount_max.toLocaleString()}`
    : grant.amount_max
    ? `up to ${grant.currency} ${grant.amount_max.toLocaleString()}`
    : grant.amount_min
    ? `from ${grant.currency} ${grant.amount_min.toLocaleString()}`
    : null;

  const deciding = checks
    .filter((c: any) => c.is_hard_gate)
    .find((c: any) => c.status === "fail" || c.status === "unknown") ??
    checks.find((c: any) => !c.is_hard_gate && c.status === "unknown");

  return (
    <li className="bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <a
          href={`https://www.grants.gov/search-results?searchText=${encodeURIComponent(grant.title)}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[var(--color-accent)]"
        >
          {grant.title}
        </a>
        <span className={`shrink-0 text-xs font-medium ${VERDICT_COLOR[verdict]}`}>
          {VERDICT_LABEL[verdict]}
        </span>
      </div>

      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
        {[
          grant.funders?.name,
          grant.country,
          amount,
          grant.deadline && `closes ${grant.deadline}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {deciding && (
        <p className="mt-2 text-sm">
          {deciding.detail}
        </p>
      )}

      {relevance !== null && relevance !== undefined && (
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Relevance: {Math.round(relevance * 100)}%
        </p>
      )}

      {verdict === "eligible" && (
        <Link
          to="/clients/$clientId/proposals/$grantId"
          params={{ clientId, grantId: grant.id }}
          className="mt-2 inline-block text-sm font-medium text-[var(--color-accent)]"
        >
          Draft proposal →
        </Link>
      )}
    </li>
  );
}