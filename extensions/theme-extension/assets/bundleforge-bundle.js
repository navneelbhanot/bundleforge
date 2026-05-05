/**
 * BundleForge — storefront Web Components.
 *
 * Each custom element fetches the bundle config from the App Proxy
 * (/apps/bundleforge/bundle/<slug>) and renders accordingly.
 *
 * Built without a framework so it ships as a single static asset
 * (no build step needed at the theme-extension level). Tested
 * manually against a development store; M-141 (load test) will add
 * automated browser tests when Playwright lands.
 */

const PROXY_BASE = "/apps/bundleforge/bundle";

async function fetchBundle(slug) {
  const res = await fetch(`${PROXY_BASE}/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`Bundle fetch failed: ${res.status}`);
  return res.json();
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

class BundleforgeBundle extends HTMLElement {
  async connectedCallback() {
    const slug = this.getAttribute("data-slug");
    if (!slug) return;
    try {
      const bundle = await fetchBundle(slug);
      this.innerHTML = "";
      this.appendChild(
        el("h3", { class: "bundleforge-title" }, [bundle.title]),
      );
      const list = el("ul", { class: "bundleforge-items" });
      for (const item of bundle.items ?? []) {
        list.appendChild(
          el("li", { class: "bundleforge-item" }, [
            `${item.title} × ${item.quantity}`,
          ]),
        );
      }
      this.appendChild(list);
      this.dispatchEvent(
        new CustomEvent("bundleforge:loaded", { detail: bundle, bubbles: true }),
      );
    } catch (err) {
      this.innerHTML = `<p class="bundleforge-error">Could not load bundle.</p>`;
      console.error("BundleForge:", err);
    }
  }
}

class BundleforgeVariantPicker extends HTMLElement {
  async connectedCallback() {
    const slug = this.getAttribute("data-slug");
    const idx = parseInt(this.getAttribute("data-item-index") || "0", 10);
    if (!slug) return;
    const bundle = await fetchBundle(slug);
    const item = (bundle.items ?? [])[idx];
    if (!item) return;
    const select = el("select", { class: "bundleforge-variant" });
    select.appendChild(el("option", { value: item.shopifyVariantGid || "" }, [item.title]));
    this.innerHTML = "";
    this.appendChild(select);
  }
}

class BundleforgeBuildBox extends HTMLElement {
  async connectedCallback() {
    const slug = this.getAttribute("data-slug");
    if (!slug) return;
    const bundle = await fetchBundle(slug);
    const steps = (bundle.config && bundle.config.steps) || [];
    this.innerHTML = "";
    const wrap = el("div", { class: "bundleforge-build-box" });
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

class BundleforgeMixMatch extends HTMLElement {
  async connectedCallback() {
    const slug = this.getAttribute("data-slug");
    const cols = parseInt(this.getAttribute("data-columns") || "3", 10);
    if (!slug) return;
    const bundle = await fetchBundle(slug);
    this.innerHTML = "";
    const grid = el("div", {
      class: "bundleforge-mix-grid",
      style: `display:grid;grid-template-columns:repeat(${cols},1fr);gap:1rem;`,
    });
    for (const item of bundle.items ?? []) {
      grid.appendChild(
        el("label", { class: "bundleforge-mix-cell" }, [
          el("input", { type: "checkbox", value: item.shopifyVariantGid || "" }),
          ` ${item.title}`,
        ]),
      );
    }
    this.appendChild(grid);
  }
}

class BundleforgeBogo extends HTMLElement {
  async connectedCallback() {
    const slug = this.getAttribute("data-slug");
    const showProgress = this.getAttribute("data-show-progress") === "true";
    if (!slug) return;
    const bundle = await fetchBundle(slug);
    const headlineEl = this.querySelector(".bundleforge-bogo-headline");
    if (showProgress && bundle.items?.length) {
      const progress = el("progress", { value: "0", max: String(bundle.items.length) });
      this.appendChild(progress);
    }
    if (!headlineEl) {
      this.appendChild(el("p", { class: "bundleforge-bogo-headline" }, [bundle.title]));
    }
  }
}

customElements.define("bundleforge-bundle", BundleforgeBundle);
customElements.define("bundleforge-variant-picker", BundleforgeVariantPicker);
customElements.define("bundleforge-build-box", BundleforgeBuildBox);
customElements.define("bundleforge-mix-match", BundleforgeMixMatch);
customElements.define("bundleforge-bogo", BundleforgeBogo);
