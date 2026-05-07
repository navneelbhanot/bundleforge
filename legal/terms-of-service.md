# MintBundle — Terms of Service

**Effective date:** {{effective_date}}
**Operator:** {{operating_entity}} ("we", "us", "MintBundle")

> Template — fill in placeholders before publishing.

## 1. Service

MintBundle is a Shopify app providing product bundling, dynamic pricing,
inventory synchronization, analytics, and integration with third-party
fulfillment, marketing, and subscription services. The service is offered
on a SaaS basis, billed monthly or annually via Shopify's billing
platform.

## 2. Account

- Eligibility: any merchant with an active Shopify store may install the
  App.
- Authentication: handled by Shopify OAuth. We never receive merchant
  passwords.
- One installation per Shopify store.

## 3. Plans + billing

| Plan | Bundles | Orders / month | Monthly | Annual (–20%) |
| --- | --- | --- | --- | --- |
| Starter | 5 | 100 | $0 | $0 |
| Growth | unlimited | unlimited (fair use) | $12 | $115 |
| Pro | unlimited | unlimited (fair use) | $35 | $336 |
| Enterprise | unlimited | unlimited (fair use) | $129 | $1,238 |

- Paid plans (Growth, Pro, Enterprise) include a 14-day free trial.
  Starter is free with no trial.
- Annual billing is the monthly price × 12 with a 20% discount.
- Billing runs through Shopify's recurring application charge API; the
  merchant's existing Shopify payment method is the source of funds.
- Plan changes take effect immediately; proration follows Shopify's
  standard rules.

### 3.1 Fair use for "unlimited" paid plans

The "unlimited orders" benefit on paid plans is offered in good faith
to support normal commerce growth, including seasonal peaks, flash
sales, and large catalogues.

It is not intended to subsidise patterns of use that are abusive,
automated, or that materially degrade service for other merchants —
for example: traffic from non-storefront sources, scripted
generation of bundle orders that are not real customer purchases,
or sustained volume that consumes a disproportionate share of
shared infrastructure (Shopify Admin API quotas, queue throughput,
database write capacity).

If we observe such a pattern on your shop we will:

1. **Contact you first.** We will reach out via your account email
   to explain what we are seeing, share the underlying numbers, and
   give you a reasonable opportunity (no less than 7 days) to
   adjust the workload, move to a more appropriate plan, or
   contest our reading of the data.
2. **Never silently throttle or rate-limit your real customer
   traffic.** Any action we take to protect shared infrastructure
   will be communicated to you in writing first, with the specific
   technical reason and a date by which it would take effect.
3. **Refund unused fees** on a pro-rata basis if you choose to
   uninstall in response.

We will not invoke this clause to extract additional fees from a
shop whose growth is the result of legitimate, customer-driven
order volume on existing bundles. The clause exists to address a
narrow set of adversarial or automated workloads, and to give us a
clear path to talk to a merchant before any technical change ever
affects their store.

## 4. Acceptable use

You agree **not** to:

- Use the App to facilitate illegal product sales.
- Reverse-engineer, redistribute, or resell the App.
- Use automated tools to circumvent rate limits.
- Install the App on stores you do not own or control.

## 5. Service-level commitment

We target **99.9% monthly uptime**, measured against the `/health`
endpoint. Outages caused by Shopify, our managed-infrastructure
providers, or scheduled maintenance windows (announced ≥72h in
advance) are excluded.

If we miss the SLA in any given month, eligible merchants on Pro+ may
request a service credit equal to 10% of that month's fee per 0.1%
below target, capped at 50%.

## 6. Data + ownership

- **Your data is yours.** You retain all rights to product, order,
  inventory, and analytics data.
- We hold a limited license solely to operate the App on your behalf.
- See the [Privacy Policy](privacy-policy.md) for data handling.

## 7. Termination

- You may uninstall the App at any time from Shopify Admin. Uninstall
  triggers the data-retention rules in the Privacy Policy.
- We may terminate for material breach with 30 days' notice (immediate
  for fraud, abuse, or chargeback).

## 8. Warranty + liability

THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY. EXCEPT AS REQUIRED BY
LAW, OUR AGGREGATE LIABILITY FOR ANY CLAIM IS LIMITED TO THE FEES PAID BY
THE MERCHANT IN THE 12 MONTHS PRECEDING THE CLAIM.

We are not liable for: lost profits, lost revenue, lost data beyond what
is recoverable from the most recent backup, or any indirect or
consequential damages.

## 9. Indemnification

You agree to defend us against third-party claims arising from your
products, your store, your use of the App contrary to these Terms, or
your violation of applicable law.

## 10. Governing law

These Terms are governed by the laws of {{governing_jurisdiction}};
disputes shall be resolved in the courts of {{venue}}.

## 11. Changes

Material changes will be communicated by email and in-app banner ≥30
days before they take effect. Continued use of the App after the change
constitutes acceptance.

## 12. Contact

Support: {{support_email}}.
Legal: {{legal_email}}.
