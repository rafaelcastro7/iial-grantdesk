import i18n from "./index";
import { getUiLang } from "@/lib/ui-lang";

// Keep i18next and <html lang> on the language chosen in the top bar.
export function syncClientLocale() {
  if (typeof window === "undefined") return;
  const lang = getUiLang();
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}
