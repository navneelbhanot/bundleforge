# MintBundle marketing site

Static landing page hosted at `mintbundle.app` (apex). Single HTML
file styled with Tailwind via CDN — no build step. Served in
production by a 90-line zero-dependency Node http server (`server.cjs`)
so it can run as a Railway service alongside the app + worker.

## Visual design

The page implements the Shopify-inspired design system in
[`DESIGN.md`](../DESIGN.md) at the repo root: dark-first surface
hierarchy (Void Black → Deep Teal → Dark Forest → Forest), ultra-light
display typography (variable weight 330–400 at 96px), Neon Green
`#36F4A4` reserved for focus rings + accent highlights only, full-pill
(9999px) CTAs, and a multi-layered card shadow system.

**Fonts.** NeueHaasGrotesk is a licensed face — listed first in the
font stack so installs that own it pick it up. Everyone else falls
through to Helvetica Neue (Apple system) and Inter Variable (loaded
from Google Fonts). Inter Variable supports the variable-weight values
the design calls for (330, 360, 400, 420, 450, 500, 550) and has its
own `ss03` OpenType set, which is enabled globally.

If/when NeueHaasGrotesk is licensed for production, drop the @font-face
declaration into `index.html` — the rest of the typography system
already resolves to it.

## Layout

```
marketing/
├── index.html         # the landing page (Tailwind via CDN, edit freely)
├── privacy.html       # generated from legal/privacy-policy.md
├── terms.html         # generated from legal/terms-of-service.md
├── build-legal.cjs    # one-shot script that regenerates the two above
├── server.cjs         # tiny static file server (zero deps)
├── package.json       # `npm start` → node server.cjs
├── Dockerfile         # node:20-alpine, ~50 MB image
├── railway.json       # service config (Dockerfile builder + /health)
└── .dockerignore
```

## Local preview

```bash
cd marketing
node server.cjs
# open http://localhost:8080
```

The server picks up `PORT` from the env and falls back to 8080.
`GET /health` returns 200 "ok" (used by Railway for healthchecks).

## Deploy to Railway as its own service

The marketing site runs as a **separate Railway service** in the same
Railway project as `mintbundle-web` and the worker. It has no DB / Redis
dependency, so it doesn't need any plugin attachments.

### One-time service setup

1. **Railway dashboard → your project → New service → GitHub repo**
2. Pick this repo (`mintbundle`) and the branch you deploy from
   (`main` for production).
3. **Settings → Source**:
   - **Root Directory:** `marketing`
   - **Watch Paths:** `marketing/**` *(only redeploy on marketing changes;
     prevents app-side commits from rebuilding the marketing service)*
4. **Settings → Build**: leave on auto-detect — Railway sees the
   `Dockerfile` and uses the `DOCKERFILE` builder. (`railway.json`
   pins this explicitly.)
5. **Settings → Deploy**: leave on defaults. The healthcheck path
   `/health` and start command come from `railway.json`.
6. **Settings → Networking → Generate Domain**.
   First deploy lands at `<service>.up.railway.app`.

### Custom domain

Once the first deploy is healthy:

1. **Settings → Networking → Custom Domain → `mintbundle.app`**
2. Railway shows you the CNAME / ALIAS target.
3. Add the record at your DNS provider (Cloudflare, Namecheap, etc.).
4. Wait for cert issuance (a minute or two), then verify
   `https://mintbundle.app` responds with `200`.

The Shopify embedded app stays at `app.mintbundle.app` (separate
Railway web service). The marketing site is at `mintbundle.app` apex.
They're independent services and can be redeployed without affecting
each other.

### Environment variables

None required. The service is fully static. Optional:

| Var    | Default | Purpose                                     |
| ------ | ------- | ------------------------------------------- |
| `PORT` | `8080`  | Railway sets this automatically; honored by `server.cjs`. |

### Watch paths (avoid wasted rebuilds)

The repo holds three deployable surfaces — the Express app, the worker,
and this marketing site. Set the marketing service's **Watch Paths** to
`marketing/**` so a backend-only commit doesn't trigger a marketing
redeploy (and vice versa).

## Editing the page

It's a single HTML file. Edit `marketing/index.html`, commit, push —
Railway auto-deploys on every push to the configured branch (only
when the watch paths match).

To change copy:
- Hero headline: search for `<h1>` near the top
- Three differentiators: `<section id="why"`
- Bundle types: `<section id="types"`
- Pricing tiers: `<section id="pricing"`
- Email signup: `<section id="install"`

To change colors, edit the Tailwind config in the `<script>` tag at the
top of `index.html` (`accent`, `green`, `amber`, `ink`).

## Pricing — single source of truth

The four-tier pricing block in `index.html` mirrors
`src/services/billing/plans.ts`. **If pricing changes there, update this
file too** (and `legal/terms-of-service.md` §3 and
`docs/launch/app-listing.md`). There is no runtime check for drift.

| Tier       | Monthly | Annual  | Bundle / order caps          |
| ---------- | ------- | ------- | ---------------------------- |
| Starter    | $0      | —       | 5 bundles · 100 orders/mo    |
| Growth     | $12     | $115    | unlimited (fair-use ToS §3.1)|
| Pro        | $35     | $336    | unlimited (fair-use ToS §3.1)|
| Enterprise | $129    | $1,238  | unlimited (fair-use ToS §3.1)|

## Privacy + Terms pages

Source of truth lives in [`legal/privacy-policy.md`](../legal/privacy-policy.md)
and [`legal/terms-of-service.md`](../legal/terms-of-service.md). The HTML
versions on the marketing site are **generated** by `build-legal.cjs` and
should never be hand-edited:

```bash
# from repo root
node marketing/build-legal.cjs
# wrote marketing/privacy.html (~11 KB)
# wrote marketing/terms.html (~12 KB)
```

The script substitutes a small set of placeholders that we already know
(`effective_date`, contact emails, hosting vendor). Anything still
user-specific renders as a styled `[pending: name]` badge so it's
obvious to readers what's awaiting counsel review:

| Placeholder | Filled? | Source |
| --- | --- | --- |
| `effective_date` | ✓ | today's date when script runs |
| `privacy_email` / `support_email` / `legal_email` | ✓ | `*@mintbundle.app` |
| `hosting_vendor` / `db_vendor` / `redis_vendor` | ✓ | Railway |
| `operating_entity` | pending | Legal entity once incorporated |
| `governing_jurisdiction` / `venue` | pending | Counsel decision |
| `region` | pending | Railway region of the deployed service |
| `eu_representative` | pending | GDPR Art. 27 representative |
| `security_url` | pending | Once `SECURITY.md` lands |

Each rendered page also carries a prominent **Draft** banner pointing at
this same fact. When counsel approves the final values, edit
`build-legal.cjs` (top of file: `FILLED` + `PENDING` sets), re-run the
script, commit the regenerated HTML, and remove the draft banner block
from `pageTemplate()`.

Routes: `/privacy` and `/terms` (clean URLs, served by `server.cjs`).
Both `/privacy.html` and `/privacy/` also resolve.

## What's NOT here yet

- A blog or changelog. Could add a `blog/` directory and serve from
  the same service, or split it off when content grows.
- Web analytics — wire in once a privacy posture is decided
  (Plausible, Cloudflare Web Analytics, or self-host).
- `og:image`, favicon, and apple-touch-icon — drop the assets into
  `marketing/` and add `<link>` / `<meta>` tags in `index.html`.
