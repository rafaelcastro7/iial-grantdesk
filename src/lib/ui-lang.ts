// Interface language (English / Spanish), chosen by the user with the toggle
// in the top bar and remembered in this browser. Everything on screen follows
// it: labels, messages, generated texts and dates.
//
// Usage in components:  const tr = useTr();  tr("Find grants", "Buscar grants")
// Usage in pure code:   pass `lang` and use pick(lang, "English", "Español").
import { useSyncExternalStore } from "react";

export type UiLang = "en" | "es";
export const UI_LANGS: UiLang[] = ["en", "es"];
const KEY = "iial.lang";
const listeners = new Set<() => void>();

function read(): UiLang {
  if (typeof window === "undefined") return "en";
  try {
    return window.localStorage.getItem(KEY) === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

let current: UiLang = read();

export function getUiLang(): UiLang {
  return current;
}

export function setUiLang(lang: UiLang) {
  current = lang;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, lang);
    } catch {
      /* storage unavailable */
    }
    document.documentElement.lang = lang;
  }
  listeners.forEach((l) => l());
}

/** Run `cb` whenever the language changes (used to keep i18next in sync). */
export function onUiLangChange(cb: () => void): () => void {
  return subscribe(cb);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Current interface language; the server render is English, the client switches after hydration. */
export function useUiLang(): UiLang {
  return useSyncExternalStore(subscribe, getUiLang, () => "en");
}

export function pick(lang: UiLang, en: string, es: string): string {
  return lang === "es" ? es : en;
}

/** `tr("English", "Español")` in the user's language. */
export function useTr() {
  const lang = useUiLang();
  return (en: string, es: string) => (lang === "es" ? es : en);
}

/** Locale for dates and numbers. */
export function localeOf(lang: UiLang): string {
  return lang === "es" ? "es-ES" : "en-CA";
}
