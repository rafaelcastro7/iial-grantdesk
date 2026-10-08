// The consultant's working sheet for one grant: who applies and how, the
// decision, consortium, documents checklist, milestones and WCIS project idea,
// saved per organization, plus the decision memo built from it.
import { dossierToPlan, type Dossier } from "@/lib/grant-dossier.shared";
import { getGrantDossier } from "@/lib/grant-dossier.functions";
import { fitLabel, fitTone, type DossierFit } from "@/lib/grant-dossier.shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getGrantWorkspace, saveGrantWorkspace } from "@/lib/grant-workspace.functions";
import {
  checkCountryEligibility,
  explainTerms,
  PRESET_COUNTRIES,
} from "@/lib/consultant-desk.shared";
import { synthesizeGrantRoadmap } from "@/lib/grant-roadmap";
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
  CHECK_STATUSES,
  INSTRUMENTS,
  PRIORITIES,
  ROUTES,
  adoptConsortiumRoute,
  callStatusLabel,
  checkStatusLabel,
  instrumentLabel,
  priorityLabel,
  routeLabel,
  decisionMemo,
  defaultMilestones,
  missingFromCall,
  applyPlanUpdate,
  mergeServerChanges,
  newId,
  type ChecklistItem,
  type Partner,
  type Workspace,
} from "@/lib/grant-workspace.shared";
import { useTr, useUiLang } from "@/lib/ui-lang";
import { cn } from "@/lib/utils";

const PARTNER_STATUS: Array<[NonNullable<Partner["status"]>, string, string]> = [
  ["to_contact", "To contact", "Por contactar"],
  ["contacted", "Contacted", "Contactado"],
  ["interested", "Interested", "Interesado"],
  ["confirmed", "Confirmed", "Confirmado"],
  ["declined", "Declined", "Declinó"],
];

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

