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
 */

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
  return (
    <ui-nav-menu>
      <a href="/" rel="home">
        Bundles
      </a>
      <a href="/orders">Orders</a>
      <a href="/inventory">Inventory</a>
      <a href="/inventory/audit">Audit</a>
      <a href="/analytics">Analytics</a>
      <a href="/ab-tests">A/B tests</a>
      <a href="/settings">Settings</a>
      <a href="/billing">Billing</a>
    </ui-nav-menu>
  );
}
