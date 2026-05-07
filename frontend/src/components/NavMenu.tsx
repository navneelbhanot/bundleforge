/**
 * App Bridge v4 navigation menu.
 *
 * Renders the merchant's Shopify-native left-sidebar nav (the items
 * that appear nested under "BundleForge" in admin.shopify.com) via
 * the <ui-nav-menu> web component. The component is registered by
 * the App Bridge CDN script loaded from `index.html`.
 *
 * App Bridge expects plain <a href="...">: it intercepts clicks,
 * prevents default, syncs the outer admin URL, and pushes onto the
 * inner history so React Router re-renders. We deliberately do NOT
 * use react-router's <Link> here because Link intercepts clicks
 * itself, which would prevent App Bridge from seeing them.
 *
 * One link must carry rel="home" — that's the app's default route.
 *
 * Labels are translated via `useTranslation()` (M-188) so changing
 * the dashboard's language selector also updates the Shopify-native
 * sidebar entries.
 */
import { useTranslation } from "react-i18next";

// Register the App Bridge web component as a JSX intrinsic element.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "ui-nav-menu": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

export function NavMenu(): JSX.Element {
  const { t } = useTranslation();
  return (
    <ui-nav-menu>
      <a href="/" rel="home">
        {t("nav.dashboard")}
      </a>
      <a href="/bundles">{t("nav.bundles")}</a>
      <a href="/orders">{t("nav.orders")}</a>
      <a href="/inventory">{t("nav.inventory")}</a>
      <a href="/inventory/audit">{t("nav.audit")}</a>
      <a href="/analytics">{t("nav.analytics")}</a>
      <a href="/ai-suggestions">{t("nav.ai")}</a>
      <a href="/ab-tests">{t("nav.abtests")}</a>
      <a href="/settings">{t("nav.settings")}</a>
      <a href="/billing">{t("nav.billing")}</a>
      <a href="/support">{t("nav.support")}</a>
    </ui-nav-menu>
  );
}
