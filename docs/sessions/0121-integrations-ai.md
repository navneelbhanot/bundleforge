# Sessions 0121..0126 — Klaviyo + Google Merchant + Flow + AI service

- **M-121** Klaviyo adapter — `src/services/integrations/klaviyo.ts`
  + 5 tests; registered in registry; `Bundle Purchased` metric event.
- **M-122** Google Merchant feed — `src/services/integrations/googleMerchant.ts`
  + 4 tests (Atom XML, escaping, image_link omission, availability override);
  public route `GET /api/feeds/google-merchant.xml` mounted in server.
- **M-123** Shopify Flow connector — `extensions/flow/` with one
  action (`force_inventory_sync`) and two triggers (`bundle_published`,
  `bundle_low_stock`). Manifest + JSON schemas only.
- **M-124** AI microservice scaffold — `ai-service/app.py` (Flask)
  with `/health` + `/recommendations` + bearer auth via
  `AI_SERVICE_API_KEY`. Dockerfile, requirements.txt, docker-compose
  service.
- **M-125** FBT recommender — `ai-service/recommender.py` pure
  co-occurrence + lift ranking. `pytest test_recommender.py` covers
  empty input, single-basket, lift ranking, top_n clamp, unknown
  target.
- **M-126** Node integration — `src/services/ai/index.ts`
  `recommend()` posts to the Python service with bearer auth, falls
  back to `[]` on disabled / non-2xx / fetch error. `src/routes/ai.ts`
  rewrites the stub: `GET /recommendations?target=…&topN=…` derives
  baskets from `bundle_orders.skuBreakdown` and calls the recommender.
  4 vi.mocked supertest cases.

404 tests pass after this batch.
