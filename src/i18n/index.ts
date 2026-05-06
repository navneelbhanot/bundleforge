/**
 * Tiny in-house i18n (M-131).
 *
 * Loads JSON locale files from `./locales/<code>.json` and resolves
 * dotted keys with `{var}` interpolation. Falls back to English when
 * the requested locale is missing.
 */
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import it from "./locales/it.json";
import pt from "./locales/pt.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import ko from "./locales/ko.json";
import nl from "./locales/nl.json";
import pl from "./locales/pl.json";
import sv from "./locales/sv.json";
import da from "./locales/da.json";
import no from "./locales/no.json";
import ru from "./locales/ru.json";

export type Locale =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "ja"
  | "zh"
  | "ko"
  | "nl"
  | "pl"
  | "sv"
  | "da"
  | "no"
  | "ru";

type Bundle = Record<string, unknown>;

const BUNDLES: Record<Locale, Bundle> = {
  en: en as Bundle,
  es: es as Bundle,
  fr: fr as Bundle,
  de: de as Bundle,
  it: it as Bundle,
  pt: pt as Bundle,
  ja: ja as Bundle,
  zh: zh as Bundle,
  ko: ko as Bundle,
  nl: nl as Bundle,
  pl: pl as Bundle,
  sv: sv as Bundle,
  da: da as Bundle,
  no: no as Bundle,
  ru: ru as Bundle,
};

export const SUPPORTED_LOCALES: Locale[] = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ja",
  "zh",
  "ko",
  "nl",
  "pl",
  "sv",
  "da",
  "no",
  "ru",
];

function lookup(bundle: Bundle, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = bundle;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const v = vars[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}

export function t(
  key: string,
  vars: Record<string, string | number> = {},
  locale: Locale = "en",
): string {
  const found =
    lookup(BUNDLES[locale] ?? BUNDLES.en, key) ??
    lookup(BUNDLES.en, key);
  if (found === undefined) return key;
  return interpolate(found, vars);
}

export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) return "en";
  const head = value.toLowerCase().split(/[-_]/, 1)[0];
  return (SUPPORTED_LOCALES as string[]).includes(head)
    ? (head as Locale)
    : "en";
}
