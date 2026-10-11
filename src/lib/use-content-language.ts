import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useActiveTenant } from "./tenant-context";
import { useUiLang } from "./ui-lang";
import { contentTag } from "./content-language.shared";
import { translateDisplayContent } from "./content-language.functions";

/** Batches visible prose; never renders the previous language while switching. */
export function useContentLanguage(values: Array<string | null | undefined>, sourceLang = "en") {
  const lang = useUiLang();
  const { activeOrgId } = useActiveTenant();
  const translate = useServerFn(translateDisplayContent);
  const needsTranslation = sourceLang !== lang;
  const strings = [...new Set(values.filter((v): v is string => !!v?.trim()))];
  const texts = strings.filter((s) => !contentTag(s, lang) && !/^https?:\/\/\S+$/.test(s));
  const query = useQuery({
    queryKey: ["display-translation", activeOrgId, lang, texts],
    enabled: needsTranslation && !!activeOrgId && texts.length > 0,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!activeOrgId) throw new Error("No active organization");
      // Bounded batches also handle unusually long grant requirement lists.
      const output: string[] = [];
      let batch: string[] = [];
      let size = 0;
      const flush = async () => {
        if (!batch.length) return;
        const result = await translate({ data: { orgId: activeOrgId, lang, texts: batch } });
        output.push(...result.texts);
        batch = [];
        size = 0;
      };
      for (const text of texts) {
        if (batch.length >= 80 || size + text.length > 24000) await flush();
        batch.push(text);
        size += text.length;
      }
      await flush();
      return output;
    },
  });
  const localized = new Map(texts.map((s, i) => [s, query.data?.[i]]));
  return {
    text: (value: string | null | undefined): string => {
      if (!value) return "";
      const tag = contentTag(value, lang);
      if (tag) return tag;
      if (!needsTranslation || /^https?:\/\/\S+$/.test(value)) return value;
      return localized.get(value) ?? (query.isError
        ? (lang === "es" ? "Traducción no disponible" : "Translation unavailable")
        : (lang === "es" ? "Traduciendo…" : "Translating…"));
    },
    error: query.isError,
    loading: needsTranslation && !query.data && !query.isError && texts.length > 0,
  };
}