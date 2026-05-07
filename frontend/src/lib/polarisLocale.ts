/**
 * Polaris locale loader (M-186 polish — wired in to actually swap
 * the admin UI's language when the merchant changes the dashboard
 * language selector).
 *
 * Each Polaris pack is statically imported so Vite bundles them at
 * build time. A dynamic-import-with-template-literal approach
 * fails in production because Vite can't analyse the path; the
 * static-map approach is bulletproof and the total cost is ~14
 * locale JSONs × ~10 KB each = ~140 KB raw / ~50 KB gzipped, which
 * is acceptable for an admin-only bundle.
 *
 * Russian falls back to English — Polaris doesn't ship Russian.
 */
import enPack from "@shopify/polaris/locales/en.json";
import esPack from "@shopify/polaris/locales/es.json";
import frPack from "@shopify/polaris/locales/fr.json";
import dePack from "@shopify/polaris/locales/de.json";
import itPack from "@shopify/polaris/locales/it.json";
import ptBrPack from "@shopify/polaris/locales/pt-BR.json";
import jaPack from "@shopify/polaris/locales/ja.json";
import zhCnPack from "@shopify/polaris/locales/zh-CN.json";
import koPack from "@shopify/polaris/locales/ko.json";
import nlPack from "@shopify/polaris/locales/nl.json";
import plPack from "@shopify/polaris/locales/pl.json";
import svPack from "@shopify/polaris/locales/sv.json";
import daPack from "@shopify/polaris/locales/da.json";
import nbPack from "@shopify/polaris/locales/nb.json";

export type PolarisI18n = Record<string, unknown>;

/**
 * Map our supported locale codes to Polaris's bundled packs. The
 * regional variants (pt-BR, zh-CN, nb) match Polaris's filenames;
 * Russian has no Polaris pack and falls back to English.
 */
const POLARIS_PACKS: Record<string, PolarisI18n> = {
  en: enPack as PolarisI18n,
  es: esPack as PolarisI18n,
  fr: frPack as PolarisI18n,
  de: dePack as PolarisI18n,
  it: itPack as PolarisI18n,
  pt: ptBrPack as PolarisI18n, // pt → Brazilian Portuguese
  ja: jaPack as PolarisI18n,
  zh: zhCnPack as PolarisI18n, // zh → Simplified Chinese
  ko: koPack as PolarisI18n,
  nl: nlPack as PolarisI18n,
  pl: plPack as PolarisI18n,
  sv: svPack as PolarisI18n,
  da: daPack as PolarisI18n,
  no: nbPack as PolarisI18n, // no → Norwegian Bokmål
  ru: enPack as PolarisI18n, // No Russian pack → fall back to English
};

/**
 * Resolve the canonical Polaris pack code for a given locale (or
 * "en" when the locale isn't supported). Returns the actual pack
 * name (e.g. "pt-BR") so callers can log accurate fallback info.
 */
export function polarisCodeFor(locale: string): string {
  const codeMap: Record<string, string> = {
    en: "en",
    es: "es",
    fr: "fr",
    de: "de",
    it: "it",
    pt: "pt-BR",
    ja: "ja",
    zh: "zh-CN",
    ko: "ko",
    nl: "nl",
    pl: "pl",
    sv: "sv",
    da: "da",
    no: "nb",
    ru: "en",
  };
  return codeMap[locale] ?? "en";
}

/**
 * Resolve the Polaris i18n pack for a given locale. Returns
 * synchronously — callers wrap in Promise.resolve() so the
 * existing async signature still works for any future swap to
 * dynamic loading.
 */
export function loadPolarisLocaleSync(locale: string): PolarisI18n {
  return POLARIS_PACKS[locale] ?? POLARIS_PACKS.en;
}

/**
 * Async wrapper kept for backwards compatibility with App.tsx's
 * existing useEffect chain.
 */
export async function loadPolarisLocale(
  locale: string,
): Promise<PolarisI18n> {
  return loadPolarisLocaleSync(locale);
}

/**
 * Window CustomEvent name dispatched by the dashboard's
 * AppLanguageSelect when the merchant picks a new locale.
 * App.tsx listens for this and swaps the matching Polaris pack.
 */
export const LOCALE_CHANGED_EVENT = "bundleforge:locale-changed";

export interface LocaleChangedDetail {
  locale: string;
}
