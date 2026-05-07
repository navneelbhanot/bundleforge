# Runbook — Railway service configuration

Three services share this repo:

- **mintbundle** (web) — already configured by `railway.toml`.
- **outstanding-nourishment** (worker) — needs manual fix (below).
- **AI Service** (Python) — needs manual fix (below).

Service-stored start commands cannot be edited via the Railway CLI;
they must be set in the dashboard. Once correct, future deploys reuse
the value.

## Worker service: `outstanding-nourishment`

**Current state:** `startCommand: npm run start:web` (wrong — runs a
second copy of the web server, BullMQ jobs never drain).

**Fix:**

1. Open the [MintBundle project on Railway](https://railway.com/project/abafb5b5-a883-487c-b666-130c5a49ffa2).
2. Click the **outstanding-nourishment** service.
3. Settings → Deploy → **Custom Start Command**.
4. Set to:
   ```
   npm run start:worker
   ```
5. Save. Railway redeploys automatically.

**Verify:** Logs should show `[start-worker] script entered` and then
BullMQ worker boot output (`Worker registered for queue …`).

## AI Service

The AI service deploys from `ai-service/` (Python, separate Dockerfile)
— it does **not** share MintBundle's Node code. The current state
shows `startCommand: npm run start:web` which is wrong for a Python
service.

**Fix:**

1. Same project, click the **AI Service** service.
2. Settings → Deploy → **Root Directory** = `ai-service`.
3. Settings → Deploy → **Builder** = `Dockerfile` (use
   `ai-service/Dockerfile`).
4. **Custom Start Command**: leave **empty** (the Dockerfile's
   `CMD ["python", "app.py"]` handles startup).
5. Settings → Variables — make sure `AI_SERVICE_API_KEY` matches the
   value used by the web service's `AI_SERVICE_API_KEY` env var.
6. Save. Railway redeploys.

**Verify:** AI Service logs should show Flask listening on the
configured port. From the web service, `AI_SERVICE_URL` should be the
internal Railway hostname of the AI Service (e.g.
`http://ai-service.railway.internal:5001`).

## Optional: Crisp live chat

To enable the Crisp widget in the embedded admin:

1. Sign up at [app.crisp.chat](https://app.crisp.chat) (free tier is
   sufficient for the smoke-test stage).
2. Settings → Website Settings → Setup Instructions → copy the
   **Website ID** (a UUID).
3. In Railway, on the **mintbundle** web service:
   Settings → Variables → Add → `CRISP_WEBSITE_ID = <the UUID>`.
4. Save. The next deploy injects the value into `index.html`'s meta
   tag and the SPA lazy-loads the Crisp widget on boot.

When unset, the SPA detects an empty meta value and skips loading the
widget entirely — no functional impact.

## Optional: Webhooks worker as its own service

The webhooks-worker can run inside the BullMQ worker process or as
its own service. For higher throughput / isolation:

1. Add a new Railway service pointed at this repo.
2. Custom Start Command: `npm run start:webhooks-worker`.
3. Same env as the web service (Postgres, Redis, encryption key).
4. Save. Railway provisions and deploys.
