# Incident response runbook (M-144)

This is the living playbook for production incidents on MintBundle. Pair
with the Datadog dashboards (`monitoring/datadog/`) and Sentry project.

## Severity definitions

| Sev | Meaning | Examples |
| --- | --- | --- |
| sev1 | Customer-impacting, full or partial outage | DB down, OAuth broken, 5xx > 5%, HMAC under attack |
| sev2 | Degraded but functional | Queue backed up, slow API, 1 region of integrations failing |
| sev3 | Internal-only or non-urgent | Dashboard widget broken, log warnings |

## On-call rotation

The on-call schedule is configured in PagerDuty (or your provider). Two
roles per shift:

- **Primary**: receives all sev1/sev2 alerts, owns the bridge.
- **Secondary**: escalation after 15 min unacked, or for parallel comms.

Rotation length: 1 week. Handover: Monday 10:00 local.

Out-of-hours coverage is required for sev1 only; sev2 is acted on during
business hours.

## Alert routing

| Source | Channel | Auto-page? |
| --- | --- | --- |
| Datadog monitors (sev1) | PagerDuty → primary | yes |
| Datadog monitors (sev2) | Slack `#mintbundle-alerts` | no, but acked |
| Sentry (new prod issue) | Slack `#mintbundle-errors` | only on issue volume threshold |
| Shopify partner webhook (mandatory ones) | logged + Sentry capture | no — handled by code |
| `/health` failure (external probe) | PagerDuty → primary | yes |

## Common-issue playbook

### 1. Postgres unreachable

**Signals**: `/health` returns `db: false`; 5xx spike on `/api/v1/*`;
queue jobs failing with connection errors.

1. Confirm with `psql ${DATABASE_URL} -c 'select 1'`.
2. Check the managed-Postgres provider's status page.
3. If transient: nothing to do — connection pool will recover. Track
   recovery on the HTTP and queue dashboards.
4. If sustained > 5 min:
   - Page sev1.
   - Stop the worker (`fly scale count worker=0` or platform equivalent)
     to drain the in-flight job set; jobs will be retried on resume.
   - Communicate via the in-app status banner (set
     `Shop.settings.maintenanceBanner = "Service degraded"` once one
     replica reconnects) — see `src/routes/settings.ts`.
5. After recovery: run `/health` smoke; confirm worker logs show clean
   reconnect; re-scale worker.

### 2. Redis unreachable

**Signals**: rate limiter throwing 500 (no longer 429); BullMQ producer
errors; `/health` reports `redis: false`.

1. The rate limiter's adapter throws when Redis is down — that turns
   into a 500. *Do not* bypass the limiter; the per-IP middleware
   (M-148) is your last guard.
2. If Redis is down > 60s:
   - Page sev1.
   - Switch the worker to its memory-adapter fallback (env flag
     `REDIS_FALLBACK=memory`) — note this loses cross-replica
     coordination; only acceptable for single-replica.
3. After recovery: BullMQ resumes from Redis; the in-flight job
   delivery may double-deliver (handlers must be idempotent — they are).

### 3. Queue backed up

**Signals**: `mintbundle.queue.depth` > 10k; webhook lag P95 climbing.

1. Identify which queue: `webhooks`, `sync`, `analytics`, `ai`.
2. Inspect the worker logs for repeated handler errors. If a poison
   pill: drop it from BullMQ via `node scripts/drain-queue.mjs <queue>
   --max-attempts-reached` (write this script if absent — TBD).
3. If volume genuinely exceeded capacity: scale the worker
   (`fly scale count worker=N`) or temporarily raise the BullMQ
   concurrency in `src/jobs/worker.ts`.
4. Post-mortem: was a bundle/integration fan-out misconfigured? Adjust
   batch sizes.

### 4. Shopify rate limit exhaustion

**Signals**: 429s from `myshopify.com`; `mintbundle.shopify.retry`
spiking on the inventory dashboard.

1. The Shopify client wrapper backs off automatically using `Retry-After`.
2. If sustained: lower the queue concurrency (`SHOPIFY_CONCURRENCY` env
   var).
3. If a single shop is the noisy neighbor: enable the per-shop
   `requirePlanFeature` cap (M-031b) for that shop's tier; consider
   reaching out to upgrade.

### 5. HMAC failures spike

**Signals**: `mintbundle.webhook.hmac_failed` count > 10/hr; or repeated
401s on `/api/proxy/*`.

1. **Likely cause #1**: Shopify rotated the app secret. Verify
   `SHOPIFY_API_SECRET` in the env matches Partners dashboard.
2. **Likely cause #2**: someone is fuzzing the endpoint. Check the IP
   distribution in HTTP logs — if concentrated, add an upstream
   block (Cloudflare WAF rule) and let the per-IP rate limiter (M-148)
   cover the gap meanwhile.
3. **Never** disable HMAC verification.

### 6. Sev1 — full app down

1. Page sev1 + post in `#incident` Slack.
2. Open a Statuspage incident.
3. Assign IC, Comms, Operator. (See PagerDuty playbook.)
4. Triage with the dashboards; restore service first, root-cause later.
5. Within 24h post-resolution: blameless post-mortem document in
   `docs/incidents/YYYY-MM-DD-<slug>.md`.

## Backup + restore drill (M-145)

The DB is dumped hourly by `scripts/backup.sh` (cron'd; retains 1 week).
**Drill quarterly**:

1. Spin up a fresh staging Postgres.
2. `DATABASE_URL=<staging> CONFIRM=yes ./scripts/restore.sh <latest-backup>`.
3. `npm run db:generate && npm test` against the restored staging DB
   (with a copy of the worker pointed at it).
4. Confirm `/health` returns `db: true`. Confirm a sample shop's
   bundles/orders are visible via the admin.
5. Time the drill end-to-end and log it; target RTO is < 30 min for a
   < 50 GB dataset.

If a drill exceeds RTO, file a sev3 ticket and add capacity (parallel
restore, smaller per-shop dump, or migration to PITR).

## GDPR (M-146/M-147)

Merchant-initiated:

- **Export**: `POST /api/v1/gdpr/export` returns the shop's full dataset
  with credentials redacted. Stream this directly to the merchant; do
  not store the artifact server-side.
- **Delete**: `POST /api/v1/gdpr/delete-shop` hard-deletes the shop row
  and cascades through FKs. Equivalent to the Shopify
  `shop/redact` webhook (M-030).

Shopify-initiated webhooks (`customers/data_request`, `customers/redact`,
`shop/redact`) are wired in `src/webhooks/handlers/`. We store no customer
PII so the customer endpoints are no-ops; the shop one mirrors the admin
delete above.
