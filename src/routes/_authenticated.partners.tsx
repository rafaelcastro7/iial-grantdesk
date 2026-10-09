// Partner directory: the universities, colleges, cooperatives, chambers and
// companies the team works with, reused across application plans.
import { decisionMakerLabel, useTeamSettings } from "@/lib/team-settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Pencil, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deletePartner,
  listPartners,
  savePartner,
  seedDefaultPartners,
  type DirectoryPartner,
} from "@/lib/partner-directory.functions";
import { partnerBrief } from "@/lib/consultant-desk.shared";
import { getOrgProfile } from "@/lib/org.functions";
import { useActiveTenant } from "@/lib/tenant-context";
import { useTr, useUiLang } from "@/lib/ui-lang";

export const Route = createFileRoute("/_authenticated/partners")({
  component: PartnersPage,
});

// Stored value (English) and its Spanish display label.
const TYPES: Array<[string, string]> = [
  ["University", "Universidad"],
  ["College", "College / instituto"],
  ["Research centre", "Centro de investigación"],
  ["Cooperative / producers", "Cooperativa / productores"],
  ["Chamber of commerce", "Cámara de comercio"],
  ["Company", "Empresa"],
  ["Government / agency", "Gobierno / agencia"],
  ["NGO / foundation", "ONG / fundación"],
  ["Other", "Otro"],
];

type Draft = Omit<DirectoryPartner, "id" | "org_id" | "updated_at"> & { id?: string };

const emptyDraft = (): Draft => ({
  name: "",
  country: null,
  type: null,
  contact_name: null,
  contact_title: null,
  email: null,
  phone: null,
  website: null,
  languages: [],
  notes: null,
});

