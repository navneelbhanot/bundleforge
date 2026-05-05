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

export type Locale = "en" | "es" | "fr" | "de" | "it" | "pt";

type Bundle = Record<string, unknown>;

const BUNDLES: Record<Locale, Bundle> = {
  en: en as Bundle,
  es: es as Bundle,
  fr: fr as Bundle,
  de: de as Bundle,
  it: it as Bundle,
  pt: pt as Bundle,
};

export const SUPPORTED_LOCALES: Locale[] = ["en", "es", "fr", "de", "it", "pt"];

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
