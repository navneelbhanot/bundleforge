# MintBundle — Privacy Policy

**Effective date:** {{effective_date}}
**Operator:** {{operating_entity}} ("we", "us", "MintBundle")
**Contact:** {{privacy_email}}

> Template — fill in placeholders before publishing.

## 1. Scope

This policy applies to merchants who install the MintBundle Shopify app
("the App") and to data flowing through the App. End-shoppers transact
through the merchant's Shopify storefront, not directly with us.

## 2. Data we receive from Shopify

When a merchant installs the App, Shopify shares the following with us via
the Shopify Admin API and webhooks:

- **Shop metadata**: shop domain, shop GID, currency, timezone, locale,
  primary email, plan name.
- **Products + variants**: SKUs, titles, prices, inventory levels.
- **Orders involving a MintBundle bundle**: order ID, line items, total,
  currency, customer locale (no PII beyond what is required to process
  inventory and reporting).
- **App-Bridge session tokens**: short-lived JWTs to authenticate admin
  requests; never persisted.

We do **not** receive or store: customer names, email addresses, phone
numbers, payment instruments, or shipping addresses. The App is
SKU-and-bundle scoped.

## 3. How we use it

- **Operate the service**: compute bundle pricing, atomically adjust
  inventory, attribute orders to bundles, surface analytics to the
  merchant.
- **Improve the service**: aggregate, anonymized usage signals (counts of
  bundles created, average pricing-rule cardinality, etc.).
- **Support**: respond to merchant questions; the support team only
  accesses a shop's data when the merchant explicitly asks for help.

We do **not** sell data, do **not** use it for advertising, and do
**not** share it with third parties except as listed in section 5.

## 4. Retention

- **Live data**: kept for the lifetime of the merchant's installation.
- **Audit log**: kept for 18 months to meet financial-reporting needs
  (configurable per merchant request).
- **Backups**: hourly logical backups retained for 7 days, then deleted.
- **On uninstall**: Shopify sends `app/uninstalled`; we mark the shop
  inactive and purge all data within 48 hours unless the merchant
  reinstalls (Shopify's `shop/redact` webhook follows 48h after
  uninstall, which we honor as a hard delete).

## 5. Sub-processors

| Vendor | Purpose | Region |
| --- | --- | --- |
| Shopify | platform | Global |
| {{hosting_vendor}} | application hosting | {{region}} |
| {{db_vendor}} | managed Postgres | {{region}} |
| {{redis_vendor}} | managed Redis | {{region}} |
| Sentry | error monitoring (no PII) | {{region}} |
| Datadog | metrics + logs | {{region}} |

## 6. Merchant rights (GDPR / CCPA)

Merchants may at any time:

- **Export** their shop data: `POST /api/v1/gdpr/export`. Returns a JSON
  bundle of every record we hold for the shop (credentials redacted).
- **Delete** their shop data: `POST /api/v1/gdpr/delete-shop`. Hard-
  deletes the shop and all related rows; cascade is enforced at the
  database level.
- Equivalent webhook flows (`customers/data_request`,
  `customers/redact`, `shop/redact`) are honored automatically.

## 7. Security

- AES-256-GCM at rest for Shopify access tokens.
- TLS 1.2+ in transit for all traffic.
- HMAC verification on every webhook + App Proxy request.
- Append-only audit log with database-level UPDATE protection.
- See our [security disclosure policy]({{security_url}}) for details.

## 8. Changes

We will notify merchants of material changes at least 30 days in advance
via email and in-app banner.

## 9. Contact

Questions: {{privacy_email}}.
EU representative: {{eu_representative}}.