function PartnersPage() {
  const { activeOrgId, activeOrgName } = useActiveTenant();
  const { settings: team } = useTeamSettings(activeOrgId);
  const fetchList = useServerFn(listPartners);
  const save = useServerFn(savePartner);
  const remove = useServerFn(deletePartner);
  const seed = useServerFn(seedDefaultPartners);
  const fetchProfile = useServerFn(getOrgProfile);
  const qc = useQueryClient();
  const tr = useTr();
  const lang = useUiLang();
  const forWhom = decisionMakerLabel(team, lang);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["partner-directory", activeOrgId],
    queryFn: () => fetchList({ data: { orgId: activeOrgId as string } }),
    enabled: !!activeOrgId,
  });

  // Partners named in the active organization's profile (Organization → partner network).
  const { data: profileData } = useQuery({
    queryKey: ["org-profile", activeOrgId],
    queryFn: () => fetchProfile({ data: { orgId: activeOrgId as string } }),
    enabled: !!activeOrgId,
    staleTime: 5 * 60_000,
  });
  const profileNetwork = useMemo(() => {
    const raw = (profileData?.profile as { partner_network?: unknown } | null)?.partner_network;
    if (!Array.isArray(raw)) return [] as string[];
    const seen = new Set<string>();
    return raw.filter((n): n is string => {
      if (typeof n !== "string" || !n.trim()) return false;
      const key = n.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [profileData]);
  const networkCount = profileNetwork.length;

  const partners = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (data?.partners ?? []).filter(
      (p) =>
        !q ||
        [p.name, p.country, p.type, p.contact_name].some((v) =>
          (v ?? "").toLowerCase().includes(q),
        ),
    );
  }, [data, filter]);

  const onSeedRecommended = async () => {
    if (!activeOrgId) return;
    setIsSeeding(true);
    try {
      const res = await seed({ data: { orgId: activeOrgId } });
      toast.success(
        res.addedCount > 0
          ? tr(
              `Added ${res.addedCount} partner(s) from the organization profile to the directory.`,
              `Se agregaron ${res.addedCount} socio(s) del perfil de la organización al directorio.`,
            )
          : tr(
              "The partners listed in the organization profile are already in the directory.",
              "Los socios del perfil de la organización ya están en el directorio.",
            ),
      );
      await qc.invalidateQueries({ queryKey: ["partner-directory", activeOrgId] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(errorText(msg));
    } finally {
      setIsSeeding(false);
    }
  };

  const onSave = async () => {
    if (!draft || !activeOrgId) return;
    try {
      await save({ data: { ...draft, org_id: activeOrgId } });
      toast.success(tr("Partner saved", "Socio guardado"));
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["partner-directory", activeOrgId] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(errorText(msg));
    }
  };

  const errorText = (msg: string) =>
    msg.includes("directory_unavailable")
      ? tr(
          "Needs the database update 20261007120000_partner_directory.sql.",
          "Requiere la actualización de base de datos 20261007120000_partner_directory.sql.",
        )
      : msg.includes("already exists")
        ? tr("A partner with this name already exists.", "Ya existe un socio con este nombre.")
        : msg.startsWith("Forbidden")
          ? tr(
              "You are not a member of this organization.",
              "No eres miembro de esta organización.",
            )
          : msg;

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={tr("Partners", "Socios")}
        title={`${tr("Partner directory", "Directorio de socios")}${activeOrgName ? ` — ${activeOrgName}` : ""}`}
        description={tr(
          "Universities, colleges, cooperatives, chambers and companies you work with. Add them to a grant's consortium from its Application plan.",
          "Universidades, colleges, cooperativas, cámaras y empresas con las que trabajas. Agrégalas al consorcio de un grant desde su Plan de postulación.",
        )}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Input
          className="max-w-xs"
          placeholder={tr("Search name, country, type…", "Buscar nombre, país, tipo…")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="flex items-center gap-2">
          {networkCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onSeedRecommended}
              disabled={!activeOrgId || isSeeding}
              title={`${tr(
                "Partners listed in the organization profile:",
                "Socios listados en el perfil de la organización:",
              )} ${profileNetwork.join(", ")}`}
            >
              <Sparkles className="h-4 w-4 text-primary" />
              {isSeeding
                ? tr("Importing…", "Importando…")
                : tr(
                    `Import the partners listed in our organization profile (${networkCount})`,
                    `Importar los socios del perfil de nuestra organización (${networkCount})`,
                  )}
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setDraft(emptyDraft())}
            disabled={!activeOrgId}
          >
            <Plus className="h-4 w-4" /> {tr("Add partner", "Agregar socio")}
          </Button>
        </div>
      </div>

      {data && !data.available && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {tr(
            "The directory needs the database update 20261007120000_partner_directory.sql.",
            "El directorio necesita la actualización de base de datos 20261007120000_partner_directory.sql.",
          )}
        </p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">{tr("Loading…", "Cargando…")}</p>}
      {error && <p className="text-sm text-destructive">{errorText((error as Error).message)}</p>}

      {draft && (
        <section className="mb-5 space-y-3 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">
            {draft.id ? tr("Edit partner", "Editar socio") : tr("New partner", "Nuevo socio")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              placeholder={tr("Organization name *", "Nombre de la organización *")}
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
            />
            <Input
              placeholder={tr("Country", "País")}
              value={draft.country ?? ""}
              onChange={(e) => set({ country: e.target.value || null })}
            />
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={draft.type ?? ""}
              onChange={(e) => set({ type: e.target.value || null })}
            >
              <option value="">{tr("Type", "Tipo")}</option>
              {TYPES.map(([en, es]) => (
                <option key={en} value={en}>
                  {tr(en, es)}
                </option>
              ))}
            </select>
            <Input
              placeholder={tr("Contact person", "Persona de contacto")}
              value={draft.contact_name ?? ""}
              onChange={(e) => set({ contact_name: e.target.value || null })}
            />
            <Input
              placeholder={tr(
                "Title (e.g. Rector, Research Director)",
                "Cargo (ej. Rector, Director de investigación)",
              )}
              value={draft.contact_title ?? ""}
              onChange={(e) => set({ contact_title: e.target.value || null })}
            />
            <Input
              placeholder={tr("Email", "Correo")}
              value={draft.email ?? ""}
              onChange={(e) => set({ email: e.target.value || null })}
            />
            <Input
              placeholder={tr("Phone / WhatsApp", "Teléfono / WhatsApp")}
              value={draft.phone ?? ""}
              onChange={(e) => set({ phone: e.target.value || null })}
            />
            <Input
              placeholder={tr("Website", "Sitio web")}
              value={draft.website ?? ""}
              onChange={(e) => set({ website: e.target.value || null })}
            />
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={draft.languages[0] ?? ""}
              onChange={(e) => set({ languages: e.target.value ? [e.target.value] : [] })}
            >
              <option value="">{tr("Preferred language", "Idioma preferido")}</option>
              <option value="es">{tr("Spanish", "Español")}</option>
              <option value="en">{tr("English", "Inglés")}</option>
              <option value="fr">{tr("French", "Francés")}</option>
            </select>
          </div>
          <Textarea
            rows={3}
            placeholder={tr(
              "Notes: meetings, interests, what they can bring…",
              "Notas: reuniones, intereses, qué pueden aportar…",
            )}
            value={draft.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value || null })}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} disabled={!draft.name.trim()}>
              {tr("Save", "Guardar")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {tr("Cancel", "Cancelar")}
            </Button>
          </div>
        </section>
      )}

      {data?.available &&
        partners.length === 0 &&
        !draft &&
        (filter.trim() ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
            <p>
              {tr("No partners matching", "No hay socios que coincidan con")} &ldquo;{filter}
              &rdquo;.
            </p>
            <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => setFilter("")}>
              {tr("Clear search filter", "Limpiar búsqueda")}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {tr("Build your Consortium Partner Network", "Arma tu red de socios para consorcios")}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground leading-relaxed">
              {tr(
                networkCount > 0
                  ? "Consortium grants (e.g. with universities, colleges, cooperatives or public agencies) require verified partners. Import the partners listed in your organization profile or add your own."
                  : "Consortium grants (e.g. with universities, colleges, cooperatives or public agencies) require verified partners. Add your own, or list them in your organization profile to import them here.",
                networkCount > 0
                  ? "Los grants en consorcio (ej. con universidades, colleges, cooperativas o agencias públicas) requieren socios verificados. Importa los socios listados en el perfil de tu organización o agrega los tuyos."
                  : "Los grants en consorcio (ej. con universidades, colleges, cooperativas o agencias públicas) requieren socios verificados. Agrega los tuyos, o lístalos en el perfil de tu organización para importarlos aquí.",
              )}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {networkCount > 0 && (
                <Button
                  size="sm"
                  onClick={onSeedRecommended}
                  disabled={!activeOrgId || isSeeding}
                  className="gap-1.5 shadow-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  {isSeeding
                    ? tr("Importing…", "Importando…")
                    : tr(
                        `Import the partners listed in our organization profile (${networkCount})`,
                        `Importar los socios del perfil de nuestra organización (${networkCount})`,
                      )}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraft(emptyDraft())}
                disabled={!activeOrgId}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />{" "}
                {tr("Add partner manually", "Agregar socio manualmente")}
              </Button>
            </div>
          </div>
        ))}

      <div className="grid gap-3 md:grid-cols-2">
        {partners.map((p) => {
          const used = (data?.usage?.[p.name.trim().toLowerCase()] ?? []) as Array<{
            grantId: string;
            title: string;
            role: string | null;
            status: string | null;
          }>;
          return (
            <article key={p.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {[
                      p.type
                        ? tr(p.type, TYPES.find(([en]) => en === p.type)?.[1] ?? p.type)
                        : null,
                      p.country,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`${tr("Copy brief for", "Copiar resumen para")} ${forWhom}`}
                    title={`${tr("Copy a short brief for", "Copiar un resumen breve para")} ${forWhom}`}
                    onClick={async () => {
                      const b = partnerBrief(
                        p,
                        used.map((u) => u.title),
                        { lang, recipient: team.decisionMaker, sender: team.sender },
                      );
                      try {
                        await navigator.clipboard.writeText(
                          `${lang === "es" ? "Asunto" : "Subject"}: ${b.subject}\n\n${b.body}`,
                        );
                        toast.success(tr("Brief copied", "Resumen copiado"));
                      } catch {
                        toast.error(tr("Could not copy", "No se pudo copiar"));
                      }
                    }}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={tr("Edit", "Editar")}
                    onClick={() => setDraft({ ...p })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={tr("Delete", "Eliminar")}
                    onClick={async () => {
                      if (
                        !activeOrgId ||
                        !window.confirm(
                          tr(
                            `Delete ${p.name} from the directory?`,
                            `¿Eliminar ${p.name} del directorio?`,
                          ),
                        )
                      )
                        return;
                      await remove({ data: { id: p.id, orgId: activeOrgId } });
                      await qc.invalidateQueries({ queryKey: ["partner-directory", activeOrgId] });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {(p.contact_name || p.email || p.phone) && (
                <p className="mt-2 text-sm">
                  {[
                    p.contact_name &&
                      `${p.contact_name}${p.contact_title ? `, ${p.contact_title}` : ""}`,
                    p.email,
                    p.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {p.notes && (
                <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{p.notes}</p>
              )}
              {used.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {used
                    .filter((u, i) => used.findIndex((x) => x.grantId === u.grantId) === i)
                    .map((u) => (
                      <Link key={u.grantId} to="/grants/$id" params={{ id: u.grantId }}>
                        <Badge variant="outline" className="font-normal hover:bg-accent">
                          {u.title.slice(0, 40)}
                          {u.status ? ` · ${u.status.replace("_", " ")}` : ""}
                        </Badge>
                      </Link>
                    ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </PageContainer>
  );
}
