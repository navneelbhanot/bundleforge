/**
 * App Bridge v4 navigation menu.
 *
 * Renders Shopify's native left-sidebar nav inside `admin.shopify.com`
 * via the <ui-nav-menu> web component. The component is registered
 * by the App Bridge CDN script loaded from `index.html`.
 *
 * Side benefit: App Bridge keeps the embedded iframe's inner URL in
 * sync with the outer `admin.shopify.com/store/.../apps/...` URL, so
 * a refresh or breadcrumb click no longer 404s when the merchant has
 * navigated past the entry route.
 */
import { Link } from "react-router-dom";

// Register the App Bridge web component as a JSX element so TS lets
// us nest <Link> children inside it. The component itself comes
// from the CDN script — no JS import needed.
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
      {/* `rel="home"` flags the Bundles list as the app's home. */}
      <Link to="/" rel="home">
        Bundles
      </Link>
      <Link to="/orders">Orders</Link>
      <Link to="/inventory">Inventory</Link>
      <Link to="/inventory/audit">Audit</Link>
      <Link to="/analytics">Analytics</Link>
      <Link to="/ab-tests">A/B tests</Link>
      <Link to="/settings">Settings</Link>
      <Link to="/billing">Billing</Link>
    </ui-nav-menu>
  );
}
