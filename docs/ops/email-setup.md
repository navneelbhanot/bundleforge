# Email setup — Workspace + Resend

MintBundle uses two providers for email, on the same domain but
deliberately separated:

| Channel | Provider | Address | Purpose |
| --- | --- | --- | --- |
| Inbound merchant ↔ human | Google Workspace | `support@mintbundle.app` | Replies, support conversations |
| Outbound app → merchant | Resend | `notifications@mail.mintbundle.app` | Cap warnings, trial-ending notices, etc. |

Splitting onto a subdomain (`mail.mintbundle.app`) isolates the
transactional sender reputation from the human inbox. If a
templated email ever gets flagged as spam by a few recipients,
`support@` deliverability is unaffected.

This doc walks the Resend half of the setup. The Workspace half
is already done (you confirmed earlier in the M-202 conversation).

---

## Prerequisites

- Domain `mintbundle.app` is on Cloudflare DNS. (Verified during
  the deploy fix in session 0199 — `app.mintbundle.app` resolves
  via Cloudflare → Railway.)
- Workspace MX + DKIM records already published; `support@mintbundle.app`
  receives mail.
- You have admin access to Cloudflare Dashboard → DNS for
  `mintbundle.app`.
- You have Railway access for the MintBundle production service so
  you can add an env var.

---

## 1. Sign up for Resend

1. Go to [https://resend.com](https://resend.com).
2. Sign up using your `support@mintbundle.app` (or personal) Workspace
   email — there's no separate Resend account verification cost.
3. The free tier allows 3,000 emails/month and 100/day. That's
   enough for the first ~12 months at our projected volume.

---

## 2. Add the sending subdomain

1. In Resend's dashboard, click **Domains** → **Add Domain**.
2. Enter `mail.mintbundle.app` (NOT the bare `mintbundle.app` — we
   want the subdomain to keep the sender reputation isolated).
3. Region: pick **us-east-1** (closest to Railway's primary region).
4. Resend will display **four DNS records** to add. Keep that page
   open.

---

## 3. Paste the DNS records into Cloudflare

In Cloudflare Dashboard → `mintbundle.app` → **DNS**, click
**Add record** for each of the four:

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| MX | `send.mail` | `feedback-smtp.us-east-1.amazonses.com` (priority 10) | DNS only |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | DNS only |
| TXT | `resend._domainkey.mail` | (long string Resend gives you) | DNS only |
| TXT | `_dmarc.mail` | `v=DMARC1; p=none;` | DNS only |

**Important:** all four must be set to **"DNS only"** (grey cloud),
not "Proxied". Cloudflare proxying breaks SPF/DKIM/DMARC.

> **Note:** the exact MX hostname (`...amazonses.com`) and the DKIM
> public key vary per Resend account. Always copy from your Resend
> dashboard, don't reuse what's printed here.

---

## 4. Verify

Back in Resend's dashboard, click **Verify DNS records**. You'll see
each record flip to ✓ as Cloudflare propagates (typically 5–30 min,
sometimes faster).

When all four are ✓ the domain shows **Verified**. Resend will let you
send from `anything@mail.mintbundle.app` — we use
`notifications@mail.mintbundle.app` per the default in
`src/services/email/client.ts`.

---

## 5. Generate an API key

1. In Resend, **API Keys** → **Create API Key**.
2. Name: `mintbundle-production`. Permission: **Sending access**.
   Domain: **mail.mintbundle.app**.
3. Copy the value (it starts with `re_`). **You can't see it again
   after this page closes.**

---

## 6. Add the key to Railway

In Railway → MintBundle service → **Variables** → **+ New Variable**:

```
RESEND_API_KEY = re_…
```

(Optional, only if you want to override the default From header:)

```
EMAIL_FROM = MintBundle <notifications@mail.mintbundle.app>
```

Save. Railway redeploys. Wait for the health check to flip green.

---

## 7. Smoke test

Two options:

**Option A — Resend dashboard:**

1. Resend → **Logs** → **Send test email**.
2. From: `notifications@mail.mintbundle.app`.
3. To: your personal email.
4. Confirm the email lands (check spam if it doesn't appear in
   inbox within 30 sec).

**Option B — through the app (proves the wiring):**

1. Force a Starter shop's monthly count to 80 via the dev store.
   Either:
   - Place 80 bundle test orders on `devstore-2u6u4fcc.myshopify.com`,
     OR
   - Open Railway's shell and run a one-shot Prisma update to
     fast-forward the count.
2. Place one more bundle order. The `ordersCreate` webhook fires
   `maybeNotifyCapStatus`, which sends the cap-warning email to the
   shop's `email` field.
3. Check that inbox. Verify the email arrived from
   `notifications@mail.mintbundle.app`, the subject contains
   "80 of 100", and the **Upgrade to Growth** button links to your
   embedded admin's `/settings#billing`.

---

## What sends today (M-202)

- **Cap-warning** — Starter shop crosses 80% of monthly bundle
  order cap. Sent at most once per shop per calendar month.
- **Cap-reached** — Starter shop crosses 100%. Sent at most once
  per shop per calendar month.

## What sends later (deferred)

- **Trial-ending** — needs M-203 (daily cron job).
- **Welcome on install** — TBD.
- **Plan-change confirmation** — TBD.

---

## Troubleshooting

**Resend dashboard shows "Pending" for >1 hour.**
Check Cloudflare proxy status — make sure all four records are
"DNS only" (grey cloud). Run `dig TXT _dmarc.mail.mintbundle.app +short`
from your terminal and confirm the value matches what Resend wants.

**Email lands in Promotions / Spam tab.**
This is the cold-start reputation problem. Send 5–10 test emails to
your own real inbox (Gmail, Outlook, iCloud) over a couple days,
mark them as **Not spam** / **Move to Inbox**. Reputation builds
within a week of consistent low-volume sending.

**App logs show `RESEND_API_KEY unset — email skipped`.**
The env var didn't reach the running container. In Railway, check
that the variable is on the *web* service (not just the worker
service), then trigger a redeploy if needed.

**`maybeNotifyCapStatus` returns `send_failed`.**
Check the structured log entry — it'll include the Resend error
message. Common causes: DKIM not yet verified, From header doesn't
match a verified sender domain, or rate limit hit (free tier is
100/day).
