# M-017 — OAuth install route

## Goal

Add `src/shopify/index.ts` that wraps `@shopify/shopify-app-express`,
mounts the OAuth begin route on the server, and is unit-tested.

## Why

Without OAuth, no shop can install BundleForge. This is the entry point
for every later Shopify-touching milestone.

## Out of scope

- Persistent session storage (Prisma adapter): M-020. Until then, use the
  in-memory adapter from `@shopify/shopify-app-session-storage-memory`.
- Token persistence into our `Shop` table: M-018.
- App Bridge token verification (frontend-issued session tokens): M-021.

## Design

```ts
// src/shopify/index.ts
import { shopifyApp, type ShopifyApp } from "@shopify/shopify-app-express";
import { ApiVersion } from "@shopify/shopify-api";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";

import { env } from "../config/env";

export function buildShopify(opts?: { sessionStorage?: SessionStorage }): ShopifyApp;
export const shopify: ShopifyApp;
```

`buildShopify()` is the factory tests inject into. `shopify` is the
production singleton.

API version: pinned to `ApiVersion.January25` to match
`shopify.app.toml`. Bump together with the toml.

Server mount (in `src/server/index.ts`):

```ts
app.get(shopify.config.auth.path, shopify.auth.begin());
```

The callback route lands in M-018.

## Acceptance criteria

- [ ] `src/shopify/index.ts` exists and exports `shopify` + `buildShopify`.
- [ ] `src/server/index.ts` mounts the auth begin route.
- [ ] Hitting `/api/auth?shop=test.myshopify.com` returns a 302 redirect
      whose Location starts with `https://test.myshopify.com/admin/oauth/authorize?`.
- [ ] Tests do NOT require real Shopify keys (env values are placeholders).
- [ ] Boot phase remains green.

## Files touched

- `src/shopify/index.ts` (new)
- `src/shopify/index.test.ts` (new)
- `src/server/index.ts` (mount route)
- `package.json` (already has shopify-app-express + memory adapter)
