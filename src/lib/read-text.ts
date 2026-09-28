/**
 * Turns the raw page dump behind "What we read from their page" into something
 * a consultant can scan: one block per source page, site chrome removed, HTML
 * entities decoded, short title-like lines promoted to headings.
 * Pure and deterministic — nothing is summarised or rewritten.
 */

export type ReadBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export type ReadSource = { url: string | null; host: string | null; title: string | null; blocks: ReadBlock[] };

const NOISE = new Set(
  [
    "language selection", "français", "francais", "english", "fr", "en", "search", "menu",
    "gouvernement du canada", "government of canada", "skip to main content", "skip to content",
    "share this page", "print", "top of page", "date modified:", "report a problem on this page",
    "you are here:", "home", "contact us", "sign in", "breadcrumb",
  ],
);

function decode(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    [...url.searchParams.keys()].filter((k) => k.startsWith("utm_")).forEach((k) => url.searchParams.delete(k));
    return url.toString();
  } catch {
    return raw.trim();
  }
}

function isJunk(line: string): boolean {
  const lower = line.toLowerCase();
  if (NOISE.has(lower)) return true;
  if (line.length <= 2) return true;
  // Leaked script/JSON fragments.
  if (/[{}]|\\"|":"/.test(line) && !/[.!?]\s/.test(line)) return true;
  return false;
}

function isHeading(line: string): boolean {
  return line.length <= 80 && !/[.:;,]$/.test(line) && line.split(" ").length <= 10 && /^[\p{Lu}0-9]/u.test(line);
}

const BULLET = /^[-•*·▪◦]\s+|^\d+[.)]\s+/;

function toBlocks(lines: string[]): ReadBlock[] {
  const blocks: ReadBlock[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const last = blocks[blocks.length - 1];
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, "");
      if (last?.type === "list") last.items.push(item);
      else blocks.push({ type: "list", items: [item] });
    } else if (isHeading(line)) {
      blocks.push({ type: "heading", text: line });
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }
  return blocks;
}

export function structureReadText(raw: string): ReadSource[] {
  const parts = raw.split(/^===\s*(.+?)\s*===\s*$/m);
  const sources: ReadSource[] = [];
  const push = (url: string | null, body: string) => {
    const lines = body.split(/\r?\n/).map(decode).filter((l) => l && !isJunk(l));
    if (lines.length === 0) return;
    let title: string | null = null;
    if (lines[0] && lines[0].includes(" - ")) title = lines.shift()!.split(" - ")[0]!.trim();
    const clean = url ? cleanUrl(url) : null;
    let host: string | null = null;
    try { host = clean ? new URL(clean).hostname.replace(/^www\./, "") : null; } catch { host = null; }
    const blocks = toBlocks(lines);
    if (title && blocks[0]?.type === "heading" && blocks[0].text === title) blocks.shift();
    sources.push({ url: clean, host, title, blocks });
  };
  if (parts.length === 1) push(null, raw);
  else {
    if (parts[0]?.trim()) push(null, parts[0]);
    for (let i = 1; i < parts.length; i += 2) push(parts[i] ?? null, parts[i + 1] ?? "");
  }
  return sources;
}
