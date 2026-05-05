/**
 * App Bridge frontend integration (M-095).
 *
 * App Bridge v4+ initializes itself from `<meta name="shopify-api-key">`
 * in index.html plus the script loaded from Shopify's CDN. There's no
 * Provider component anymore — hooks like `useAppBridge()` access the
 * bridge directly. This component is a pass-through, kept so route
 * trees can wrap children in additional logic (e.g. host validation,
 * loading state) without churning App.tsx.
 */
import type { PropsWithChildren } from "react";

export function AppBridgeProvider({
  children,
}: PropsWithChildren): JSX.Element {
  return <>{children}</>;
}
