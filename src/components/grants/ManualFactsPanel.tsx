import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, PencilLine, SearchX, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setGrantManualField } from "@/lib/grants.functions";

type FieldKey =
  | "amount_cad_min"
  | "amount_cad_max"
  | "deadline"
  | "eligibility_note"
  | "sectors"
  | "applicant_types";
type Kind = "amount" | "date" | "text" | "list";

type SearchStatus = Record<string, { status?: string; checked_at?: string } | undefined>;
type ManualFields = Record<string, { at?: string; note?: string | null } | undefined>;

export type ManualFactsGrant = {
  id: string;
  amount_cad_min: number | null;
  amount_cad_max: number | null;
  deadline: string | null;
  eligibility_note?: string | null;
  sectors: string[] | null;
  applicant_types?: string[] | null;
  enriched_at: string | null;
  manual_fields?: ManualFields | null;
  field_search_status?: SearchStatus | null;
};

const FIELDS: Array<{ key: FieldKey; label: string; kind: Kind; searchKey: string }> = [
  {
    key: "amount_cad_max",
    label: "Maximum amount (CAD)",
    kind: "amount",
    searchKey: "amount_cad_max",
  },
  {
    key: "amount_cad_min",
    label: "Minimum amount (CAD)",
    kind: "amount",
    searchKey: "amount_cad_min",
  },
  { key: "deadline", label: "Deadline", kind: "date", searchKey: "deadline" },
  { key: "eligibility_note", label: "Who can apply", kind: "text", searchKey: "eligibility" },
  { key: "applicant_types", label: "Applicant types", kind: "list", searchKey: "eligibility" },
  { key: "sectors", label: "Sectors", kind: "list", searchKey: "sectors" },
];

function display(kind: Kind, value: unknown): string | null {
  if (value == null) return null;
  if (kind === "list") return Array.isArray(value) && value.length ? value.join(", ") : null;
  if (kind === "amount") {
    return new Intl.NumberFormat("en-CA", {
      currency: "CAD",
      maximumFractionDigits: 0,
      style: "currency",
    }).format(Number(value));
  }
  const text = String(value).trim();
  return text || null;
}

function day(iso?: string) {
  return iso ? iso.slice(0, 10) : "";
}

/**
 * Every key fact with its provenance: found automatically, searched but not
 * found on the official sources, or entered by a person. Missing facts can be
 * completed by hand; enrichment never overwrites a hand-entered value.
 */
export function ManualFactsPanel({ grant }: { grant: ManualFactsGrant }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(setGrantManualField);
  const qc = useQueryClient();

  const manual = grant.manual_fields ?? {};
  const status = grant.field_search_status ?? {};
  const values: Record<FieldKey, unknown> = {
    amount_cad_min: grant.amount_cad_min,
    amount_cad_max: grant.amount_cad_max,
    deadline: grant.deadline,
    eligibility_note: grant.eligibility_note ?? null,
    applicant_types: grant.applicant_types ?? null,
    sectors: grant.sectors,
  };

  const start = (key: FieldKey, kind: Kind) => {
    const current = values[key];
    setDraft(
      current == null
        ? ""
        : kind === "list" && Array.isArray(current)
          ? current.join(", ")
          : String(current),
    );
    setError(null);
    setEditing(key);
  };

  const submit = async (key: FieldKey, kind: Kind) => {
    const raw = draft.trim();
    let value: number | string | string[] | null = null;
    if (raw) {
      if (kind === "amount") {
        const n = Number(raw.replace(/[$,\s]/g, ""));
        if (!Number.isFinite(n) || n < 0) return setError("Enter a number, e.g. 50000");
        value = n;
      } else if (kind === "date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return setError("Use YYYY-MM-DD");
        value = raw;
      } else if (kind === "list") {
        value = raw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      } else {
        value = raw;
      }
    }
    setSaving(true);
    try {
      await save({ data: { grantId: grant.id, field: key, value } });
      await qc.invalidateQueries({ queryKey: ["grant-detail", grant.id] });
      setEditing(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // The database function arrives with a migration; until it is applied the
      // API reports it missing from the schema cache.
      setError(
        /set_grant_manual_field|schema cache|Could not find the function/i.test(message)
          ? "Editing is not available yet: the database update that enables it has not been applied. Ask an admin to apply pending migrations in Lovable."
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  const missingCount = FIELDS.filter(({ key, kind }) => !display(kind, values[key])).length;

  return (
    <section className="rounded-md border bg-background">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`grant-facts-${grant.id}`}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold">Grant facts</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {missingCount === 0
              ? "All key facts are filled in."
              : `${missingCount} of ${FIELDS.length} missing — open to review or complete them.`}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={`grant-facts-${grant.id}`} className="border-t px-4 pb-4">
          <p className="mt-3 text-xs text-muted-foreground">
            Hand-entered values are never overwritten by the automatic search.
          </p>
          <ul className="mt-2 divide-y">
            {FIELDS.map(({ key, label, kind, searchKey }) => {
              const shown = display(kind, values[key]);
              const byPerson = manual[key];
              const notFound = !shown && status[searchKey]?.status === "not_found";
              return (
                <li key={key} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-muted-foreground">{label}</div>
                      {editing === key ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Input
                            autoFocus
                            aria-label={label}
                            className="h-8 w-64 max-w-full"
                            type={kind === "date" ? "date" : "text"}
                            inputMode={kind === "amount" ? "numeric" : undefined}
                            placeholder={kind === "list" ? "Comma-separated" : undefined}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                          />
                          <Button size="sm" disabled={saving} onClick={() => submit(key, kind)}>
                            <Check className="mr-1 h-3.5 w-3.5" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            <X className="mr-1 h-3.5 w-3.5" /> Cancel
                          </Button>
                          {error && <span className="text-xs text-rose-600">{error}</span>}
                        </div>
                      ) : (
                        <div className="mt-0.5 text-sm">
                          {shown ?? (
                            <span className="text-muted-foreground">
                              {notFound
                                ? "Not found"
                                : grant.enriched_at
                                  ? "Not published"
                                  : "Not searched yet"}
                            </span>
                          )}
                        </div>
                      )}
                      {byPerson ? (
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-400">
                          <UserRound className="h-3 w-3" /> Entered by a person on{" "}
                          {day(byPerson.at)}
                        </div>
                      ) : notFound ? (
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                          <SearchX className="h-3 w-3" /> Searched the official sources on{" "}
                          {day(status[searchKey]?.checked_at)} and did not find it — you can add it.
                        </div>
                      ) : null}
                    </div>
                    {editing !== key && (
                      <Button size="sm" variant="outline" onClick={() => start(key, kind)}>
                        <PencilLine className="mr-1 h-3.5 w-3.5" /> {shown ? "Edit" : "Add"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
