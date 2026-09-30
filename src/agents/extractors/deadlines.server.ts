// Deterministic deadline extractor using chrono-node (EN + FR).
// Returns the most likely application deadline as ISO YYYY-MM-DD.

import * as chrono from "chrono-node";
import { windowAround } from "@/agents/evidence.server";

const DEADLINE_HINTS_EN = [
  "deadline",
  "apply by",
  "applications close",
  "closing date",
  "submission deadline",
  "due date",
  "must be received by",
  "no later than",
  "expires",
  "closes on",
];
const DEADLINE_HINTS_FR = [
  "date limite",
  "échéance",
  "avant le",
  "au plus tard",
  "fin de l'appel",
  "clôture",
  "expire",
  "date de clôture",
  "ferme le",
];
const ROLLING_HINTS = [
  "rolling intake",
  "continuous intake",
  "open continuously",
  "accepting applications on an ongoing basis",
  "admission continue",
  "réception continue",
  "en continu",
];

// A month name or a numeric calendar date must appear in the matched text.
const EXPLICIT_DATE =
  /(?:^|[^a-z])(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janv|févr|fevr|mars|avr|mai|juin|juil|août|aout|déc)[a-zéû]*\.?\s*\d|\d\s*(?:er|st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janv|févr|fevr|mars|avr|mai|juin|juil|août|aout|déc)|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/i;

export type DeadlineMatch = {
  iso: string; // YYYY-MM-DD
  snippet: string;
  matchOffset: number;
};

export function extractDeadline(text: string, locale: "en" | "fr" = "en"): DeadlineMatch | null {
  if (!text) return null;
  const hints = [...DEADLINE_HINTS_EN, ...DEADLINE_HINTS_FR];
  const lower = text.toLowerCase();

  // 1. Check for rolling/continuous intake first
  for (const hint of ROLLING_HINTS) {
    const idx = lower.indexOf(hint);
    if (idx !== -1) {
      return {
        iso: "Rolling",
        snippet: windowAround(text, idx, hint.length, 120),
        matchOffset: idx,
      };
    }
  }

  // 2. Find hint positions and parse the nearest date AFTER each hint.
  const candidates: Array<{ date: Date; offset: number }> = [];
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const twoYearsFuture = new Date();
  twoYearsFuture.setFullYear(twoYearsFuture.getFullYear() + 2);

  for (const hint of hints) {
    let idx = 0;
    while ((idx = lower.indexOf(hint, idx)) !== -1) {
      const window = text.slice(idx, Math.min(text.length, idx + 240));
      const parsed =
        locale === "fr"
          ? chrono.fr.parse(window, new Date(), { forwardDate: true })
          : chrono.parse(window, new Date(), { forwardDate: true });
      for (const p of parsed) {
        // Only explicit calendar dates count. Relative phrases ("in 3 minutes",
        // "7 days after completion") resolved to today and became fake deadlines.
        if (!EXPLICIT_DATE.test(p.text)) continue;
        const d = p.date();
        // Allow recent past dates (programs often leave last year's deadline up while preparing the next)
        if (d && d > oneYearAgo && d < twoYearsFuture) {
          candidates.push({ date: d, offset: idx + (p.index ?? 0) });
        }
      }
      idx += hint.length;
    }
  }

  // 3. Pick the earliest non-past date if one exists, otherwise the most recent past date.
  // Compare against start-of-today so a deadline dated today (parsed at 00:00)
  // still counts as "future" regardless of the current time of day.
  if (candidates.length === 0) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const future = candidates
    .filter((c) => c.date >= startOfToday)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = candidates
    .filter((c) => c.date < startOfToday)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const pick = future.length > 0 ? future[0] : past[0];
  // Local calendar date: toISOString() shifted "Oct 17 at 11:59 pm" to Oct 18 UTC.
  const d = pick.date;
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    iso,
    snippet: windowAround(text, pick.offset, 40, 180),
    matchOffset: pick.offset,
  };
}
