# M-024 — Webhook HMAC verifier middleware

## Goal

Add Express middleware that captures the raw body, verifies the
`X-Shopify-Hmac-Sha256` header against `env.SHOPIFY_API_SECRET`, and
populates `req.body` (parsed JSON) for downstream handlers. 401 on
mismatch.

## Why

Mandatory by Shopify. Without HMAC verification, anyone can POST to our
webhook endpoint and we'd trust the payload.

## Design

```ts
// src/middleware/shopifyWebhook.ts
export function shopifyWebhookHmac(opts?: { secret?: string }): RequestHandler[];
```

Returns an array of two middlewares: raw body parser + verifier. Mounted
on `/api/webhooks` ahead of any handler.

Use `crypto.timingSafeEqual` to avoid leaking comparison timing.

## Acceptance criteria

- [ ] Valid HMAC: middleware sets `req.body` (parsed) + attaches
      `req.shopifyTopic`, `req.shopifyShopDomain`, `req.shopifyHmacValid`,
      and calls next().
- [ ] Invalid HMAC: 401 via UnauthorizedError.
- [ ] Missing HMAC header: 401.
- [ ] Tests use `crypto.createHmac` to produce known-good and known-bad
      signatures.

## Files touched

- `src/middleware/shopifyWebhook.ts`
- `src/middleware/shopifyWebhook.test.ts`
- `src/types/express.d.ts` (add `shopifyTopic`, etc., as optional)
