/**
 * Patch window.fetch so requests to our own /api/* automatically carry
 * the App Bridge session token as `Authorization: Bearer <jwt>`.
 *
 * Without this, every page-level fetch from the embedded admin returns
 * 302 to OAuth (validateAuthenticatedSession sees no token), the
 * browser follows, OAuth completes, and the app re-mounts — resulting
 * in either a forever-spinner or a visible reload loop.
 *
 * App Bridge v4 (loaded from the Shopify CDN script in index.html)
 * exposes `window.shopify.idToken()` which mints a fresh JWT.
 *
 * Only intercept same-origin /api/* calls so we don't accidentally
 * attach the token to App Bridge's own outbound traffic or to any
 * third-party fetch a future dependency might issue.
 */

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
    };
  }
}

const originalFetch = window.fetch.bind(window);

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isOurApi(url: string): boolean {
  // Same-origin relative path.
  if (url.startsWith("/api/")) return true;
  // Absolute URL pointing at our origin.
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

window.fetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> => {
  const url = getUrl(input);
  if (!isOurApi(url)) return originalFetch(input, init);

  let token = "";
  try {
    token = (await window.shopify?.idToken?.()) ?? "";
  } catch {
    // App Bridge not ready or rejected — fall through without token; the
    // server will respond 401/302 and the SPA can surface the error.
  }

  const headers = new Headers(
    init.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return originalFetch(input, { ...init, headers });
};

export {}; // ensure this is treated as a module
