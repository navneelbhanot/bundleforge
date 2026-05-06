/**
 * Supported locales (M-186) — single source of truth shared by
 * the Localization settings tab and the dashboard's app-language
 * selector.
 *
 * Adding a locale: add it here, ensure server enum
 * (`src/services/i18n/locales.ts`) matches, and add the human
 * label below.
 */
export const SUPPORTED_LOCALES = [
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
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  nl: "Nederlands",
  pl: "Polski",
  sv: "Svenska",
  da: "Dansk",
  no: "Norsk",
  ru: "Русский",
};

export function localeLabel(code: string): string {
  return (LOCALE_LABELS as Record<string, string>)[code] ?? code;
}
