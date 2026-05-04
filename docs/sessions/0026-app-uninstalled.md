# Session 0026 — app/uninstalled handler + registry

- **Date:** 2026-05-04
- **Milestone(s):** M-026

## What was done

- `src/webhooks/handlers.ts`: tiny topic→handler registry with
  registerHandler, getHandler, dispatch (logs unknown topics rather
  than throws so unsubscribed topics can't poison the queue).
- `src/webhooks/handlers/appUninstalled.ts`:
  `appUninstalledHandler(client?)` factory — calls `updateMany` with
  `{shopifyDomain}` to set `uninstalledAt = now()`. DI-friendly.
- `src/webhooks/handlers/appUninstalled.test.ts`: 2 vi.fn() tests.
- `src/jobs/webhooksWorker.ts`: BullMQ Worker on WEBHOOKS_QUEUE that
  calls `dispatch(topic, input)`. Registers `app/uninstalled` at boot;
  M-027–M-030 will register more.

## Acceptance

- [x] All criteria pass; 115 tests.

## Handoff

Next: **M-027 — shop/update handler**. Update Shop row fields
(name, email, currency, timezone, planName, locale) from webhook
payload. Reuses the registry; one new file + tests.
