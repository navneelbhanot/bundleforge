# M-121..M-126 — Klaviyo + Google Merchant + Flow + AI

## M-121 Klaviyo adapter

Pushes `Bundle Purchased` to Klaviyo's metric API. Credentials:
`{privateKey}`. Auth: `Authorization: Klaviyo-API-Key <key>`.

## M-122 Google Merchant feed

Generates an XML feed that lists each active bundle as a virtual
product. Pure function — string-builds the feed; route mounted under
`/api/feeds/google-merchant.xml` (App Proxy access not required —
feeds are public by design).

## M-123 Shopify Flow triggers + actions

`extensions/flow/` Shopify Flow connector with two triggers
(`bundle_published`, `bundle_low_stock`) and one action
(`force_inventory_sync`). Manifest only — body emitted via the
existing webhook dispatcher / queue when the corresponding events
fire.

## M-124 AI microservice scaffold (Python/Flask)

`ai-service/` directory with a Flask app, `requirements.txt`, and a
`/health` endpoint. Python tests run via pytest (a CI job lands at
M-126). Docker target added to `docker-compose.yml`.

## M-125 FBT recommender

`ai-service/recommender.py` implements a simple co-occurrence
ranking from a list of order baskets. Pure function (no DB), so the
unit tests don't need a database.

## M-126 /api/v1/ai/recommendations route + scheduled retraining

Node calls the AI service over HTTP using `env.AI_SERVICE_URL` /
`env.AI_SERVICE_API_KEY`. Retraining is a BullMQ job triggered
nightly (the Worker schedule is added).

## Files

- `src/services/integrations/klaviyo.ts` + tests; register in registry
- `src/services/integrations/googleMerchant.ts` + tests
- `src/routes/feeds.ts` (new)
- `extensions/flow/shopify.extension.toml` + manifest fragments
- `ai-service/app.py`, `ai-service/recommender.py`,
  `ai-service/requirements.txt`, `ai-service/test_recommender.py`,
  `ai-service/Dockerfile`
- `src/services/ai/index.ts` (rewrite stub)
- `src/services/ai/index.test.ts`
- `src/routes/ai.ts` (rewrite stub)
- `src/routes/ai.test.ts`
- `src/jobs/queues.ts` (add AI_QUEUE)
- `src/server/index.ts` (mount feeds)
