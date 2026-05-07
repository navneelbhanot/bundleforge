# Datadog dashboards (M-143)

Four dashboards covering MintBundle's observability surface:

| File | What it shows |
| --- | --- |
| `dashboards/queue.json` | BullMQ depth, throughput, failure rate, P95 duration |
| `dashboards/webhook.json` | Shopify webhook ingest rate, ack→handle lag, HMAC failures |
| `dashboards/sync.json` | Inventory engine throughput, recompute duration, Shopify API retries |
| `dashboards/http.json` | Express ingress: req rate, 5xx %, P50/P95/P99 latency, 429s |

## Importing

Each JSON file is a Datadog *dashboard definition* (the format you get back
from `GET /api/v1/dashboard/{id}`). Import with the CLI:

```bash
datadog-ci dashboard create --file monitoring/datadog/dashboards/queue.json
```

Or via the web UI: **Dashboards → New → Import JSON**, paste the file
contents, save.

## Required metrics

The dashboards reference the following metric namespaces; emit them from
the worker (`src/jobs/worker.ts` + `src/services/inventory/index.ts`) using
your statsd or `dogstatsd-js` client:

- `mintbundle.queue.{depth,completed,failed,duration}` — tagged `queue`
- `mintbundle.webhook.{accepted,lag_ms,hmac_failed,handler_error}` — tagged `topic`
- `mintbundle.inventory.{applied,recompute_ms,audit_write}` — tagged `shop`
- `mintbundle.http.{requests,duration}` — tagged `route`, `status`
- `mintbundle.shopify.retry` — tagged `api`

If you're using log-to-metric instead of direct statsd, add the
extraction rule in **Logs → Generate Metrics**; pino-http emits
structured JSON suitable for parsing.

## Alerting

Recommended monitor thresholds (configure in Datadog as **Monitors →
New monitor → Metric**):

| Monitor | Threshold | Severity |
| --- | --- | --- |
| Queue depth (waiting) | > 10000 for 5 min | sev2 |
| Queue failure rate | > 5% over 15 min | sev2 |
| Webhook lag P95 | > 30s for 10 min | sev2 |
| HMAC failures / hour | > 10 | sev1 (suspected attack) |
| HTTP 5xx rate | > 1% for 5 min | sev1 |
| HTTP P95 latency | > 2000ms for 10 min | sev2 |
| Inventory recompute P95 | > 5000ms for 10 min | sev2 |

Routing is documented in `docs/runbook-incidents.md`.
