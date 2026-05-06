# M-165 — Settings · Notifications & alerts tab

> Fifth milestone of Phase R1 (`docs/plans/rich-admin-ui-roadmap.md`).
> Re-surfaces the existing `notifications` toggles hidden by M-161,
> adds channel-target fields (email recipients, Slack/Teams
> webhooks), and exposes per-rule alert subscriptions.

---

## Why

The existing `settings.notifications` is two booleans (`email`,
`inApp`) hidden by M-161's tab refactor. Merchants expect to:

- Choose **who** gets emailed (today: implicit "shop email"; can't
  add ops/oncall addresses).
- Hook up **other channels** (Slack and Teams webhooks are the
  competitor baseline — Simple Bundles and Fast Bundle both
  surface these).
- Pick **which events** trigger an alert (today: every event uses
  the single email/inApp toggle pair; no granular control).

This milestone surfaces all three. Like M-164, the **option ships
fully** but the actual delivery wiring (the worker emitting Slack
HTTP POSTs / SMTP sends) is incremental — for events that already
have an emitter, adding the channel multiplexer is small. Events
that don't have emitters yet stay one of those "ship the option,
wire later" calls.

---

## Scope

### Server

Replace the bare `notifications` Zod with a structured one. Keep
backwards compat — the existing top-level `email` / `inApp`
booleans must continue to round-trip:

```ts
const NotificationsPatch = z.object({
  email: z.boolean().optional(),
  inApp: z.boolean().optional(),
  recipients: z.array(z.string().email()).max(20).optional(),
  slackWebhookUrl: z.string().url().optional().or(z.literal("")),
  teamsWebhookUrl: z.string().url().optional().or(z.literal("")),
  rules: z.object({
    lowStock: z.object({
      enabled: z.boolean().optional(),
      channels: z.array(z.enum(["email", "inApp", "slack", "teams"])).optional(),
    }).optional(),
    publishFailure: z.object({
      enabled: z.boolean().optional(),
      channels: z.array(z.enum(["email", "inApp", "slack", "teams"])).optional(),
    }).optional(),
    webhookFailure: z.object({
      enabled: z.boolean().optional(),
      channels: z.array(z.enum(["email", "inApp", "slack", "teams"])).optional(),
    }).optional(),
    aiServiceDown: z.object({
      enabled: z.boolean().optional(),
      channels: z.array(z.enum(["email", "inApp", "slack", "teams"])).optional(),
    }).optional(),
    unresolvedBundleOrder: z.object({
      enabled: z.boolean().optional(),
      channels: z.array(z.enum(["email", "inApp", "slack", "teams"])).optional(),
    }).optional(),
  }).optional(),
}).strict();
```

PUT must **deep-merge** `notifications` (not just replace it) so
the existing `email`/`inApp` toggles aren't silently dropped when
a merchant saves a recipients list. The current implementation in
`settings.ts` already deep-merges notifications via a tiny inline
spread; consolidate it to use the same `mergeSubobject` helper as
the other tabs and fold `rules` into a deeper merge so saving
a single rule doesn't wipe the others.

### Client

Flip Notifications TabSpec from `"deferred"` → `"ready"`. Three
cards.

**Channels card** — recipients (Polaris `Tag` chips with an add
input), Slack webhook URL (TextField with URL validation),
Teams webhook URL (TextField with URL validation), inApp
checkbox (re-surfacing the existing toggle).

**Email channel card** — Master email enable checkbox
(re-surfacing the existing `notifications.email` toggle); when
enabled, displays the recipients list with a help banner pointing
at the Channels card.

**Alert rules card** — One row per rule (5 rules). Each row:
toggle for enabled, a `ChoiceList allowMultiple` for channels.
Compact layout (BlockStack rows with InlineStack for controls).

Three Save buttons, one per card, all routing through
`patchSubobject("notifications", patch)`.

### Tests

- `src/routes/settings.test.ts`:
  - PUT a full notifications patch with email + recipients +
    Slack URL + alert rules → round-trips.
  - PUT recipients with a non-email entry → 400.
  - PUT slackWebhookUrl that isn't a URL → 400.
  - PUT recipients of length 21 → 400 (max 20).
  - PUT only `notifications.rules.lowStock` doesn't drop a
    previously saved `notifications.rules.publishFailure`.
  - PUT only `notifications.recipients` doesn't drop a
    previously saved `notifications.email: true`.

- `frontend/src/pages/SettingsPage.test.tsx`:
  - Notifications tab no longer placeholder; renders the three
    card headings.
  - Adding a Slack URL + Save sends `{ notifications: { slackWebhookUrl: ... } }`.

---

## Acceptance criteria

- [x] Compiles, lints, all vitest pass.
- [x] /settings#notifications renders three real cards.
- [x] PUT round-trips every field including rule subobjects.
- [x] Existing `email`/`inApp` toggles still persist and read.
- [x] Notifications TabSpec flipped to `"ready"`.

---

## Out of scope (deferred)

- The worker / cron jobs that **send** the Slack / Teams webhook
  POSTs and SMTP emails for these events. Where an emitter
  already exists (e.g. `src/services/email/*` if any), adding a
  channel multiplexer is small and lands in a follow-on
  M-165b. Where it doesn't, the rule toggle persists today and
  is connected when the emitter is built.
- Webhook URL deliverability test (a "Send test" button next to
  each webhook field) — would need a worker round-trip; deferred
  to M-165b.
- Per-recipient channel preferences (today: every recipient gets
  every email rule they're subscribed to). Future enhancement.

These follow the established R-phase pattern.
