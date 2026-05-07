/**
 * MintBundle — storefront Web Components.
 *
 * Each custom element fetches the bundle config from the App Proxy
 * (/apps/mintbundle/bundle/<slug>) and renders accordingly.
 *
 * Built without a framework so it ships as a single static asset
 * (no build step needed at the theme-extension level). Tested
 * manually against a development store; M-141 (load test) will add
 * automated browser tests when Playwright lands.
 */

// Stub HTMLElement so the module is importable in Node tests.
// At browser load time HTMLElement is already defined.
if (typeof globalThis.HTMLElement === "undefined") {
  globalThis.HTMLElement = class {};
}

const PROXY_BASE = "/apps/mintbundle/bundle";

async function fetchBundle(slug) {
  const res = await fetch(`${PROXY_BASE}/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`Bundle fetch failed: ${res.status}`);
  return res.json();
}

const ALLOWED_LAYOUTS = new Set(["grid", "list", "carousel"]);
const ALLOWED_PRESETS = new Set([
  "brand",
  "neutral",
  "high-contrast",
  "minimal",
]);

let scopeCounter = 0;
function nextScopeId() {
  scopeCounter += 1;
  return `mintbundle-scope-${scopeCounter}`;
}

/**
 * Storefront-side eligibility check (M-172c). Mirrors the
 * CTF `isEligible` from extensions/cart-transform PLUS
 * tag-based gating that the CTF can't do because Shopify
 * Functions don't reliably read customer.tags.
 *
 * Allow takes priority — having an allow tag wins even if
 * the customer also matches a deny tag (matches the M-172
 * admin Banner copy).
 *
 * @param {object | null} eligibility — parsed blob from
 *   /apps/mintbundle/bundle/:slug.
 * @param {{customerId: string, customerTags: string[],
 *          country: string, language: string}} ctx
 * @returns {boolean}
 */
export function isEligibleStorefront(eligibility, ctx) {
  if (!eligibility || typeof eligibility !== "object") return true;
  const customerId =
    ctx && typeof ctx.customerId === "string" ? ctx.customerId : "";
  const customerTags = Array.isArray(ctx && ctx.customerTags)
    ? ctx.customerTags.filter((t) => typeof t === "string" && t.length > 0)
    : [];
  const country =
    ctx && typeof ctx.country === "string" ? ctx.country : "";
  const language =
    ctx && typeof ctx.language === "string" ? ctx.language : "";

  if (eligibility.requireLogin === true && customerId.length === 0) {
    return false;
  }

  let allowMatched = false;
  if (
    Array.isArray(eligibility.customerTagsAllow) &&
    eligibility.customerTagsAllow.length > 0
  ) {
    allowMatched = customerTags.some((t) =>
      eligibility.customerTagsAllow.includes(t),
    );
    if (!allowMatched) return false;
  }
  if (
    !allowMatched &&
    Array.isArray(eligibility.customerTagsDeny) &&
    eligibility.customerTagsDeny.length > 0
  ) {
    if (customerTags.some((t) => eligibility.customerTagsDeny.includes(t))) {
      return false;
    }
  }

  if (Array.isArray(eligibility.markets) && eligibility.markets.length > 0) {
    if (!country || !eligibility.markets.includes(country)) return false;
  }
  if (Array.isArray(eligibility.locales) && eligibility.locales.length > 0) {
    if (!language || !eligibility.locales.includes(language)) return false;
  }
  return true;
}

/**
 * Read storefront context (customer + localization) from
 * the bundle element's data-* attributes (Liquid populates
 * them via shop globals). Returns the shape isEligibleStorefront
 * expects.
 */
export function readStorefrontContext(elem) {
  if (!elem || typeof elem.getAttribute !== "function") {
    return { customerId: "", customerTags: [], country: "", language: "" };
  }
  const tagsRaw = elem.getAttribute("data-customer-tags") ?? "";
  return {
    customerId: elem.getAttribute("data-customer-id") ?? "",
    customerTags: tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
    country: elem.getAttribute("data-country") ?? "",
    language: elem.getAttribute("data-language") ?? "",
  };
}

/**
 * Resolve the displaySettings object from the proxy into
 * the CSS handles the web component applies. Pure helper —
 * unit-tested in displaySettings.test.ts (M-171b).
 */
export function applyDisplaySettings(settings) {
  const s = settings && typeof settings === "object" ? settings : {};
  const out = {
    wrapperClass: "",
    listClass: "",
    scopedCss: "",
    scopeId: "",
  };
  if (typeof s.colorPreset === "string" && ALLOWED_PRESETS.has(s.colorPreset)) {
    out.wrapperClass = `mintbundle-preset-${s.colorPreset}`;
  }
  if (typeof s.layout === "string" && ALLOWED_LAYOUTS.has(s.layout)) {
    out.listClass = `mintbundle-layout-${s.layout}`;
  }
  if (typeof s.cssOverride === "string" && s.cssOverride.trim().length > 0) {
    out.scopeId = nextScopeId();
    // Scope by prefixing the merchant CSS with #<scopeId>.
    // This isn't a full CSS sandbox but it scopes top-level
    // selectors to the component for trivial overrides (font,
    // color, spacing). Richer customization belongs at the
    // theme level.
    out.scopedCss = `#${out.scopeId} { ${s.cssOverride} }`;
  }
  return out;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

class MintBundleBundle extends HTMLElement {
  async connectedCallback() {
    const slug = this.getAttribute("data-slug");
    if (!slug) return;
    try {
      const bundle = await fetchBundle(slug);

      // M-172c: storefront-side eligibility. If the customer
      // doesn't qualify, hide the widget or render a friendly
      // placeholder per the block's data-on-ineligible setting.
      const ctx = readStorefrontContext(this);
      if (!isEligibleStorefront(bundle.eligibility, ctx)) {
        const mode = this.getAttribute("data-on-ineligible") || "hide";
        if (mode === "placeholder") {
          this.innerHTML = `<p class="mintbundle-ineligible">This bundle isn't available in your region.</p>`;
        } else {
          this.style.display = "none";
        }
        return;
      }

      // M-173c: storefront-side inventory rule check. When
      // componentOnlyMode is on, the merchant has chosen to
      // render components individually elsewhere; the
      // <mintbundle-bundle> widget should hide so it doesn't
      // duplicate the cart line.
      if (
        bundle.inventoryRules &&
        typeof bundle.inventoryRules === "object" &&
        bundle.inventoryRules.componentOnlyMode === true
      ) {
        this.style.display = "none";
        return;
      }

      // M-173d: paused = any component below the merchant's
      // pauseWhenComponentBelow threshold. Computed server-
      // side by the proxy so we don't leak component variant
      // GIDs to the client. Hide or show a "currently
      // unavailable" placeholder on data-on-ineligible.
      if (bundle.paused === true) {
        const mode = this.getAttribute("data-on-ineligible") || "hide";
        if (mode === "placeholder") {
          this.innerHTML = `<p class="mintbundle-paused">This bundle is temporarily unavailable.</p>`;
        } else {
          this.style.display = "none";
        }
        return;
      }

      const display = applyDisplaySettings(bundle.displaySettings);
      this.innerHTML = "";
      // Apply colorPreset class on the wrapper itself.
      if (display.wrapperClass) {
        this.classList.add(display.wrapperClass);
      }
      // Inject scoped cssOverride.
      if (display.scopedCss) {
        if (display.scopeId) this.id = display.scopeId;
        const style = document.createElement("style");
        style.textContent = display.scopedCss;
        this.appendChild(style);
      }
      this.appendChild(
        el("h3", { class: "mintbundle-title" }, [bundle.title]),
      );
      const listClass = display.listClass
        ? `mintbundle-items ${display.listClass}`
        : "mintbundle-items";
      const list = el("ul", { class: listClass });
      for (const item of bundle.items ?? []) {
        list.appendChild(
          el("li", { class: "mintbundle-item" }, [
            `${item.title} × ${item.quantity}`,
          ]),
        );
      }
      this.appendChild(list);
      this.dispatchEvent(
        new CustomEvent("mintbundle:loaded", { detail: bundle, bubbles: true }),
      );
    } catch (err) {
      this.innerHTML = `<p class="mintbundle-error">Could not load bundle.</p>`;
      console.error("MintBundle:", err);
    }
  }
}

class MintBundleVariantPicker extends HTMLElement {
  async connectedCallback() {
    const slug = this.getAttribute("data-slug");
    const idx = parseInt(this.getAttribute("data-item-index") || "0", 10);
    if (!slug) return;
    const bundle = await fetchBundle(slug);
    const item = (bundle.items ?? [])[idx];
    if (!item) return;
    const select = el("select", { class: "mintbundle-variant" });
    select.appendChild(el("option", { value: item.shopifyVariantGid || "" }, [item.title]));
    this.innerHTML = "";
    this.appendChild(select);
  }
}

class MintBundleBuildBox extends HTMLElement {
  async connectedCallback() {
    const slug = this.getAttribute("data-slug");
    if (!slug) return;
    const bundle = await fetchBundle(slug);
    const steps = (bundle.config && bundle.config.steps) || [];
    this.innerHTML = "";
    const wrap = el("div", { class: "mintbundle-build-box" });
    let stepIdx = 0;
    const renderStep = () => {
      wrap.innerHTML = "";
      const step = steps[stepIdx];
      if (!step) {
        wrap.appendChild(el("p", {}, ["All steps complete."]));
        return;
      }
      wrap.appendChild(el("h4", {}, [step.name]));
      wrap.appendChild(el("p", {}, [`Pick ${step.pickCount}`]));
      const next = el("button", { type: "button" }, ["Next"]);
      next.addEventListener("click", () => {
        stepIdx += 1;
        renderStep();
      });
      wrap.appendChild(next);
    };
    this.appendChild(wrap);
    renderStep();
  }
}

class MintBundleMixMatch extends HTMLElement {
  async connectedCallback() {
    const slug = this.getAttribute("data-slug");
    const cols = parseInt(this.getAttribute("data-columns") || "3", 10);
    if (!slug) return;
    const bundle = await fetchBundle(slug);
    this.innerHTML = "";
    const grid = el("div", {
      class: "mintbundle-mix-grid",
      style: `display:grid;grid-template-columns:repeat(${cols},1fr);gap:1rem;`,
    });
    for (const item of bundle.items ?? []) {
      grid.appendChild(
        el("label", { class: "mintbundle-mix-cell" }, [
          el("input", { type: "checkbox", value: item.shopifyVariantGid || "" }),
          ` ${item.title}`,
        ]),
      );
    }
    this.appendChild(grid);
  }
}

class MintBundleBogo extends HTMLElement {
  async connectedCallback() {
    const slug = this.getAttribute("data-slug");
    const showProgress = this.getAttribute("data-show-progress") === "true";
    if (!slug) return;
    const bundle = await fetchBundle(slug);
    const headlineEl = this.querySelector(".mintbundle-bogo-headline");
    if (showProgress && bundle.items?.length) {
      const progress = el("progress", { value: "0", max: String(bundle.items.length) });
      this.appendChild(progress);
    }
    if (!headlineEl) {
      this.appendChild(el("p", { class: "mintbundle-bogo-headline" }, [bundle.title]));
    }
  }
}

// Guard customElements.define so the module can be imported
// in a Node test runtime (where customElements is undefined).
// At browser load time this branch always runs.
if (typeof customElements !== "undefined" && customElements.define) {
  customElements.define("mintbundle-bundle", MintBundleBundle);
  customElements.define("mintbundle-variant-picker", MintBundleVariantPicker);
  customElements.define("mintbundle-build-box", MintBundleBuildBox);
  customElements.define("mintbundle-mix-match", MintBundleMixMatch);
  customElements.define("mintbundle-bogo", MintBundleBogo);
}
