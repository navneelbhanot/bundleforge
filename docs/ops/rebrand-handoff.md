# Rebrand handoff — BundleForge → MintBundle (M-210)

The codebase is fully renamed (175+ files, 0 remaining references,
typecheck clean, 902/915 tests pass). Now the user-side operational
work to make the new brand actually live. Follow steps in order.

---

## 1. Register domains (~10 min)

Go to your domain registrar (or Namecheap, Porkbun, Cloudflare
Registrar — all support `.app`):

- **`mintbundle.app`** — required, ~$15/yr.
- **`mintbundle.com`** — strongly recommended, ~$13/yr.

Both were verified unregistered as of 2026-05-07. Speed matters
here: with the bundling space heating up (3 new apps launched in
the last 7 days), squatters could grab the .com.

---

## 2. Cloudflare DNS — mirror the bundleforge.app setup

In Cloudflare → **Add a site** → enter `mintbundle.app`. Point
your registrar's nameservers at the Cloudflare-provided ones.

Then in Cloudflare DNS for `mintbundle.app`, add (mirror what
you have for `bundleforge.app` today):

- A record: `app` → Railway's IP (or CNAME to your Railway URL,
  proxied/orange-cloud).
- (Optional) MX/TXT records for `mail.mintbundle.app` once you
  set up Resend (step 7).

---

## 3. Partner Dashboard — create a new app

**Don't rename the existing BundleForge draft.** Create a new app:

1. Partner Dashboard → **Apps** → **Create app**.
2. Distribution method: **Public app** (App Store distribution).
3. Name: `MintBundle`.
4. App URL: `https://app.mintbundle.app`.
5. Allowed redirection URL(s):
   - `https://app.mintbundle.app/api/auth/callback`
6. Keep the new app in **Draft** status until you submit.
7. Once created: copy the **Client ID** and **Client Secret**.

