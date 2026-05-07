# BundleForge marketing site

Static landing page hosted at `bundleforge.app` (apex). Single HTML
file styled with Tailwind via CDN — no build step. Served in
production by a 90-line zero-dependency Node http server (`server.cjs`)
so it can run as a Railway service alongside the app + worker.

## Layout

```
marketing/
├── index.html         # the landing page (Tailwind via CDN, edit freely)
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
Railway project as `bundleforge-web` and the worker. It has no DB / Redis
dependency, so it doesn't need any plugin attachments.

### One-time service setup

1. **Railway dashboard → your project → New service → GitHub repo**
2. Pick this repo (`bundleforge`) and the branch you deploy from
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

1. **Settings → Networking → Custom Domain → `bundleforge.app`**
2. Railway shows you the CNAME / ALIAS target.
3. Add the record at your DNS provider (Cloudflare, Namecheap, etc.).
4. Wait for cert issuance (a minute or two), then verify
   `https://bundleforge.app` responds with `200`.

The Shopify embedded app stays at `app.bundleforge.app` (separate
Railway web service). The marketing site is at `bundleforge.app` apex.
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

## What's NOT here yet

- `/privacy` and `/terms` static pages — currently the footer links
  point at `/privacy` and `/terms` and will 404 in production until
  legal counsel signs off on `legal/privacy-policy.md` and
  `legal/terms-of-service.md`. When ready, drop the rendered HTML into
  `marketing/privacy.html` and `marketing/terms.html` and add them to
  the Dockerfile's `COPY` line. The static server already serves
  arbitrary `*.html` files at their unsuffixed path is **not**
  rewritten — link the footer to `/privacy.html` and `/terms.html`.
- A blog or changelog. Could add a `blog/` directory and serve from
  the same service, or split it off when content grows.
- Web analytics — wire in once a privacy posture is decided
  (Plausible, Cloudflare Web Analytics, or self-host).
- `og:image`, favicon, and apple-touch-icon — drop the assets into
  `marketing/` and add `<link>` / `<meta>` tags in `index.html`.
