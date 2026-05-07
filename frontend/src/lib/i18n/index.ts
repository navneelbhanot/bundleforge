/**
 * Frontend admin i18n (M-188).
 *
 * Initialises i18next with all 15 supported locales statically
 * imported. Source of truth is `en.json`; missing keys fall back
 * to the key string itself (so untranslated surfaces render as
 * recognisable English-ish text rather than "undefined").
 *
 * Initial language is read SYNCHRONOUSLY from localStorage (the
 * same `bundleforge:polaris-locale` key M-186 uses) so the very
 * first paint is in the merchant's chosen language — no fetch
 * race with App Bridge's session-token handshake.
 *
 * Use `useTranslation()` from `react-i18next` in components:
 *
 *     const { t } = useTranslation();
 *     return <Page title={t("dashboard.title")} ... />;
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

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

const LOCALE_CACHE_KEY = "bundleforge:polaris-locale";

function readCachedLocale(): string {
  try {
    return window.localStorage.getItem(LOCALE_CACHE_KEY) ?? "en";
  } catch {
    return "en";
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    it: { translation: it },
    pt: { translation: pt },
    ja: { translation: ja },
    zh: { translation: zh },
    ko: { translation: ko },
    nl: { translation: nl },
    pl: { translation: pl },
    sv: { translation: sv },
    da: { translation: da },
    no: { translation: no },
    ru: { translation: ru },
  },
  lng: readCachedLocale(),
  fallbackLng: "en",
  interpolation: {
    // React already escapes; double-escape would break ampersands etc.
    escapeValue: false,
  },
  // When a key isn't translated in the chosen locale AND not in
  // English, fall back to the key string itself rather than
  // returning undefined. Keeps the UI from showing blank labels.
  returnNull: false,
  parseMissingKeyHandler: (key) => key,
});

export { i18n };
export default i18n;
