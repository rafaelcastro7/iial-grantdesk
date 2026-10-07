// The consultant's working sheet for one grant: who applies and how, the
// decision, consortium, documents checklist, milestones and WCIS project idea,
// saved per organization, plus the decision memo built from it.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Loader2,
  Mail,
  Plus,
  Save,
  Trash2,
  Users,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getGrantWorkspace, saveGrantWorkspace } from "@/lib/grant-workspace.functions";
import { listPartners, savePartner } from "@/lib/partner-directory.functions";
import {
  TEMPLATE_IDS,
  TEMPLATE_LABEL,
  composeOutreach,
  type Lang,
  type TemplateId,
} from "@/lib/outreach-templates.shared";
import {
  CALL_STATUSES,
  CALL_STATUS_LABEL,
  CHECK_STATUSES,
  CHECK_STATUS_LABEL,
  INSTRUMENTS,
  INSTRUMENT_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  ROUTES,
  ROUTE_LABEL,
  decisionMemo,
  defaultMilestones,
  newId,
  type ChecklistItem,
  type Partner,
  type Workspace,
} from "@/lib/grant-workspace.shared";
import { cn } from "@/lib/utils";

const PARTNER_STATUS: Array<[NonNullable<Partner["status"]>, string]> = [
  ["to_contact", "To contact"],
  ["contacted", "Contacted"],
  ["interested", "Interested"],
  ["confirmed", "Confirmed"],
  ["declined", "Declined"],
];

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

