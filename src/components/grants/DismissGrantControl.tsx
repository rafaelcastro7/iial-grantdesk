import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EyeOff, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { dismissGrant, restoreGrant } from "@/lib/grants.functions";
import { useTr, useUiLang } from "@/lib/ui-lang";

const REASONS = [
  { value: "loan_not_grant", label: "It's a loan, not a grant" },
  { value: "outside_field", label: "Outside our field" },
  { value: "too_small", label: "Too small to be worth it" },
  { value: "not_eligible", label: "We are not eligible" },
  { value: "other", label: "Other reason" },
] as const;
const REASON_ES: Record<string, string> = {
  loan_not_grant: "Es un préstamo, no un grant",
  outside_field: "Fuera de nuestro campo",
  too_small: "Demasiado pequeño para que valga la pena",
  not_eligible: "No somos elegibles",
  other: "Otro motivo",
};
type Reason = (typeof REASONS)[number]["value"];

/** Lets a consultant take a grant off their list, with a reason, and undo it. */
export function DismissGrantControl({
  grantId,
  defaultReason = "outside_field",
}: {
  grantId: string;
  defaultReason?: Reason;
}) {
  const tr = useTr();
  const lang = useUiLang();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>(defaultReason);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismiss = useServerFn(dismissGrant);
  const restore = useServerFn(restoreGrant);
  const qc = useQueryClient();

  const act = async (fn: () => Promise<unknown>, next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setDismissed(next);
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["grants"] });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        /grant_dismissals|schema cache|does not exist/i.test(message)
          ? tr(
              "Not available yet: the database update that enables it has not been applied.",
              "Aún no disponible: no se ha aplicado la actualización de la base de datos que lo habilita.",
            )
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  if (dismissed) {
    return (
      <div className="rounded-md border bg-background p-3 text-xs">
        <p className="font-medium">
          {tr(
            "Marked as not relevant — removed from your list.",
            "Marcado como no relevante — quitado de tu lista.",
          )}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 h-7 px-2"
          disabled={busy}
          onClick={() => act(() => restore({ data: { grantId } }), false)}
        >
          <Undo2 className="mr-1 h-3.5 w-3.5" /> {tr("Undo", "Deshacer")}
        </Button>
      </div>
    );
  }

  return (
    <div className="text-xs">
      {!open ? (
        <Button variant="ghost" size="sm" className="w-full gap-2" onClick={() => setOpen(true)}>
          <EyeOff className="h-4 w-4" />{" "}
          {tr("Not relevant for us", "No es relevante para nosotros")}
        </Button>
      ) : (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <label className="block font-medium" htmlFor={`dismiss-${grantId}`}>
            {tr("Why is it not relevant?", "¿Por qué no es relevante?")}
          </label>
          <select
            id={`dismiss-${grantId}`}
            className="h-9 w-full rounded border bg-background px-2"
            value={reason}
            onChange={(e) => setReason(e.target.value as Reason)}
          >
            {REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {lang === "es" ? REASON_ES[item.value] : item.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => act(() => dismiss({ data: { grantId, reason } }), true)}
            >
              {tr("Remove from my list", "Quitar de mi lista")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {tr("Cancel", "Cancelar")}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-rose-600">{error}</p>}
    </div>
  );
}
