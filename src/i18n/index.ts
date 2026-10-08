import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";
import { getUiLang, onUiLangChange } from "@/lib/ui-lang";

// English and Spanish; the language follows the top-bar toggle (src/lib/ui-lang.ts).
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: getUiLang(),
    fallbackLng: "en",
    supportedLngs: ["en", "es"],
    interpolation: { escapeValue: false },
  });
}

// Changing the toggle switches i18next too.
onUiLangChange(() => void i18n.changeLanguage(getUiLang()));

export default i18n;
