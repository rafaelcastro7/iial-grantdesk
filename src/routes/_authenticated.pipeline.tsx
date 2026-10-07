// The consultant's pipeline: every grant an organization is working, with the
// decision data from its application plan, in the columns the team uses to
// decide (status, deadline, applicant, role, money, match, fit, priority).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, ListChecks, Mail } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listGrantWorkspaces } from "@/lib/grant-workspace.functions";
import {
  CALL_STATUS_LABEL,
  INSTRUMENT_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  ROUTE_LABEL,
  amountText,
  deadlineText,
  pipelineCsv,
  type PipelineRow,
  type Priority,
} from "@/lib/grant-workspace.shared";
import { evaluationVerdict, realFit } from "@/lib/grant-radar";
import { grantsDigest, type Lang } from "@/lib/consultant-desk.shared";
import { useActiveTenant } from "@/lib/tenant-context";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

const PRIORITY_TONE: Record<Priority, string> = {
  now: "bg-emerald-600 text-white",
  prepare: "bg-amber-500 text-white",
  monitor: "bg-muted text-foreground",
  discard: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

function PipelinePage() {
  const { activeOrgId, activeOrgName } = useActiveTenant();
  const fetchRows = useServerFn(listGrantWorkspaces);
  const [priority, setPriority] = useState<Priority | "all" | "upcoming">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [digestLang, setDigestLang] = useState<Lang>("en");
  const { data, isLoading, error } = useQuery({
    queryKey: ["grant-pipeline", activeOrgId],
    queryFn: () => fetchRows({ data: { orgId: activeOrgId as string } }),
    enabled: !!activeOrgId,
  });

  const rows: PipelineRow[] = useMemo(() => {
    if (!data) return [];
    const nameById = new Map(data.orgs.map((o) => [o.id, o.name]));
    const today = new Date().toISOString().slice(0, 10);
    return data.rows
      .filter(
        (r) =>
          r.grant &&
          (priority === "all" ||
            (priority === "upcoming"
              ? r.workspace.call_status === "upcoming" ||
                r.workspace.call_status === "closed_next_cycle"
              : r.workspace.priority === priority)),
      )
      .map(({ workspace: ws, grant, evaluation }) => {
        const g = grant!;
        const ev = evaluation as Parameters<typeof evaluationVerdict>[0] | null;
        const fit = ev ? realFit(ev as never) : null;
        const verdict = ev ? evaluationVerdict(ev) : null;
        const next = (ws.milestones ?? []).find((m) => !m.done && m.date >= today);
        return {
          grantId: g.id,
          title: g.title,
          funder: g.funder?.name ?? "",
          status: ws.call_status ? CALL_STATUS_LABEL[ws.call_status] : "",
          deadline: deadlineText(g, ws),
          applicant: ws.applicant_org_ids
            .map((id) => nameById.get(id) ?? "")
            .filter(Boolean)
            .join(" + "),
          role: ws.route ? ROUTE_LABEL[ws.route] : "",
          amount: amountText(g),
          instrument: ws.instrument ? INSTRUMENT_LABEL[ws.instrument] : "",
          match:
            ws.match_pct != null
              ? `${ws.match_pct}%${ws.match_in_kind_ok ? " (in-kind OK)" : ""}`
              : "",
          fit:
            verdict === "eligible"
              ? `Eligible${fit != null ? ` · ${fit}/100` : ""}`
              : verdict === "needs_input"
                ? "To confirm"
                : verdict === "not_eligible"
                  ? "Not a fit"
                  : "Not checked",
          priority: PRIORITY_LABEL[ws.priority],
          missing: (ws.checklist ?? []).filter((c) => c.status === "missing").length,
          nextStep: next ? `${next.label} (${next.date})` : "",
          link: g.url ?? "",
        };
      });
  }, [data, priority]);

  const digest = useMemo(() => {
    if (!data || selected.size === 0) return null;
    const nameById = new Map(data.orgs.map((o) => [o.id, o.name]));
    return grantsDigest(
      data.rows
        .filter((r) => r.grant && selected.has(r.grant.id))
        .map((r) => ({
          grant: r.grant!,
          workspace: r.workspace,
          applicantNames: r.workspace.applicant_org_ids
            .map((id) => nameById.get(id) ?? "")
            .filter(Boolean),
        })),
      { lang: digestLang, orgName: activeOrgName || "IIAL" },
    );
  }, [data, selected, digestLang, activeOrgName]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const download = () => {
    const blob = new Blob([pipelineCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grant-pipeline-${(activeOrgName || "org").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pipeline"
        title={`Grants we are working${activeOrgName ? ` — ${activeOrgName}` : ""}`}
        description="Every opportunity with an application plan: who applies, in what role, money, deadline and what is still missing. Open a grant and fill its Application plan to add it here."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...PRIORITIES, "upcoming"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={priority === p ? "default" : "outline"}
              onClick={() => setPriority(p)}
            >
              {p === "all" ? "All" : p === "upcoming" ? "Upcoming cycles" : PRIORITY_LABEL[p]}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={rows.length === 0}
          onClick={download}
        >
          <Download className="h-4 w-4" /> Export to Excel (CSV)
        </Button>
      </div>

      {!activeOrgId && (
        <p className="text-sm text-muted-foreground">Choose an organization first.</p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {data && !data.available && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          The pipeline needs the database update 20261007110000_grant_workspaces.sql.
        </p>
      )}
      {data?.available && rows.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <ListChecks className="mx-auto mb-2 h-6 w-6" />
          No grants in the pipeline yet. Open a grant from the{" "}
          <Link to="/grants" className="text-primary underline-offset-4 hover:underline">
            radar
          </Link>{" "}
          and save its Application plan.
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={rows.length > 0 && rows.every((r) => selected.has(r.grantId))}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? new Set(rows.map((r) => r.grantId)) : new Set(),
                      )
                    }
                  />
                </th>
                {[
                  "Opportunity",
                  "Status",
                  "Deadline",
                  "Applicant",
                  "Role",
                  "Amount",
                  "Match",
                  "Fit",
                  "Priority",
                  "Missing",
                  "Next step",
                ].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const p = (Object.entries(PRIORITY_LABEL).find(([, l]) => l === r.priority)?.[0] ??
                  "monitor") as Priority;
                return (
                  <tr key={r.grantId} className="align-top hover:bg-accent/40">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.title}`}
                        checked={selected.has(r.grantId)}
                        onChange={() => toggle(r.grantId)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to="/grants/$id"
                        params={{ id: r.grantId }}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.funder}</div>
                    </td>
                    <td className="px-3 py-2">{r.status || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.deadline}</td>
                    <td className="px-3 py-2">{r.applicant || "—"}</td>
                    <td className="px-3 py-2">{r.role || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.amount}
                      {r.instrument && (
                        <div className="text-xs text-muted-foreground">{r.instrument}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.match || "—"}</td>
                    <td className="px-3 py-2">{r.fit}</td>
                    <td className="px-3 py-2">
                      <Badge className={PRIORITY_TONE[p]}>{r.priority}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center">{r.missing}</td>
                    <td className="px-3 py-2 text-xs">{r.nextStep || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <section className="mt-6 rounded-lg border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="h-4 w-4" /> One email to Marcelo about the selected grants
            </h2>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={digestLang}
              onChange={(e) => setDigestLang(e.target.value as Lang)}
            >
              <option value="en">English (simple)</option>
              <option value="es">Spanish</option>
            </select>
          </div>
          {!digest ? (
            <p className="text-sm text-muted-foreground">
              Tick the grants in the table to build one summary email: process, what we need,
              partners, deadlines and what we gain, for each one.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold">Subject: {digest.subject}</div>
              <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
                {digest.body}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `Subject: ${digest.subject}\n\n${digest.body}`,
                    );
                    toast.success("Email copied");
                  } catch {
                    toast.error("Could not copy; select the text instead.");
                  }
                }}
              >
                <Copy className="h-4 w-4" /> Copy email
              </Button>
            </div>
          )}
        </section>
      )}
    </PageContainer>
  );
}
