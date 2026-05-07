/**
 * Polaris locale loader (M-186 polish — wired in to actually swap
 * the admin UI's language when the merchant changes the dashboard
 * language selector).
 *
 * Polaris ships translation packs at `@shopify/polaris/locales/*.json`.
 * We map our 15 supported locales to the closest Polaris pack and
 * dynamically import it. Russian doesn't ship in Polaris, so it
 * falls back to English with a console.info notice.
 */

/**
 * Map our locale codes to Polaris's locale-pack filenames. The
 * defaults are the obvious matches; the special cases below
 * handle Polaris's regional/variant naming.
 */
const POLARIS_LOCALE_MAP: Record<string, string> = {
  en: "en",
  es: "es",
  fr: "fr",
  de: "de",
  it: "it",
  pt: "pt-BR", // Polaris ships pt-BR + pt-PT; default to Brazilian.
  ja: "ja",
  zh: "zh-CN", // Polaris ships zh-CN + zh-TW; default to simplified.
  ko: "ko",
  nl: "nl",
  pl: "pl",
  sv: "sv",
  da: "da",
  no: "nb", // Norwegian Bokmål.
  ru: "en", // Polaris doesn't ship Russian — fall back to English.
};

export type PolarisI18n = Record<string, unknown>;

const FALLBACK_I18N: PolarisI18n = {
  Polaris: { Common: { cancel: "Cancel", save: "Save" } },
};

/**
 * Resolve the Polaris pack code for a given locale (or "en" if
 * the locale isn't known).
 */
export function polarisCodeFor(locale: string): string {
  return POLARIS_LOCALE_MAP[locale] ?? "en";
}

/**
 * Dynamically import the Polaris translation pack for a locale.
 * Falls back to a tiny inline English object on any error so the
 * admin UI never breaks because of a missing JSON.
 */
export async function loadPolarisLocale(
  locale: string,
): Promise<PolarisI18n> {
  const code = polarisCodeFor(locale);
  try {
    // Vite handles the dynamic import + chunk-splits each pack.
    const mod = await import(
      /* @vite-ignore */
      `@shopify/polaris/locales/${code}.json`
    );
    return (mod.default ?? mod) as PolarisI18n;
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info(
        `[bundleforge] Polaris locale "${code}" failed to load; falling back to English.`,
        err,
      );
    }
    return FALLBACK_I18N;
  }
}

/**
 * Window CustomEvent name dispatched by the dashboard's
 * AppLanguageSelect when the merchant picks a new locale.
 * App.tsx listens for this and reloads the matching Polaris pack.
 */
export const LOCALE_CHANGED_EVENT = "bundleforge:locale-changed";

export interface LocaleChangedDetail {
  locale: string;
}