The old "BundleForge" draft entry can be deleted later (or kept as
a graveyard — it doesn't cost anything).

---

## 4. Update `shopify.app.toml` with the new client_id

The codebase already has the new name + URL. Only the `client_id`
needs to update:

```toml
client_id = "<paste new MintBundle client_id from Partner Dashboard>"
```

Currently it still has the old BundleForge client_id
(`59b24b4db1e954a95e3f82df96e713bb`) — the rebrand pass did NOT
touch it because that's a UUID-style identifier, not a renamable
string.

Commit the change:

```bash
git add shopify.app.toml
git commit -m "Update client_id to new MintBundle Partner Dashboard app"
git push origin main
```

---

## 5. Railway environment — swap credentials

In Railway → MintBundle service → **Variables**:

- `SHOPIFY_API_KEY` = (new client_id from step 3)
- `SHOPIFY_API_SECRET` = (new client_secret from step 3)
- `SHOPIFY_APP_URL` = `https://app.mintbundle.app`
- `EMAIL_FROM` (optional) = `MintBundle <notifications@mail.mintbundle.app>`

Save (auto-redeploys). The container picks up the new env vars
on next start. The webhook fix (M-209) ensures HMAC validation
passes on day one of the new app's life — no more silent uninstall
losses.

---

## 6. (Optional) Sell `bundleforge.app` to JRL Software

You paid ₹15k for 5 years of `bundleforge.app`. JRL launched their
"BundleForge" Shopify app under a different domain. Cold email
through their App Store listing's support link:

> Subject: Acquiring `bundleforge.app` for your Shopify app
>
> Hi,
>
> I noticed you launched a Shopify app named BundleForge on May 1.
> I own `bundleforge.app` and `bundleforge.com` (registered earlier
> as part of a different project that's now rebranded). Would you
> be interested in acquiring either or both? Premium .app domains
> for matching Shopify SaaS brands typically transact in the
> $500–$2000 range.
>
> Happy to discuss pricing.

Realistic recovery: $300–$1500 USD. If they pass, fall back to
**Plan B**: 301-redirect `bundleforge.app` → `mintbundle.app` so
any existing backlinks / marketing material forward.

---

## 7. Resend — new sending domain

Mirror your current Resend setup but for `mail.mintbundle.app`:

1. Resend → **Domains** → **Add Domain** → `mail.mintbundle.app`.
2. Resend gives you four DNS records (MX, SPF, DKIM, DMARC).
3. Add them in Cloudflare DNS for `mintbundle.app`. **DNS only**
   (grey cloud), not Proxied.
4. Wait for verification (5–30 min).
5. Generate a new API key, name it `mintbundle-production`.
6. In Railway, replace `RESEND_API_KEY` with the new value.

The old `mail.bundleforge.app` Resend setup can be deleted later.

---

## 8. Workspace — `support@mintbundle.app` alias

Two options:

- **Cheap:** Cloudflare Email Routing on `mintbundle.app` →
  forward `support@mintbundle.app` to your existing Workspace
  inbox. Free.
- **Branded:** Add `mintbundle.app` as a secondary domain in
  Workspace, route `support@` to your existing inbox. Costs
  Workspace's per-domain rate.

Keep `support@bundleforge.app` as a forwarding alias for any
historical references for ~6 months.

---

## 9. Redeploy Shopify Functions + Theme Extensions

Once steps 3–5 are done and Railway is on the new credentials:

```bash
cd ~/bundleforge   # (or rename the dir later)
git pull
npx shopify app deploy
```

This pushes:
- Cart Transform Function under the new app's `client_id`.
- Checkout Validation Function (Plus only).
- Three Flow extensions (force-inventory-sync, bundle-published,
  bundle-low-stock).
- Theme App Extension with the renamed asset files
  (`mintbundle.css`, `mintbundle-bundle.js`).

The `shopify app deploy` CLI will detect the new `client_id` from
`shopify.app.toml` and route everything to the MintBundle app
entry. The old BundleForge functions will keep running on the
old draft app (harmless — just deletable in Partner Dashboard
later).

---

## 10. Marketing site — point `mintbundle.app` apex at Cloudflare Pages

Your marketing site at `marketing/` is currently configured for
`bundleforge.app`. Update:

- Cloudflare Pages: change custom domain from `bundleforge.app`
  to `mintbundle.app`.
- Marketing copy: already updated by this rebrand pass — no extra
  work.

---

## 11. App Store submission

Once steps 1–10 are done and the dev store loads cleanly under
the new app:

1. Partner Dashboard → MintBundle → **Distribution** →
   **Manage submission**.
2. Walk `docs/launch/submission-checklist.md`.
3. Submit.
4. Shopify review takes 7–14 days. Approval comes via email.

---

## 12. Repository / GitHub rename (optional)

If you want the GitHub repo name to match the brand:

1. GitHub → repo settings → rename `bundleforge` → `mintbundle`.
2. Update local clones: `git remote set-url origin <new url>`.
3. Update Railway → connected repo (auto-detects but may need
   reconnect).

Don't rush this — repo rename is cosmetic. Brand alignment matters
on the App Store, not on GitHub.

---

## Sanity check before submitting

After steps 1–10, run this end-to-end smoke test:

1. Open incognito browser → visit
   `https://app.mintbundle.app/api/auth?shop=devstore-2u6u4fcc.myshopify.com`
   (or any fresh dev store).
2. Approve OAuth grant.
3. Embedded admin loads. Header shows "MintBundle" not BundleForge.
4. Navigate Settings → Billing tab. Plan cards render correctly.
5. Email tests: trigger a cap-warning by setting a Starter shop's
   `bundle_orders.created_at` count to 80 manually (Railway DB
   shell). Place one more order. Email arrives from
   `notifications@mail.mintbundle.app` with "MintBundle" subject.
6. `npx shopify app deploy` succeeds, Functions ship under
   the new app entry.

If all five pass, the rebrand is complete and you're ready to
submit.

---

## Time estimate

- Steps 1–5 (domains + Partner Dashboard + Railway): ~1 hour.
- Step 6 (sell domain, optional): async, can run for weeks.
- Steps 7–8 (Resend + Workspace): ~30 min.
- Step 9 (Shopify deploy): ~5 min.
- Step 10 (Cloudflare Pages): ~10 min.
- Step 11 (App Store submission): ~30 min once polished.
- Total active work: ~2.5 hours, spread over a day.
