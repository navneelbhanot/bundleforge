# Deploying BundleForge to Railway

End-to-end recipe. Assumes a Railway account, the `railway` CLI, and a
Shopify Partners app already exists.

## Project layout

One Railway project with five resources:

| Resource | Type | Purpose |
| --- | --- | --- |
| `web` | service from this repo | Express + admin SPA |
| `worker` | service from this repo | BullMQ workers |
| `ai` | service from `ai-service/` (Dockerfile) | Python recommender |
| `postgres` | plugin | Primary DB |
| `redis` | plugin | Cache + queues |

## One-time setup

```bash
railway login
railway init bundleforge
cd bundleforge

# Provision plugins
railway add postgresql
railway add redis
```

Both plugins inject `DATABASE_URL` and `REDIS_URL` into every service in
the project automatically.

## Web service

1. **New Service → Deploy from GitHub repo** → select `navneelbhanot/bundleforge`.
2. Use the defaults from `railway.toml`. Specifically:
   - **Build command**: `npm ci --include=dev && npm run build`
     (installs deps including `tsx`, runs `prisma generate`, builds the
     frontend SPA into `dist/frontend/`)
   - **Start command**: `npm run release && npm run start:web`
     (runs `prisma migrate deploy`, then `tsx src/server/index.ts`)
   - **Healthcheck**: `/health`
3. Under **Variables**, paste the values from `.env.railway.example`,
   filling in:
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` (Partners → Apps → API
     credentials)
   - `SHOPIFY_APP_URL` (the Railway-issued URL; you'll get this after
     the first deploy — just deploy once with a placeholder, then
     update)
   - `ENCRYPTION_KEY` (`openssl rand -hex 32`)
4. Click **Deploy**.

## Worker service

1. **New Service → Add from same repo**.
2. Override:
   - **Build command**: `npm ci --include=dev && npm run build:server`
   - **Start command**: `npm run start:worker`
   - **Healthcheck**: disabled
3. Same env vars as web (workers need DATABASE_URL, REDIS_URL,
   ENCRYPTION_KEY, SHOPIFY_API_KEY, SHOPIFY_API_SECRET,
   SHOPIFY_APP_URL).
4. Deploy.

## Webhooks worker (optional)

If webhook volume is high, split it into its own service:

- **Build**: `npm ci --include=dev && npm run build:server`
- **Start**: `npm run start:webhooks-worker`
- Same env vars.

Otherwise the regular worker process is fine; you can run both BullMQ
workers from the same Node process by composing them in
`src/jobs/worker.ts`.

## AI service

1. **New Service → Deploy from GitHub repo** → select the same repo.
2. **Root directory**: `ai-service/`.
3. **Build**: Railway autodetects the `Dockerfile`.
4. **Variables**:
   - `AI_API_TOKEN` (matches `AI_SERVICE_TOKEN` on the web/worker)
5. Deploy. Copy the issued URL into `AI_SERVICE_URL` on web + worker.

## Shopify Partners config

Once Railway has issued the `web` service URL:

1. **Partners → Apps → BundleForge → Configuration**:
   - **App URL**: `https://<web>.up.railway.app/`
   - **Allowed redirection URLs**: add `https://<web>.up.railway.app/api/auth/callback`
   - **App Proxy**: subpath `apps/bundleforge`, target
     `https://<web>.up.railway.app/api/proxy`
2. **Webhooks → Compliance**:
   - `customers/data_request` → `https://<web>.up.railway.app/api/webhooks`
   - `customers/redact` → same
   - `shop/redact` → same
3. Save.
4. Update the `SHOPIFY_APP_URL` env var on web + worker to match.

## First install

1. From Partners → **Test on development store** → install.
2. OAuth completes; the merchant lands on the admin.
3. Hit `/health` directly: should return `{ status: "ok", checks: { db:
   true, redis: true } }`.
4. Confirm one bundle can be created end-to-end.

## Migrations

`npm run release` runs `prisma migrate deploy` before the web service
starts. New migrations ship with each deploy automatically. Don't run
`prisma migrate dev` against production.

## Backups

Railway's Postgres plugin includes daily automated backups, but they're
not granular. Run our hourly logical backups to S3 in addition:

```bash
# In a Railway cron or external scheduler
DATABASE_URL=$DATABASE_URL ./scripts/backup.sh /tmp/bf-backups
aws s3 sync /tmp/bf-backups s3://bundleforge-backups/
```

See `scripts/backup.sh` and `docs/runbook-incidents.md` for details.

## Logs + metrics

- Railway tails Pino JSON logs natively. Use the **Logs** tab.
- For richer metrics, point Datadog at the Railway log drain:
  **Settings → Integrations → Datadog** and import the JSON dashboards
  from `monitoring/datadog/dashboards/`.

## Cost ballpark

- Web (256 MB RAM, light traffic): ~$5/mo
- Worker (256 MB): ~$5/mo
- AI (512 MB): ~$10/mo
- Postgres: $5–10 plan
- Redis: $5 plan
- **~$30/mo** at small scale; scales linearly with traffic.

## Rollback

```bash
railway rollback --service web --to <deployment-id>
```

Migrations are forward-only; if a release introduces a bad migration,
roll back the *application* image and write a corrective migration as
the next deploy. Don't `prisma migrate resolve` in prod without a
runbook.
