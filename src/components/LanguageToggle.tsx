// EN / ES switch in the top bar. The whole interface follows it.
import { setUiLang, useUiLang } from "@/lib/ui-lang";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const lang = useUiLang();
  return (
    <div
      role="group"
      aria-label={lang === "es" ? "Idioma" : "Language"}
      className="inline-flex h-9 items-center rounded-md border bg-background p-0.5 text-xs font-semibold"
    >
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setUiLang(l)}
          className={cn(
            "h-8 rounded px-2 uppercase",
            lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
