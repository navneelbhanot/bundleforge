# BundleForge marketing site

Static landing page hosted at `bundleforge.app` (apex). Single HTML
file styled with Tailwind via CDN — no build step.

## Local preview

```bash
cd marketing
python3 -m http.server 8000
# open http://localhost:8000
```

Or any static server (e.g. `npx serve marketing`).

## Deploy via Cloudflare Pages

DNS is already on Cloudflare (`eve.ns.cloudflare.com` /
`javon.ns.cloudflare.com`), so Cloudflare Pages is the lowest-friction
path: free, fast, automatic HTTPS, deploys from this repo.

### One-time setup

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**
2. Authorize Cloudflare to read this repo
3. Select the repo and the `main` branch
4. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `marketing`
   - **Root directory:** *(leave blank — keep at repo root)*
5. Click **Save and Deploy** — Pages builds + serves the
   `marketing/` directory directly

### Custom domain

After the first deploy lands at `bundleforge-XXX.pages.dev`:

1. **Pages project → Custom domains → Set up a custom domain**
2. Enter `bundleforge.app` (apex)
3. Cloudflare adds the DNS records automatically (since the domain is
   already on this Cloudflare account)
4. Optional: also add `www.bundleforge.app` for the `www` redirect

The Shopify app stays at `app.bundleforge.app` (Railway). The marketing
site stays at `bundleforge.app` (Cloudflare Pages). They're independent.

## Editing the page

It's a single HTML file. Edit `marketing/index.html`, commit, push —
Cloudflare Pages auto-deploys on every push to `main`.

To change copy:
- Hero headline: search for `<h1>` near the top
- Three differentiators: search for `<section id="why"`
- Bundle types: `<section id="types"`
- Pricing tiers: `<section id="pricing"`
- Email signup: `<section id="install"`

To change colors, edit the Tailwind config in the `<script>` tag at the
top of the file (`accent`, `green`, `amber`, `ink`).

## What's NOT here yet

- `/privacy` and `/terms` routes — currently link to `legal/` markdown
  files in the main repo. Convert to static HTML and drop in
  `marketing/privacy/index.html` etc. when needed.
- A blog or changelog — future. Could add a separate `blog/` folder
  served by Pages or migrate to Astro if content grows.
- Analytics / Cloudflare Web Analytics — turn on in the Cloudflare Pages
  dashboard once live.
