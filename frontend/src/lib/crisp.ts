/**
 * Crisp live-chat lazy loader.
 *
 * Reads the `crisp-website-id` meta tag (server-substituted from
 * env.CRISP_WEBSITE_ID at boot — empty string when unset) and, when
 * a real id is present, injects Crisp's CDN script and hydrates the
 * shop context so support knows who's chatting.
 *
 * No-op when:
 *   - the meta tag is missing or empty
 *   - the global `window.$crisp` already exists (HMR / re-mount)
 *   - we're not in a browser
 *
 * Identifying the user via window.$crisp.push(["set", "user:nickname", ...])
 * pulls the current shop domain from the App Bridge id_token if we
 * can read it; otherwise we fall back to the `?shop=` query param.
 */

declare global {
  interface Window {
    $crisp?: Array<unknown>;
    CRISP_WEBSITE_ID?: string;
  }
}

function readShop(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("shop");
    if (fromQuery) return fromQuery;
  } catch {
    // ignore
  }
  return null;
}

function readCrispWebsiteId(): string {
  if (typeof document === "undefined") return "";
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="crisp-website-id"]',
  );
  return meta?.content?.trim() ?? "";
}

function loadCrisp(websiteId: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.$crisp) return; // already loaded

  // Crisp's standard bootstrap: an array on window.$crisp, then the
  // CDN script reads + replaces it. Setting the website id BEFORE the
  // script tag is required.
  window.$crisp = [];
  window.CRISP_WEBSITE_ID = websiteId;

  const shop = readShop();
  if (shop) {
    window.$crisp.push(["set", "session:data", [[["shop", shop]]]]);
    window.$crisp.push(["set", "user:nickname", [shop]]);
  }

  const s = document.createElement("script");
  s.src = "https://client.crisp.chat/l.js";
  s.async = true;
  document.head.appendChild(s);
}

const websiteId = readCrispWebsiteId();
if (websiteId) {
  loadCrisp(websiteId);
}

export {};
