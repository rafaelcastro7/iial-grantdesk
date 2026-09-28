import { useMemo, useState } from "react";
import { structureReadText } from "@/lib/read-text";

type Props = {
  text: string;
  existing: string[];
  disabled: boolean;
  onAddSection: (label: string) => void;
};

export function ReadTextView({ text, existing, disabled, onAddSection }: Props) {
  const sources = useMemo(() => structureReadText(text), [text]);
  const [query, setQuery] = useState("");
  const [raw, setRaw] = useState(false);
  const taken = new Set(existing.map((e) => e.toLowerCase()));
  const q = query.trim().toLowerCase();

  const mark = (value: string) => {
    if (!q) return value;
    const i = value.toLowerCase().indexOf(q);
    if (i < 0) return value;
    return (
      <>
        {value.slice(0, i)}
        <mark className="rounded bg-[var(--color-accent,#fde68a)]/40 px-0.5">{value.slice(i, i + q.length)}</mark>
        {value.slice(i + q.length)}
      </>
    );
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find in page (e.g. eligible, deadline, budget)"
          aria-label="Find in page"
          className="min-w-64 flex-1 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setRaw((v) => !v)}
          className="rounded-md border border-[var(--color-rule)] px-3 py-2 text-xs"
        >
          {raw ? "Show tidy view" : "Show raw text"}
        </button>
      </div>

      {raw ? (
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] p-4 text-xs">
          {text}
        </pre>
      ) : (
        sources.map((source, s) => {
          const blocks = q
            ? source.blocks.filter((b) =>
                (b.type === "list" ? b.items.join(" ") : b.text).toLowerCase().includes(q),
              )
            : source.blocks;
          return (
            <article
              key={s}
              className="overflow-hidden rounded-md border border-[var(--color-rule)] bg-[var(--color-surface)]"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-rule)] px-4 py-3">
                <h3 className="text-sm font-semibold">{source.title ?? source.host ?? "Their page"}</h3>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--color-ink-soft)] underline"
                  >
                    {source.host} ↗
                  </a>
                )}
              </header>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto px-4 py-3 text-sm leading-relaxed">
                {blocks.length === 0 && (
                  <p className="text-[var(--color-ink-soft)]">Nothing matches “{query}” on this page.</p>
                )}
                {blocks.map((block, i) => {
                  if (block.type === "heading") {
                    const added = taken.has(block.text.toLowerCase());
                    return (
                      <div key={i} className="group flex items-center justify-between gap-3 pt-2">
                        <h4 className="font-semibold">{mark(block.text)}</h4>
                        <button
                          type="button"
                          disabled={disabled || added}
                          onClick={() => onAddSection(block.text)}
                          className="shrink-0 rounded border border-[var(--color-rule)] px-2 py-0.5 text-xs opacity-70 group-hover:opacity-100 disabled:opacity-40"
                        >
                          {added ? "Added" : "+ Use as section"}
                        </button>
                      </div>
                    );
                  }
                  if (block.type === "list") {
                    return (
                      <ul key={i} className="list-disc space-y-1 pl-5">
                        {block.items.map((item, j) => (
                          <li key={j}>{mark(item)}</li>
                        ))}
                      </ul>
                    );
                  }
                  return <p key={i}>{mark(block.text)}</p>;
                })}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
