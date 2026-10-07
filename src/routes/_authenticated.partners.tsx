// Partner directory: the universities, colleges, cooperatives, chambers and
// companies the team works with, reused across application plans.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
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
  type DirectoryPartner,
} from "@/lib/partner-directory.functions";
import { useActiveTenant } from "@/lib/tenant-context";

export const Route = createFileRoute("/_authenticated/partners")({
  component: PartnersPage,
});

const TYPES = [
  "University",
  "College",
  "Research centre",
  "Cooperative / producers",
  "Chamber of commerce",
  "Company",
  "Government / agency",
  "NGO / foundation",
  "Other",
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
  const fetchList = useServerFn(listPartners);
  const save = useServerFn(savePartner);
  const remove = useServerFn(deletePartner);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["partner-directory", activeOrgId],
    queryFn: () => fetchList({ data: { orgId: activeOrgId as string } }),
    enabled: !!activeOrgId,
  });

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

  const onSave = async () => {
    if (!draft || !activeOrgId) return;
    try {
      await save({ data: { ...draft, org_id: activeOrgId } });
      toast.success("Partner saved");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["partner-directory", activeOrgId] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        msg.includes("directory_unavailable")
          ? "Needs the database update 20261007120000_partner_directory.sql."
          : msg,
      );
    }
  };

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Partners"
        title={`Partner directory${activeOrgName ? ` — ${activeOrgName}` : ""}`}
        description="Universities, colleges, cooperatives, chambers and companies you work with. Add them to a grant's consortium from its Application plan."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search name, country, type…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setDraft(emptyDraft())}
          disabled={!activeOrgId}
        >
          <Plus className="h-4 w-4" /> Add partner
        </Button>
      </div>

      {data && !data.available && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          The directory needs the database update 20261007120000_partner_directory.sql.
        </p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {draft && (
        <section className="mb-5 space-y-3 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">{draft.id ? "Edit partner" : "New partner"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              placeholder="Organization name *"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
            />
            <Input
              placeholder="Country"
              value={draft.country ?? ""}
              onChange={(e) => set({ country: e.target.value || null })}
            />
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={draft.type ?? ""}
              onChange={(e) => set({ type: e.target.value || null })}
            >
              <option value="">Type</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Input
              placeholder="Contact person"
              value={draft.contact_name ?? ""}
              onChange={(e) => set({ contact_name: e.target.value || null })}
            />
            <Input
              placeholder="Title (e.g. Rector, Research Director)"
              value={draft.contact_title ?? ""}
              onChange={(e) => set({ contact_title: e.target.value || null })}
            />
            <Input
              placeholder="Email"
              value={draft.email ?? ""}
              onChange={(e) => set({ email: e.target.value || null })}
            />
            <Input
              placeholder="Phone / WhatsApp"
              value={draft.phone ?? ""}
              onChange={(e) => set({ phone: e.target.value || null })}
            />
            <Input
              placeholder="Website"
              value={draft.website ?? ""}
              onChange={(e) => set({ website: e.target.value || null })}
            />
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={draft.languages[0] ?? ""}
              onChange={(e) => set({ languages: e.target.value ? [e.target.value] : [] })}
            >
              <option value="">Preferred language</option>
              <option value="es">Spanish</option>
              <option value="en">English</option>
              <option value="fr">French</option>
            </select>
          </div>
          <Textarea
            rows={3}
            placeholder="Notes: meetings, interests, what they can bring…"
            value={draft.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value || null })}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} disabled={!draft.name.trim()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {data?.available && partners.length === 0 && !draft && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-6 w-6" /> No partners yet.
        </div>
      )}

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
                    {[p.type, p.country].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit"
                    onClick={() => setDraft({ ...p })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete"
                    onClick={async () => {
                      if (!activeOrgId || !window.confirm(`Delete ${p.name} from the directory?`))
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
                  {used.map((u) => (
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