export function GrantApplicationWorkspace({ grantId, orgId }: { grantId: string; orgId: string }) {
  const tr = useTr();
  const uiLang = useUiLang();
  const fetchDossier = useServerFn(getGrantDossier);
  const { data: dossierData } = useQuery({
    queryKey: ["grant-dossier", grantId, orgId, uiLang],
    queryFn: () => fetchDossier({ data: { grantId, orgId, lang: uiLang } }),
  });
  const savedFit =
    (dossierData?.saved?.dossier as { fit?: DossierFit; fit_reason?: string } | undefined) ?? null;
  const dossierFit = savedFit?.fit ? { fit: savedFit.fit, reason: savedFit.fit_reason } : null;

  const fetchWs = useServerFn(getGrantWorkspace);
  const save = useServerFn(saveGrantWorkspace);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["grant-workspace", grantId, orgId, uiLang],
    queryFn: () => fetchWs({ data: { grantId, orgId, lang: uiLang } }),
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
  // Recipient's language for emails: follows the interface language until changed.
  const [langOverride, setLang] = useState<Lang | null>(null);
  const lang: Lang = langOverride ?? uiLang;
  const [partnerIdx, setPartnerIdx] = useState(0);
  const [senderName, setSenderName] = useState("Rocío Cruz");
  const [meetingWhen, setMeetingWhen] = useState("");
  const [writeMode, setWriteMode] = useState<"outreach" | "memo">("outreach");
  const [links, setLinks] = useState("https://iial.ca");
  const [attachmentsEdit, setAttachments] = useState<string | null>(null);
  const [includeAcademicCredentials, setIncludeAcademicCredentials] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const [saving, setSaving] = useState(false);
  const [newBlocker, setNewBlocker] = useState("");
  const [newItem, setNewItem] = useState("");

  // The server copy last seen, to tell what changed on the server meanwhile.
  const serverRef = useRef<Workspace | null>(null);
  useEffect(() => {
    if (!data?.workspace) return;
    const before = serverRef.current;
    serverRef.current = data.workspace;
    if (!dirtyRef.current || !before) {
      setWs(data.workspace);
      setDirty(false);
    } else {
      // Unsaved edits + a change applied elsewhere (dossier, Copilot): merge,
      // so the next "Save plan" keeps both.
      setWs((local) =>
        local ? mergeServerChanges(local, before, data.workspace) : data.workspace,
      );
    }
  }, [data?.workspace]);

  // An unsaved plan starts from the dossier: its real documents and dates
  // replace the generic list (a saved or edited plan is never touched).
  const seededFromDossier = useRef(false);
  useEffect(() => {
    const d = dossierData?.saved?.dossier;
    if (!d || seededFromDossier.current || !ws || data?.saved || dirtyRef.current) return;
    seededFromDossier.current = true;
    const fromCall = ws.checklist.filter(
      (c) =>
        c.id.startsWith("req-") &&
        !/^(project proposal narrative|detailed project budget|work plan with milestone|proof of organizational legal registration)/i.test(
          c.item,
        ),
    );
    let next: Workspace = { ...ws, checklist: fromCall };
    next = applyPlanUpdate(next, dossierToPlan(d, "documents"));
    if (d.timeline.some((t) => t.date)) next = applyPlanUpdate(next, dossierToPlan(d, "timeline"));
    setWs(next);
  }, [dossierData?.saved, ws, data?.saved]);

  const update = (patch: Partial<Workspace>) => {
    setWs((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const currentOrgName = useMemo(() => {
    return data?.orgs.find((o) => o.id === orgId)?.name ?? "IIAL";
  }, [data?.orgs, orgId]);

  const memo = useMemo(() => {
    if (!data || !ws) return null;
    const names = data.orgs.filter((o) => ws.applicant_org_ids.includes(o.id)).map((o) => o.name);
    return decisionMemo(data.grant, ws, {
      applicantNames: names,
      orgName: names[0] ?? currentOrgName,
      eligibility: data.eligibility.filter(
        (e) => ws.applicant_org_ids.length === 0 || ws.applicant_org_ids.includes(e.orgId),
      ),
      lang: uiLang,
    });
  }, [data, ws, currentOrgName, uiLang]);

  const glossary = useMemo(
    () =>
      explainTerms([
        ...(ws?.checklist ?? []).map((c) => c.item),
        ...(data?.grant.requirements ?? []).map((r) => r.requirement),
        data?.grant.summary,
      ]),
    [data, ws],
  );

  const countryCheck = useMemo(() => {
    if (!countryQuery.trim() || !data?.grant) return null;
    return checkCountryEligibility(
      countryQuery,
      [
        data.grant.title,
        data.grant.summary,
        data.grant.country,
        ...(data.grant.requirements ?? []).map((r) => r.requirement),
      ],
      uiLang,
    );
  }, [countryQuery, data?.grant, uiLang]);

  const roadmap = useMemo(() => {
    if (!data?.grant) return null;
    return synthesizeGrantRoadmap(
      {
        id: data.grant.id,
        title: data.grant.title,
        funderName: data.grant.funder?.name,
        summary: data.grant.summary,
        amountCadMax: data.grant.amount_cad_max,
        deadline: data.grant.deadline,
        deadlineKind: data.grant.deadline_kind,
        requirements: data.grant.requirements?.map((r) => ({
          requirement: r.requirement ?? "",
          isCritical: r.isCritical,
        })),
        orgName: currentOrgName,
      },
      uiLang,
    );
  }, [data?.grant, currentOrgName, uiLang]);

  if (isLoading || !ws) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />{" "}
        {tr("Loading the application plan…", "Cargando el plan de postulación…")}
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
      toast.success(tr("Application plan saved", "Plan de postulación guardado"));
      await qc.invalidateQueries({ queryKey: ["grant-workspace", grantId, orgId] });
      await qc.invalidateQueries({ queryKey: ["grant-pipeline"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        msg.includes("workspace_unavailable")
          ? tr(
              "Saving needs the database update 20261007110000_grant_workspaces.sql to be applied.",
              "Para guardar hay que aplicar la actualización de base de datos 20261007110000_grant_workspaces.sql.",
            )
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
          {tr(
            "The application plan can be edited here, but saving needs the database update 20261007110000_grant_workspaces.sql to be applied.",
            "El plan de postulación se puede editar aquí, pero para guardar hay que aplicar la actualización de base de datos 20261007110000_grant_workspaces.sql.",
          )}
        </p>
      )}

      {/* Save bar */}
      <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/95 px-4 py-2 shadow-sm backdrop-blur">
        <div className="text-xs text-muted-foreground">
          {dirty
            ? tr("Unsaved changes", "Cambios sin guardar")
            : data.saved
              ? tr("Saved", "Guardado")
              : tr("Not saved yet — fill in and save", "Aún no guardado — complete y guarde")}
          {" · "}
          {ready}/{ws.checklist.length} {tr("documents ready", "documentos listos")}
        </div>
        <Button size="sm" className="gap-1.5" disabled={saving || !dirty} onClick={onSave}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {tr("Save plan", "Guardar plan")}
        </Button>
      </div>

      <Section
        icon={<Users className="h-4 w-4" />}
        title={tr("1. Can we apply?", "1. ¿Podemos aplicar?")}
        hint={tr(
          "Checked against each organization's profile and rules (no AI).",
          "Verificado con el perfil y las reglas de cada organización (sin IA).",
        )}
      >
        {dossierFit && (
          <div
            className={cn(
              "mb-3 rounded-lg border p-3 text-sm",
              fitTone(dossierFit.fit) === "good"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : fitTone(dossierFit.fit) === "warn"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-rose-500/40 bg-rose-500/5",
            )}
          >
            <span className="font-semibold">
              {tr("Dossier (official page and web)", "Dossier (página oficial y web)")}:{" "}
              {fitLabel(dossierFit.fit, uiLang)}
            </span>
            {dossierFit.reason && (
              <span className="block text-muted-foreground">{dossierFit.reason}</span>
            )}
            <span className="block pt-1 text-xs text-muted-foreground">
              {tr(
                "The checks below use only your profile's rules; when they disagree, the dossier read the call itself.",
                "Las verificaciones de abajo usan solo las reglas de su perfil; si no coinciden, el dossier leyó la convocatoria misma.",
              )}
            </span>
          </div>
        )}
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
                    <VerdictBadge verdict={e.verdict} tr={tr} />
                  </div>
                  {e.reasons.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {e.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {chosen
                      ? tr("Applies", "Aplica")
                      : tr(
                          "Tick if this organization applies",
                          "Marque si esta organización aplica",
                        )}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-primary">
            {tr(
              "Check a country (beneficiary or partner)",
              "Verificar un país (beneficiario o socio)",
            )}
          </summary>
          <div className="mt-2">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={countryQuery}
                  placeholder={tr(
                    "e.g. Peru, Colombia, Mexico, Costa Rica, Madagascar…",
                    "p. ej. Perú, Colombia, México, Costa Rica, Madagascar…",
                  )}
                  onChange={(e) => setCountryQuery(e.target.value)}
                  className="max-w-md"
                />
                {countryQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCountryQuery("")}
                  >
                    {tr("Clear", "Limpiar")}
                  </Button>
                )}
              </div>
              {/* Quick preset country pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-muted-foreground mr-1">
                  {tr("Quick check:", "Verificación rápida:")}
                </span>
                {PRESET_COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCountryQuery(c.name)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors cursor-pointer",
                      countryQuery.toLowerCase() === c.name.toLowerCase()
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    <span>{c.flag}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
              {countryCheck && countryQuery.trim() && (
                <div
                  className={cn(
                    "rounded-md border p-3 text-xs leading-relaxed",
                    countryCheck.verdict === "explicit" &&
                      "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
                    countryCheck.verdict === "regional_likely" &&
                      "border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-200",
                    countryCheck.verdict === "not_mentioned" &&
                      "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
                  )}
                >
                  <div className="font-semibold mb-1">
                    {countryCheck.verdict === "explicit"
                      ? tr("✓ Explicitly Eligible", "✓ Elegible explícitamente")
                      : countryCheck.verdict === "regional_likely"
                        ? tr("ℹ High Regional Viability", "ℹ Alta viabilidad regional")
                        : tr("⚠️ Not Specifically Mentioned", "⚠️ No mencionado específicamente")}
                  </div>
                  <p>{countryCheck.detail}</p>
                </div>
              )}
            </div>
          </div>
        </details>
      </Section>

      <Section
        icon={<ClipboardList className="h-4 w-4" />}
        title={tr("2. Our decision", "2. Nuestra decisión")}
      >
        {roadmap && !dossierData?.saved && (
          <div className="mb-4 space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                <Workflow className="h-3.5 w-3.5 text-primary" />
                {tr("Strategic suggested routes", "Rutas estratégicas sugeridas")}
              </span>
              <span className="text-xs text-muted-foreground">
                {tr("Recommended:", "Recomendada:")}{" "}
                <strong className="text-primary">
                  {roadmap.routes
                    .find((r) => r.id === roadmap.recommendedRouteId)
                    ?.title.split(":")[1]
                    ?.trim() ?? tr("Academic", "Académica")}
                </strong>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {roadmap.routes.map((r) => {
                const isAdopted =
                  (r.id === "direct" && ws.route === "lead") ||
                  (r.id === "academic" &&
                    (ws.lead_institution?.toLowerCase().includes("lambton") ||
                      ws.partners.some((p) => p.name.toLowerCase().includes("lambton")))) ||
                  (r.id === "territorial" &&
                    (ws.lead_institution?.toLowerCase().includes("socodevi") ||
                      ws.lead_institution?.toLowerCase().includes("app cacao") ||
                      ws.partners.some((p) => p.name.toLowerCase().includes("socodevi")))) ||
                  (r.id === "commercial" &&
                    (ws.lead_institution?.toLowerCase().includes("nahua") ||
                      ws.partners.some((p) => p.name.toLowerCase().includes("nahua"))));

                return (
                  <div
                    key={r.id}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-2.5 text-xs transition-all",
                      isAdopted
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                        : "border-border/70 bg-card hover:border-primary/40",
                    )}
                  >
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className="font-semibold text-foreground line-clamp-1">
                          {r.title.split(":")[0]}
                        </span>
                        <Badge
                          variant={
                            r.viability === "high"
                              ? "secondary"
                              : r.viability === "conditional"
                                ? "outline"
                                : "destructive"
                          }
                          className="px-1.5 py-0 text-[10px] font-normal"
                        >
                          {r.viability === "high"
                            ? tr("Viable", "Viable")
                            : r.viability === "conditional"
                              ? tr("Conditional", "Condicional")
                              : tr("Blocked", "Bloqueada")}
                        </Badge>
                      </div>
                      <p className="mb-1 font-medium leading-tight text-foreground line-clamp-1">
                        {r.title.split(":")[1]?.trim()}
                      </p>
                      <p className="mb-1.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                        {r.tacticalValue}
                      </p>
                      <div className="text-[10px] text-muted-foreground">
                        <strong>{tr("Lead:", "Líder:")}</strong>{" "}
                        {r.leadEntity.split("(")[0]?.trim()}
                      </div>
                    </div>
                    <div className="mt-2.5 border-t border-border/40 pt-2">
                      {isAdopted ? (
                        <span className="flex items-center justify-center gap-1 py-0.5 text-[11px] font-semibold text-primary">
                          <CheckCircle2 className="h-3 w-3" /> {tr("Active route", "Ruta activa")}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 w-full px-2 text-[11px]"
                          onClick={() => {
                            const next = adoptConsortiumRoute(ws, r, currentOrgName);
                            setWs(next);
                            setDirty(true);
                            toast.success(`${tr("Adopted", "Ruta adoptada:")} ${r.title}`);
                          }}
                        >
                          {tr("Adopt route", "Adoptar ruta")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={tr("Priority", "Prioridad")}>
            <select
              className={selectClass}
              value={ws.priority}
              onChange={(e) => update({ priority: e.target.value as Workspace["priority"] })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel(p, uiLang)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr("Our role", "Nuestro rol")}>
            <select
              className={selectClass}
              value={ws.route ?? ""}
              onChange={(e) => update({ route: (e.target.value || null) as Workspace["route"] })}
            >
              <option value="">{tr("Not decided", "Sin decidir")}</option>
              {ROUTES.map((r) => (
                <option key={r} value={r}>
                  {routeLabel(r, uiLang)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr("Call status", "Estado de la convocatoria")}>
            <select
              className={selectClass}
              value={ws.call_status ?? ""}
              onChange={(e) =>
                update({ call_status: (e.target.value || null) as Workspace["call_status"] })
              }
            >
              <option value="">{tr("Unknown", "Desconocido")}</option>
              {CALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {callStatusLabel(s, uiLang)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr("Lead institution", "Institución líder")}>
            <Input
              value={ws.lead_institution ?? ""}
              placeholder={tr("e.g. Lambton College", "p. ej. Lambton College")}
              onChange={(e) => update({ lead_institution: e.target.value || null })}
            />
          </Field>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-primary">
            {tr(
              "More details (funds administrator, funding type, time, match, verified on)",
              "Más detalles (administrador de fondos, tipo de financiamiento, hora, contrapartida, verificado el)",
            )}
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={tr("Who administers the funds", "Quién administra los fondos")}>
              <Input
                value={ws.administrator ?? ""}
                placeholder={tr(
                  "e.g. the college's research office",
                  "p. ej. la oficina de investigación del college",
                )}
                onChange={(e) => update({ administrator: e.target.value || null })}
              />
            </Field>
            <Field label={tr("Funding type", "Tipo de financiamiento")}>
              <select
                className={selectClass}
                value={ws.instrument ?? ""}
                onChange={(e) =>
                  update({ instrument: (e.target.value || null) as Workspace["instrument"] })
                }
              >
                <option value="">{tr("Unknown", "Desconocido")}</option>
                {INSTRUMENTS.map((i) => (
                  <option key={i} value={i}>
                    {instrumentLabel(i, uiLang)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr("Deadline time", "Hora límite")}>
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
            <Field label={tr("Our contribution (match %)", "Nuestro aporte (% de contrapartida)")}>
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
                  <option value="">{tr("In-kind?", "¿En especie?")}</option>
                  <option value="yes">{tr("In-kind OK", "En especie OK")}</option>
                  <option value="no">{tr("Cash only", "Solo efectivo")}</option>
                </select>
              </div>
            </Field>
            <Field label={tr("Information verified on", "Información verificada el")}>
              <Input
                type="date"
                value={ws.verified_at ?? ""}
                onChange={(e) => update({ verified_at: e.target.value || null })}
              />
            </Field>
          </div>
        </details>
        <div className="mt-3">
          <Field
            label={tr(
              "Blockers (internal — never copied into partner emails)",
              "Bloqueos (internos — nunca se copian en los correos a socios)",
            )}
          >
            <div className="flex flex-wrap gap-1.5">
              {ws.blockers.map((b) => (
                <Badge key={b} variant="outline" className="gap-1">
                  {b}
                  <button
                    type="button"
                    aria-label={tr("Remove", "Quitar")}
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
                placeholder={tr(
                  "e.g. No audited financial statements",
                  "p. ej. No tenemos estados financieros auditados",
                )}
                onChange={(e) => setNewBlocker(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!newBlocker.trim()}
                onClick={() => {
                  if (!ws.blockers.includes(newBlocker.trim()))
                    update({ blockers: [...ws.blockers, newBlocker.trim()] });
                  setNewBlocker("");
                }}
              >
                {tr("Add", "Agregar")}
              </Button>
            </div>
          </Field>
        </div>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3">
            <Field label={tr("Working title", "Título provisional")}>
              <Input
                value={ws.project_title ?? ""}
                placeholder={tr(
                  "e.g. Whole-Chain Integrity for Sustainable Agri-Food Systems",
                  "p. ej. Integridad de toda la cadena para sistemas agroalimentarios sostenibles",
                )}
                onChange={(e) => update({ project_title: e.target.value || null })}
              />
            </Field>
            <Field label={tr("How we use WCIS", "Cómo usamos el WCIS")}>
              <Textarea
                rows={3}
                value={ws.wcis_angle ?? ""}
                placeholder={tr(
                  "WCIS as the applied framework for traceability, integrity and market readiness…",
                  "El WCIS como marco aplicado de trazabilidad, integridad y preparación para el mercado…",
                )}
                onChange={(e) => update({ wcis_angle: e.target.value || null })}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section icon={<Users className="h-4 w-4" />} title={tr("3. Partners", "3. Socios")}>
        {ws.partners.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {tr("No partners yet.", "Aún no hay socios.")}
          </p>
        )}
        <div className="space-y-2">
          {ws.partners.map((p, idx) => (
            <div
              key={p.id}
              className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1.4fr_0.8fr_1.4fr_1fr_1fr_auto]"
            >
              <Input
                value={p.name}
                placeholder={tr("Organization", "Organización")}
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
                placeholder={tr("Country", "País")}
                onChange={(e) =>
                  setPartners(
                    ws.partners.map((x, i) => (i === idx ? { ...x, country: e.target.value } : x)),
                  )
                }
              />
              <Input
                value={p.role ?? ""}
                placeholder={tr(
                  "Role (e.g. administers the grant)",
                  "Rol (p. ej. administra el grant)",
                )}
                onChange={(e) =>
                  setPartners(
                    ws.partners.map((x, i) => (i === idx ? { ...x, role: e.target.value } : x)),
                  )
                }
              />
              <Input
                value={p.contact ?? ""}
                placeholder={tr("Contact", "Contacto")}
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
                {PARTNER_STATUS.map(([v, en, es]) => (
                  <option key={v} value={v}>
                    {tr(en, es)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={tr("Remove partner", "Quitar socio")}
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
          <Plus className="h-4 w-4" /> {tr("Add partner", "Agregar socio")}
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
                toast.success(
                  tr(
                    `${fresh.length} partner(s) added to the directory`,
                    `${fresh.length} socio(s) agregado(s) al directorio`,
                  ),
                );
              }}
            >
              {tr(
                "Save new partners to the directory",
                "Guardar los socios nuevos en el directorio",
              )}
            </Button>
          )}
      </Section>

      <Section
        icon={<CheckCircle2 className="h-4 w-4" />}
        title={tr("4. Documents and dates", "4. Documentos y fechas")}
        hint={tr(`${ready} ready · ${missing} missing`, `${ready} listos · ${missing} faltan`)}
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
                    {tr("critical", "crítico")}
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
                    {checkStatusLabel(s, uiLang)}
                  </option>
                ))}
              </select>
              <Input
                value={c.owner ?? ""}
                placeholder={tr("Owner", "Responsable")}
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
                aria-label={tr("Remove item", "Quitar elemento")}
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
            placeholder={tr("Add a requirement or document", "Agregar un requisito o documento")}
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
            {tr("Add", "Agregar")}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs shadow-2xs"
            onClick={() => {
              const toAdd = missingFromCall(data.grant, ws.checklist, uiLang);
              if (toAdd.length === 0) {
                toast.info(
                  tr(
                    "The list already has everything this call asks for.",
                    "La lista ya tiene todo lo que pide esta convocatoria.",
                  ),
                );
                return;
              }
              setChecklist([...ws.checklist, ...toAdd]);
              toast.success(
                tr(
                  `Added ${toAdd.length} document(s) this call asks for.`,
                  `Se agregaron ${toAdd.length} documento(s) que pide esta convocatoria.`,
                ),
              );
            }}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {tr("Update from the call", "Actualizar según la convocatoria")}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {tr(
              "Adds what this call's own text asks for (concept note, consortium, match…). Removes nothing.",
              "Agrega lo que pide el texto de esta convocatoria (nota conceptual, consorcio, contrapartida…). No quita nada.",
            )}
          </span>
        </div>
        {glossary.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-primary">
              {tr("What these requirements mean", "Qué significan estos requisitos")}
            </summary>
            <div className="mt-2">
              <dl className="space-y-2 text-sm">
                {glossary.map((g) => (
                  <div key={g.term}>
                    <dt className="font-medium">{g.term}</dt>
                    <dd className="text-muted-foreground">{uiLang === "es" ? g.es : g.en}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </details>
        )}
        <div className="mt-4 border-t pt-3">
          <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            {tr("Timeline", "Cronograma")}
          </h4>
          {ws.milestones.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {tr("No milestones.", "Sin hitos.")}{" "}
              {data.grant.deadline && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="px-0"
                  onClick={() =>
                    update({
                      milestones: defaultMilestones(data.grant.deadline, new Date(), uiLang),
                    })
                  }
                >
                  {tr("Build them from the deadline", "Generarlos desde la fecha límite")}
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
        </div>
      </Section>

      {dossierData?.saved && (dossierData.saved.dossier as Dossier).messages?.length ? (
        <details className="rounded-lg border bg-card shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
            {tr("5. More email templates and the memo", "5. Más plantillas de correo y el memo")}
            <span className="ml-2 font-normal text-muted-foreground">
              {tr(
                "the dossier above already has the messages for this call",
                "el dossier de arriba ya tiene los mensajes para esta convocatoria",
              )}
            </span>
          </summary>
          <Section
            icon={<Mail className="h-4 w-4" />}
            title={tr("5. Write", "5. Redactar")}
            hint={tr(
              "Emails never include the internal blockers; the memo does.",
              "Los correos nunca incluyen los bloqueos internos; el memo sí.",
            )}
          >
            <div className="mb-3 inline-flex rounded-lg border bg-muted/30 p-1 text-xs">
              {(
                [
                  ["outreach", tr("Partners and funders", "Socios y financiadores")],
                  ["memo", tr("Memo to Marcelo", "Memo para Marcelo")],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setWriteMode(k)}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-semibold",
                    writeMode === k
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {writeMode === "outreach" ? (
              <>
                {(() => {
                  const partner = ws.partners[partnerIdx] ?? null;
                  const known = partner
                    ? directoryByName.get(partner.name.trim().toLowerCase())
                    : undefined;
                  const orgName =
                    data.orgs.find((o) => o.id === orgId)?.name ??
                    tr("our organization", "nuestra organización");
                  const email = composeOutreach({
                    template,
                    lang,
                    grant: data.grant,
                    workspace: ws,
                    orgName,
                    senderName,
                    partner,
                    recipientName: known?.contact_name ?? undefined,
                    meetingWhen,
                    links: links.split(/[\s,]+/).filter(Boolean),
                    attachments: (attachmentsEdit ?? defaultAttachments(lang))
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                    includeAcademicCredentials,
                  });
                  const isWhatsApp = template === "whatsapp_intro";
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
                              {uiLang === "es" ? TEMPLATE_LABEL[t].es : TEMPLATE_LABEL[t].en}
                            </option>
                          ))}
                        </select>
                        <select
                          className={selectClass}
                          value={lang}
                          aria-label={tr("Recipient's language", "Idioma del destinatario")}
                          onChange={(e) => setLang(e.target.value as Lang)}
                        >
                          <option value="es">{tr("Spanish", "Español")}</option>
                          <option value="en">{tr("English", "Inglés")}</option>
                        </select>
                        {toPartner && (
                          <select
                            className={selectClass}
                            value={partnerIdx}
                            onChange={(e) => setPartnerIdx(Number(e.target.value))}
                          >
                            {ws.partners.length === 0 && (
                              <option value={0}>
                                {tr("No partners yet", "Aún no hay socios")}
                              </option>
                            )}
                            {ws.partners.map((p, i) => (
                              <option key={p.id} value={i}>
                                {p.name || `${tr("Partner", "Socio")} ${i + 1}`}
                              </option>
                            ))}
                          </select>
                        )}
                        <Input
                          value={senderName}
                          placeholder={tr("Sender", "Remitente")}
                          onChange={(e) => setSenderName(e.target.value)}
                        />
                      </div>
                      {toPartner && (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={includeAcademicCredentials}
                            onChange={(e) => setIncludeAcademicCredentials(e.target.checked)}
                            className="rounded border-border"
                          />
                          <span>
                            {tr(
                              "Include Dr. Juan Marcelo Gómez doctoral thesis citation (Henley Business School / Univ. of Reading)",
                              "Incluir la cita de la tesis doctoral del Dr. Juan Marcelo Gómez (Henley Business School / Univ. of Reading)",
                            )}
                          </span>
                        </label>
                      )}
                      {template === "meeting_invite" && (
                        <Input
                          value={meetingWhen}
                          placeholder={tr(
                            "Proposed meeting, e.g. Monday, June 1 at 11:00 (Peru time) on Teams",
                            "Reunión propuesta, p. ej. lunes 1 de junio a las 11:00 (hora de Perú) por Teams",
                          )}
                          onChange={(e) => setMeetingWhen(e.target.value)}
                        />
                      )}
                      {template === "partner_intro" && (
                        <Input
                          value={attachmentsEdit ?? defaultAttachments(lang)}
                          placeholder={tr(
                            "Attachments, separated by commas (leave empty for none)",
                            "Adjuntos, separados por comas (déjelo vacío si no hay)",
                          )}
                          onChange={(e) => setAttachments(e.target.value)}
                        />
                      )}
                      {isWhatsApp && (
                        <Input
                          value={links}
                          placeholder={tr(
                            "Links to share (presentation, website)",
                            "Enlaces para compartir (presentación, sitio web)",
                          )}
                          onChange={(e) => setLinks(e.target.value)}
                        />
                      )}
                      {email.subject && (
                        <div className="text-xs font-semibold">
                          {tr("Subject:", "Asunto:")} {email.subject}
                        </div>
                      )}
                      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
                        {email.body}
                      </pre>
                      {(() => {
                        const phoneDigits = (known?.phone || partner?.contact || "").replace(
                          /\D/g,
                          "",
                        );
                        const waHref =
                          phoneDigits.length >= 8
                            ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(email.body)}`
                            : `https://wa.me/?text=${encodeURIComponent(email.body)}`;

                        return (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    email.subject
                                      ? `${lang === "es" ? "Asunto" : "Subject"}: ${email.subject}\n\n${email.body}`
                                      : email.body,
                                  );
                                  setCopiedEmail(true);
                                  toast.success(
                                    isWhatsApp
                                      ? tr("WhatsApp message copied", "Mensaje de WhatsApp copiado")
                                      : tr("Email copied", "Correo copiado"),
                                  );
                                  setTimeout(() => setCopiedEmail(false), 3000);
                                } catch {
                                  toast.error(
                                    tr(
                                      "Could not copy; select the text instead.",
                                      "No se pudo copiar; seleccione el texto.",
                                    ),
                                  );
                                }
                              }}
                            >
                              {copiedEmail ? (
                                <>
                                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  <span>{tr("Copied! ✓", "¡Copiado! ✓")}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4" />
                                  <span>
                                    {isWhatsApp
                                      ? tr("Copy message", "Copiar mensaje")
                                      : tr("Copy email", "Copiar correo")}
                                  </span>
                                </>
                              )}
                            </Button>
                            {isWhatsApp ? (
                              <Button
                                asChild
                                size="sm"
                                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                              >
                                <a href={waHref} target="_blank" rel="noreferrer">
                                  <MessageCircle className="h-4 w-4" />{" "}
                                  {tr("Open in WhatsApp", "Abrir en WhatsApp")}
                                </a>
                              </Button>
                            ) : (
                              <Button asChild variant="outline" size="sm" className="gap-1.5">
                                <a href={mailto}>
                                  <Mail className="h-4 w-4 text-primary" />{" "}
                                  {tr("Open in email app", "Abrir en la app de correo")}
                                </a>
                              </Button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <Field label={tr("Notes for the memo", "Notas para el memo")}>
                  <Textarea
                    rows={2}
                    value={ws.decision_notes ?? ""}
                    onChange={(e) => update({ decision_notes: e.target.value || null })}
                  />
                </Field>
                {memo && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-semibold">
                      {tr("Subject:", "Asunto:")} {memo.subject}
                    </div>
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
                          await navigator.clipboard.writeText(
                            `${tr("Subject:", "Asunto:")} ${memo.subject}\n\n${memo.body}`,
                          );
                          toast.success(tr("Memo copied", "Memo copiado"));
                        } catch {
                          toast.error(
                            tr(
                              "Could not copy; select the text instead.",
                              "No se pudo copiar; seleccione el texto.",
                            ),
                          );
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" /> {tr("Copy memo", "Copiar memo")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Section>
        </details>
      ) : (
        <Section
          icon={<Mail className="h-4 w-4" />}
          title={tr("5. Write", "5. Redactar")}
          hint={tr(
            "Emails never include the internal blockers; the memo does.",
            "Los correos nunca incluyen los bloqueos internos; el memo sí.",
          )}
        >
          <div className="mb-3 inline-flex rounded-lg border bg-muted/30 p-1 text-xs">
            {(
              [
                ["outreach", tr("Partners and funders", "Socios y financiadores")],
                ["memo", tr("Memo to Marcelo", "Memo para Marcelo")],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setWriteMode(k)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-semibold",
                  writeMode === k
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {writeMode === "outreach" ? (
            <>
              {(() => {
                const partner = ws.partners[partnerIdx] ?? null;
                const known = partner
                  ? directoryByName.get(partner.name.trim().toLowerCase())
                  : undefined;
                const orgName =
                  data.orgs.find((o) => o.id === orgId)?.name ??
                  tr("our organization", "nuestra organización");
                const email = composeOutreach({
                  template,
                  lang,
                  grant: data.grant,
                  workspace: ws,
                  orgName,
                  senderName,
                  partner,
                  recipientName: known?.contact_name ?? undefined,
                  meetingWhen,
                  links: links.split(/[\s,]+/).filter(Boolean),
                  attachments: (attachmentsEdit ?? defaultAttachments(lang))
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                  includeAcademicCredentials,
                });
                const isWhatsApp = template === "whatsapp_intro";
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
                            {uiLang === "es" ? TEMPLATE_LABEL[t].es : TEMPLATE_LABEL[t].en}
                          </option>
                        ))}
                      </select>
                      <select
                        className={selectClass}
                        value={lang}
                        aria-label={tr("Recipient's language", "Idioma del destinatario")}
                        onChange={(e) => setLang(e.target.value as Lang)}
                      >
                        <option value="es">{tr("Spanish", "Español")}</option>
                        <option value="en">{tr("English", "Inglés")}</option>
                      </select>
                      {toPartner && (
                        <select
                          className={selectClass}
                          value={partnerIdx}
                          onChange={(e) => setPartnerIdx(Number(e.target.value))}
                        >
                          {ws.partners.length === 0 && (
                            <option value={0}>{tr("No partners yet", "Aún no hay socios")}</option>
                          )}
                          {ws.partners.map((p, i) => (
                            <option key={p.id} value={i}>
                              {p.name || `${tr("Partner", "Socio")} ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      )}
                      <Input
                        value={senderName}
                        placeholder={tr("Sender", "Remitente")}
                        onChange={(e) => setSenderName(e.target.value)}
                      />
                    </div>
                    {toPartner && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={includeAcademicCredentials}
                          onChange={(e) => setIncludeAcademicCredentials(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span>
                          {tr(
                            "Include Dr. Juan Marcelo Gómez doctoral thesis citation (Henley Business School / Univ. of Reading)",
                            "Incluir la cita de la tesis doctoral del Dr. Juan Marcelo Gómez (Henley Business School / Univ. of Reading)",
                          )}
                        </span>
                      </label>
                    )}
                    {template === "meeting_invite" && (
                      <Input
                        value={meetingWhen}
                        placeholder={tr(
                          "Proposed meeting, e.g. Monday, June 1 at 11:00 (Peru time) on Teams",
                          "Reunión propuesta, p. ej. lunes 1 de junio a las 11:00 (hora de Perú) por Teams",
                        )}
                        onChange={(e) => setMeetingWhen(e.target.value)}
                      />
                    )}
                    {template === "partner_intro" && (
                      <Input
                        value={attachmentsEdit ?? defaultAttachments(lang)}
                        placeholder={tr(
                          "Attachments, separated by commas (leave empty for none)",
                          "Adjuntos, separados por comas (déjelo vacío si no hay)",
                        )}
                        onChange={(e) => setAttachments(e.target.value)}
                      />
                    )}
                    {isWhatsApp && (
                      <Input
                        value={links}
                        placeholder={tr(
                          "Links to share (presentation, website)",
                          "Enlaces para compartir (presentación, sitio web)",
                        )}
                        onChange={(e) => setLinks(e.target.value)}
                      />
                    )}
                    {email.subject && (
                      <div className="text-xs font-semibold">
                        {tr("Subject:", "Asunto:")} {email.subject}
                      </div>
                    )}
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
                      {email.body}
                    </pre>
                    {(() => {
                      const phoneDigits = (known?.phone || partner?.contact || "").replace(
                        /\D/g,
                        "",
                      );
                      const waHref =
                        phoneDigits.length >= 8
                          ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(email.body)}`
                          : `https://wa.me/?text=${encodeURIComponent(email.body)}`;

                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  email.subject
                                    ? `${lang === "es" ? "Asunto" : "Subject"}: ${email.subject}\n\n${email.body}`
                                    : email.body,
                                );
                                setCopiedEmail(true);
                                toast.success(
                                  isWhatsApp
                                    ? tr("WhatsApp message copied", "Mensaje de WhatsApp copiado")
                                    : tr("Email copied", "Correo copiado"),
                                );
                                setTimeout(() => setCopiedEmail(false), 3000);
                              } catch {
                                toast.error(
                                  tr(
                                    "Could not copy; select the text instead.",
                                    "No se pudo copiar; seleccione el texto.",
                                  ),
                                );
                              }
                            }}
                          >
                            {copiedEmail ? (
                              <>
                                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                <span>{tr("Copied! ✓", "¡Copiado! ✓")}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                <span>
                                  {isWhatsApp
                                    ? tr("Copy message", "Copiar mensaje")
                                    : tr("Copy email", "Copiar correo")}
                                </span>
                              </>
                            )}
                          </Button>
                          {isWhatsApp ? (
                            <Button
                              asChild
                              size="sm"
                              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                            >
                              <a href={waHref} target="_blank" rel="noreferrer">
                                <MessageCircle className="h-4 w-4" />{" "}
                                {tr("Open in WhatsApp", "Abrir en WhatsApp")}
                              </a>
                            </Button>
                          ) : (
                            <Button asChild variant="outline" size="sm" className="gap-1.5">
                              <a href={mailto}>
                                <Mail className="h-4 w-4 text-primary" />{" "}
                                {tr("Open in email app", "Abrir en la app de correo")}
                              </a>
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <Field label={tr("Notes for the memo", "Notas para el memo")}>
                <Textarea
                  rows={2}
                  value={ws.decision_notes ?? ""}
                  onChange={(e) => update({ decision_notes: e.target.value || null })}
                />
              </Field>
              {memo && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-semibold">
                    {tr("Subject:", "Asunto:")} {memo.subject}
                  </div>
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
                        await navigator.clipboard.writeText(
                          `${tr("Subject:", "Asunto:")} ${memo.subject}\n\n${memo.body}`,
                        );
                        toast.success(tr("Memo copied", "Memo copiado"));
                      } catch {
                        toast.error(
                          tr(
                            "Could not copy; select the text instead.",
                            "No se pudo copiar; seleccione el texto.",
                          ),
                        );
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" /> {tr("Copy memo", "Copiar memo")}
                  </Button>
                </div>
              )}
            </>
          )}
        </Section>
      )}
    </div>
  );
}

function defaultAttachments(lang: Lang): string {
  return lang === "es"
    ? "la presentación general de IIAL, el documento WCIS"
    : "IIAL's general presentation, the WCIS document";
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

function VerdictBadge({
  verdict,
  tr,
}: {
  verdict: "eligible" | "needs_input" | "not_eligible";
  tr: (en: string, es: string) => string;
}) {
  if (verdict === "eligible")
    return <Badge className="bg-emerald-600 text-[10px]">{tr("Eligible", "Elegible")}</Badge>;
  if (verdict === "needs_input")
    return (
      <Badge variant="outline" className="gap-1 text-[10px] text-amber-700">
        <AlertTriangle className="h-3 w-3" /> {tr("To confirm", "Por confirmar")}
      </Badge>
    );
  return (
    <Badge variant="destructive" className="text-[10px]">
      {tr("Not eligible", "No elegible")}
    </Badge>
  );
}