export function GrantApplicationWorkspace({ grantId, orgId }: { grantId: string; orgId: string }) {
  const fetchWs = useServerFn(getGrantWorkspace);
  const save = useServerFn(saveGrantWorkspace);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["grant-workspace", grantId, orgId],
    queryFn: () => fetchWs({ data: { grantId, orgId } }),
  });
  const fetchDirectory = useServerFn(listPartners);
  const saveToDirectory = useServerFn(savePartner);
  const { data: directory } = useQuery({
    queryKey: ["partner-directory", orgId],
    queryFn: () => fetchDirectory({ data: { orgId } }),
  });
  const directoryByName = useMemo(
    () => new Map((directory?.partners ?? []).map((d) => [d.name.trim().toLowerCase(), d])),
    [directory],
  );
  const [template, setTemplate] = useState<TemplateId>("partner_intro");
  const [lang, setLang] = useState<Lang>("es");
  const [partnerIdx, setPartnerIdx] = useState(0);
  const [senderName, setSenderName] = useState("Rocío Cruz");
  const [ws, setWs] = useState<Workspace | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newBlocker, setNewBlocker] = useState("");
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    if (data?.workspace) {
      setWs(data.workspace);
      setDirty(false);
    }
  }, [data?.workspace]);

  const update = (patch: Partial<Workspace>) => {
    setWs((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const memo = useMemo(() => {
    if (!data || !ws) return null;
    const names = data.orgs.filter((o) => ws.applicant_org_ids.includes(o.id)).map((o) => o.name);
    return decisionMemo(data.grant, ws, {
      applicantNames: names,
      eligibility: data.eligibility.filter(
        (e) => ws.applicant_org_ids.length === 0 || ws.applicant_org_ids.includes(e.orgId),
      ),
    });
  }, [data, ws]);

  if (isLoading || !ws) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the application plan…
      </div>
    );
  }
  if (error) {
    return (
      <p className="rounded-lg border p-4 text-sm text-destructive">{(error as Error).message}</p>
    );
  }
  if (!data) return null;

  const onSave = async () => {
    setSaving(true);
    try {
      const { id: _id, updated_at: _u, ...payload } = ws as Workspace & { [k: string]: unknown };
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([k]) =>
          [
            "org_id",
            "grant_id",
            "priority",
            "applicant_org_ids",
            "route",
            "lead_institution",
            "administrator",
            "call_status",
            "deadline_time",
            "deadline_timezone",
            "instrument",
            "match_pct",
            "match_in_kind_ok",
            "project_title",
            "wcis_angle",
            "blockers",
            "partners",
            "checklist",
            "milestones",
            "decision_notes",
            "verified_at",
          ].includes(k),
        ),
      );
      await save({ data: clean as never });
      setDirty(false);
      toast.success("Application plan saved");
      await qc.invalidateQueries({ queryKey: ["grant-workspace", grantId, orgId] });
      await qc.invalidateQueries({ queryKey: ["grant-pipeline"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        msg.includes("workspace_unavailable")
          ? "Saving needs the database update 20261007110000_grant_workspaces.sql to be applied."
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  const setChecklist = (list: ChecklistItem[]) => update({ checklist: list });
  const setPartners = (list: Partner[]) => update({ partners: list });
  const missing = ws.checklist.filter((c) => c.status === "missing").length;
  const ready = ws.checklist.filter((c) => c.status === "have").length;

  return (
    <div className="space-y-5">
      {!data.available && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          The application plan can be edited here, but saving needs the database update
          20261007110000_grant_workspaces.sql to be applied.
        </p>
      )}

      {/* Save bar */}
      <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/95 px-4 py-2 shadow-sm backdrop-blur">
        <div className="text-xs text-muted-foreground">
          {dirty ? "Unsaved changes" : data.saved ? "Saved" : "Not saved yet — fill in and save"}
          {" · "}
          {ready}/{ws.checklist.length} documents ready
        </div>
        <Button size="sm" className="gap-1.5" disabled={saving || !dirty} onClick={onSave}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save plan
        </Button>
      </div>

      {/* 1. Who can apply */}
      <Section
        icon={<Users className="h-4 w-4" />}
        title="Who can apply"
        hint="Checked against each organization's profile and rules (no AI)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {data.eligibility.map((e) => {
            const chosen = ws.applicant_org_ids.includes(e.orgId);
            return (
              <label
                key={e.orgId}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3",
                  chosen && "border-primary bg-primary/5",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={chosen}
                  onChange={(ev) =>
                    update({
                      applicant_org_ids: ev.target.checked
                        ? [...ws.applicant_org_ids, e.orgId]
                        : ws.applicant_org_ids.filter((id) => id !== e.orgId),
                    })
                  }
                />
                <div className="min-w-0 text-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    {e.orgName}
                    <VerdictBadge verdict={e.verdict} />
                  </div>
                  {e.reasons.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {e.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {chosen ? "Applies" : "Tick if this organization applies"}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </Section>

      {/* 2. Decision and route */}
      <Section icon={<ClipboardList className="h-4 w-4" />} title="Decision and route">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Priority">
            <select
              className={selectClass}
              value={ws.priority}
              onChange={(e) => update({ priority: e.target.value as Workspace["priority"] })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Our role">
            <select
              className={selectClass}
              value={ws.route ?? ""}
              onChange={(e) => update({ route: (e.target.value || null) as Workspace["route"] })}
            >
              <option value="">Not decided</option>
              {ROUTES.map((r) => (
                <option key={r} value={r}>
                  {ROUTE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Call status">
            <select
              className={selectClass}
              value={ws.call_status ?? ""}
              onChange={(e) =>
                update({ call_status: (e.target.value || null) as Workspace["call_status"] })
              }
            >
              <option value="">Unknown</option>
              {CALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CALL_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lead institution">
            <Input
              value={ws.lead_institution ?? ""}
              placeholder="e.g. Lambton College"
              onChange={(e) => update({ lead_institution: e.target.value || null })}
            />
          </Field>
          <Field label="Who administers the funds">
            <Input
              value={ws.administrator ?? ""}
              placeholder="e.g. the college's research office"
              onChange={(e) => update({ administrator: e.target.value || null })}
            />
          </Field>
          <Field label="Funding type">
            <select
              className={selectClass}
              value={ws.instrument ?? ""}
              onChange={(e) =>
                update({ instrument: (e.target.value || null) as Workspace["instrument"] })
              }
            >
              <option value="">Unknown</option>
              {INSTRUMENTS.map((i) => (
                <option key={i} value={i}>
                  {INSTRUMENT_LABEL[i]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deadline time">
            <div className="flex gap-2">
              <Input
                value={ws.deadline_time ?? ""}
                placeholder="12:00 p.m."
                onChange={(e) => update({ deadline_time: e.target.value || null })}
              />
              <Input
                className="w-24"
                value={ws.deadline_timezone ?? ""}
                placeholder="ET"
                onChange={(e) => update({ deadline_timezone: e.target.value || null })}
              />
            </div>
          </Field>
          <Field label="Our contribution (match %)">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={ws.match_pct ?? ""}
                onChange={(e) =>
                  update({ match_pct: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
              <select
                className={cn(selectClass, "w-36")}
                value={ws.match_in_kind_ok == null ? "" : ws.match_in_kind_ok ? "yes" : "no"}
                onChange={(e) =>
                  update({
                    match_in_kind_ok: e.target.value === "" ? null : e.target.value === "yes",
                  })
                }
              >
                <option value="">In-kind?</option>
                <option value="yes">In-kind OK</option>
                <option value="no">Cash only</option>
              </select>
            </div>
          </Field>
          <Field label="Information verified on">
            <Input
              type="date"
              value={ws.verified_at ?? ""}
              onChange={(e) => update({ verified_at: e.target.value || null })}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Blockers (internal — never copied into partner emails)">
            <div className="flex flex-wrap gap-1.5">
              {ws.blockers.map((b) => (
                <Badge key={b} variant="outline" className="gap-1">
                  {b}
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => update({ blockers: ws.blockers.filter((x) => x !== b) })}
                  >
                    <XCircle className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={newBlocker}
                placeholder="e.g. No audited financial statements"
                onChange={(e) => setNewBlocker(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!newBlocker.trim()}
                onClick={() => {
                  update({ blockers: [...ws.blockers, newBlocker.trim()] });
                  setNewBlocker("");
                }}
              >
                Add
              </Button>
            </div>
          </Field>
        </div>
      </Section>

      {/* 3. Consortium */}
      <Section icon={<Users className="h-4 w-4" />} title="Consortium and partners">
        {ws.partners.length === 0 && (
          <p className="text-sm text-muted-foreground">No partners yet.</p>
        )}
        <div className="space-y-2">
          {ws.partners.map((p, idx) => (
            <div
              key={p.id}
              className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1.4fr_0.8fr_1.4fr_1fr_1fr_auto]"
            >
              <Input
                value={p.name}
                placeholder="Organization"
                list="partner-directory-names"
                onChange={(e) => {
                  const known = directoryByName.get(e.target.value.trim().toLowerCase());
                  setPartners(
                    ws.partners.map((x, i) =>
                      i === idx
                        ? {
                            ...x,
                            name: e.target.value,
                            ...(known
                              ? {
                                  country: x.country || known.country,
                                  type: x.type || known.type,
                                  contact:
                                    x.contact ||
                                    [known.contact_name, known.email].filter(Boolean).join(" · ") ||
                                    null,
                                }
                              : {}),
                          }
                        : x,
                    ),
                  );
                }}
              />
              <Input
                value={p.country ?? ""}
                placeholder="Country"
                onChange={(e) =>
                  setPartners(
                    ws.partners.map((x, i) => (i === idx ? { ...x, country: e.target.value } : x)),
                  )
                }
              />
              <Input
                value={p.role ?? ""}
                placeholder="Role (e.g. administers the grant)"
                onChange={(e) =>
                  setPartners(
                    ws.partners.map((x, i) => (i === idx ? { ...x, role: e.target.value } : x)),
                  )
                }
              />
              <Input
                value={p.contact ?? ""}
                placeholder="Contact"
                onChange={(e) =>
                  setPartners(
                    ws.partners.map((x, i) => (i === idx ? { ...x, contact: e.target.value } : x)),
                  )
                }
              />
              <select
                className={selectClass}
                value={p.status ?? "to_contact"}
                onChange={(e) =>
                  setPartners(
                    ws.partners.map((x, i) =>
                      i === idx ? { ...x, status: e.target.value as Partner["status"] } : x,
                    ),
                  )
                }
              >
                {PARTNER_STATUS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove partner"
                onClick={() => setPartners(ws.partners.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 gap-1.5"
          onClick={() =>
            setPartners([...ws.partners, { id: newId("partner"), name: "", status: "to_contact" }])
          }
        >
          <Plus className="h-4 w-4" /> Add partner
        </Button>
        <datalist id="partner-directory-names">
          {(directory?.partners ?? []).map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
        {directory?.available &&
          ws.partners.some(
            (p) => p.name.trim() && !directoryByName.has(p.name.trim().toLowerCase()),
          ) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 text-xs"
              onClick={async () => {
                const fresh = ws.partners.filter(
                  (p) => p.name.trim() && !directoryByName.has(p.name.trim().toLowerCase()),
                );
                for (const p of fresh) {
                  await saveToDirectory({
                    data: {
                      org_id: orgId,
                      name: p.name.trim(),
                      country: p.country ?? null,
                      type: p.type ?? null,
                      contact_name: p.contact ?? null,
                      contact_title: null,
                      email: null,
                      phone: null,
                      website: null,
                      languages: [],
                      notes: null,
                    },
                  }).catch(() => undefined);
                }
                await qc.invalidateQueries({ queryKey: ["partner-directory", orgId] });
                toast.success(`${fresh.length} partner(s) added to the directory`);
              }}
            >
              Save new partners to the directory
            </Button>
          )}
      </Section>

      {/* 4. Project idea */}
      <Section icon={<ClipboardList className="h-4 w-4" />} title="Project idea">
        <div className="grid gap-3">
          <Field label="Working title">
            <Input
              value={ws.project_title ?? ""}
              placeholder="e.g. Whole-Chain Integrity for Sustainable Agri-Food Systems"
              onChange={(e) => update({ project_title: e.target.value || null })}
            />
          </Field>
          <Field label="How we use WCIS">
            <Textarea
              rows={3}
              value={ws.wcis_angle ?? ""}
              placeholder="WCIS as the applied framework for traceability, integrity and market readiness…"
              onChange={(e) => update({ wcis_angle: e.target.value || null })}
            />
          </Field>
        </div>
      </Section>

      {/* 5. Documents checklist */}
      <Section
        icon={<CheckCircle2 className="h-4 w-4" />}
        title="Documents and requirements"
        hint={`${ready} ready · ${missing} missing`}
      >
        <div className="divide-y rounded-lg border">
          {ws.checklist.map((c, idx) => (
            <div
              key={c.id}
              className="grid items-center gap-2 p-2 sm:grid-cols-[1fr_9rem_8rem_9rem_auto]"
            >
              <div className="text-sm">
                {c.item}
                {c.critical && (
                  <Badge variant="destructive" className="ml-2 text-[10px]">
                    critical
                  </Badge>
                )}
              </div>
              <select
                className={selectClass}
                value={c.status}
                onChange={(e) =>
                  setChecklist(
                    ws.checklist.map((x, i) =>
                      i === idx ? { ...x, status: e.target.value as ChecklistItem["status"] } : x,
                    ),
                  )
                }
              >
                {CHECK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CHECK_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <Input
                value={c.owner ?? ""}
                placeholder="Owner"
                onChange={(e) =>
                  setChecklist(
                    ws.checklist.map((x, i) =>
                      i === idx ? { ...x, owner: e.target.value || null } : x,
                    ),
                  )
                }
              />
              <Input
                type="date"
                value={c.due ?? ""}
                onChange={(e) =>
                  setChecklist(
                    ws.checklist.map((x, i) =>
                      i === idx ? { ...x, due: e.target.value || null } : x,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove item"
                onClick={() => setChecklist(ws.checklist.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={newItem}
            placeholder="Add a requirement or document"
            onChange={(e) => setNewItem(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!newItem.trim()}
            onClick={() => {
              setChecklist([
                ...ws.checklist,
                { id: newId("item"), item: newItem.trim(), status: "missing" },
              ]);
              setNewItem("");
            }}
          >
            Add
          </Button>
        </div>
      </Section>

      {/* 6. Timeline */}
      <Section
        icon={<ClipboardList className="h-4 w-4" />}
        title="Timeline"
        hint={data.grant.deadline ? "Counted back from the deadline" : "No fixed deadline"}
      >
        {ws.milestones.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No milestones.{" "}
            {data.grant.deadline && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => update({ milestones: defaultMilestones(data.grant.deadline) })}
              >
                Build them from the deadline
              </Button>
            )}
          </div>
        ) : (
          <ol className="space-y-1.5">
            {ws.milestones.map((m, idx) => (
              <li key={m.id} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!m.done}
                  onChange={(e) =>
                    update({
                      milestones: ws.milestones.map((x, i) =>
                        i === idx ? { ...x, done: e.target.checked } : x,
                      ),
                    })
                  }
                />
                <Input
                  type="date"
                  className="w-40"
                  value={m.date}
                  onChange={(e) =>
                    update({
                      milestones: ws.milestones.map((x, i) =>
                        i === idx ? { ...x, date: e.target.value } : x,
                      ),
                    })
                  }
                />
                <span className={cn(m.done && "text-muted-foreground line-through")}>
                  {m.label}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* 8. Emails */}
      <Section
        icon={<Mail className="h-4 w-4" />}
        title="Emails to partners and funders"
        hint="Filled from this plan. Never includes the internal blockers."
      >
        {(() => {
          const partner = ws.partners[partnerIdx] ?? null;
          const known = partner
            ? directoryByName.get(partner.name.trim().toLowerCase())
            : undefined;
          const orgName = data.orgs.find((o) => o.id === orgId)?.name ?? "our organization";
          const email = composeOutreach({
            template,
            lang,
            grant: data.grant,
            workspace: ws,
            orgName,
            senderName,
            partner,
            recipientName: known?.contact_name ?? undefined,
          });
          const toPartner = TEMPLATE_LABEL[template].audience === "Partner";
          const mailto = `mailto:${toPartner && known?.email ? encodeURIComponent(known.email) : ""}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
          return (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-4">
                <select
                  className={selectClass}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as TemplateId)}
                >
                  {TEMPLATE_IDS.map((t) => (
                    <option key={t} value={t}>
                      {TEMPLATE_LABEL[t].en}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang)}
                >
                  <option value="es">Spanish</option>
                  <option value="en">English</option>
                </select>
                {toPartner && (
                  <select
                    className={selectClass}
                    value={partnerIdx}
                    onChange={(e) => setPartnerIdx(Number(e.target.value))}
                  >
                    {ws.partners.length === 0 && <option value={0}>No partners yet</option>}
                    {ws.partners.map((p, i) => (
                      <option key={p.id} value={i}>
                        {p.name || `Partner ${i + 1}`}
                      </option>
                    ))}
                  </select>
                )}
                <Input
                  value={senderName}
                  placeholder="Sender"
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
              <div className="text-xs font-semibold">Subject: {email.subject}</div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
                {email.body}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `Subject: ${email.subject}\n\n${email.body}`,
                      );
                      toast.success("Email copied");
                    } catch {
                      toast.error("Could not copy; select the text instead.");
                    }
                  }}
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <a href={mailto}>
                    <Mail className="h-4 w-4" /> Open in email app
                  </a>
                </Button>
              </div>
            </div>
          );
        })()}
      </Section>

      {/* 7. Decision memo */}
      <Section
        icon={<Mail className="h-4 w-4" />}
        title="Decision memo"
        hint="Plain English summary to send to the decision maker. Internal: it lists blockers."
      >
        <Field label="Notes for the memo">
          <Textarea
            rows={2}
            value={ws.decision_notes ?? ""}
            onChange={(e) => update({ decision_notes: e.target.value || null })}
          />
        </Field>
        {memo && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-semibold">Subject: {memo.subject}</div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
              {memo.body}
            </pre>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`Subject: ${memo.subject}\n\n${memo.body}`);
                  toast.success("Memo copied");
                } catch {
                  toast.error("Could not copy; select the text instead.");
                }
              }}
            >
              <Copy className="h-4 w-4" /> Copy memo
            </Button>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-primary">{icon}</span>
          {title}
        </h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function VerdictBadge({ verdict }: { verdict: "eligible" | "needs_input" | "not_eligible" }) {
  if (verdict === "eligible") return <Badge className="bg-emerald-600 text-[10px]">Eligible</Badge>;
  if (verdict === "needs_input")
    return (
      <Badge variant="outline" className="gap-1 text-[10px] text-amber-700">
        <AlertTriangle className="h-3 w-3" /> To confirm
      </Badge>
    );
  return (
    <Badge variant="destructive" className="text-[10px]">
      Not eligible
    </Badge>
  );
}
