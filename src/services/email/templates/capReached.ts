/**
 * Cap-reached email template (M-202).
 *
 * Sent once when a Starter shop crosses 100% of its monthly bundle
 * order cap. The storefront /validate-cart proxy starts rejecting
 * new bundle checkouts at this point (M-200), so the email is
 * BOTH a transactional notice ("your store just changed
 * behaviour") AND the highest-conversion upgrade trigger we have.
 * Tone: factual, urgent without being alarmist, clear CTA.
 */
import type { EmailTemplate } from "..";

export interface CapReachedArgs {
  shopName: string;
  cap: number;
  /** Absolute URL to the embedded admin's Settings → Billing tab. */
  upgradeUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function capReachedTemplate(args: CapReachedArgs): EmailTemplate {
  const { shopName, cap, upgradeUrl } = args;
  const subject = `${shopName}: bundle checkouts are paused — you've reached the Starter limit`;

  const text =
    `Hi ${shopName},\n` +
    `\n` +
    `Your shop just hit the ${cap}-order monthly limit on the BundleForge\n` +
    `Starter plan. New bundle checkouts on your storefront are now paused\n` +
    `until either:\n` +
    `\n` +
    `  1. The 1st of next month, when the counter resets, or\n` +
    `  2. You upgrade to Growth, which removes the limit immediately.\n` +
    `\n` +
    `Customers trying to check out with a bundle right now will see a\n` +
    `friendly "this bundle is currently unavailable" message — non-bundle\n` +
    `products are unaffected.\n` +
    `\n` +
    `Upgrade to Growth ($12/month, unlimited bundle orders):\n` +
    `${upgradeUrl}\n` +
    `\n` +
    `Growth also unlocks audit trail, live chat support, basic analytics,\n` +
    `and AI suggestions.\n` +
    `\n` +
    `Questions? Reply to this email.\n` +
    `\n` +
    `— The BundleForge team\n`;

  const html =
    `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">` +
    `<h1 style="font-size:20px;margin:0 0 16px">Hi ${escapeHtml(shopName)},</h1>` +
    `<p>Your shop just hit the <strong>${cap}-order monthly limit</strong> on the BundleForge Starter plan. New bundle checkouts on your storefront are <strong>now paused</strong> until either:</p>` +
    `<ul style="line-height:1.6">` +
    `<li>The 1st of next month, when the counter resets, or</li>` +
    `<li>You upgrade to Growth — which removes the limit immediately.</li>` +
    `</ul>` +
    `<p>Customers trying to check out with a bundle right now will see a friendly "this bundle is currently unavailable" message. Non-bundle products are unaffected.</p>` +
    `<p style="margin:24px 0">` +
    `<a href="${escapeHtml(upgradeUrl)}" style="display:inline-block;background:#008060;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Upgrade to Growth</a>` +
    `</p>` +
    `<p style="color:#4b5563;font-size:14px">Growth is $12/month and unlocks unlimited bundle orders, audit trail, live chat support, basic analytics, and AI suggestions.</p>` +
    `<p style="color:#4b5563;font-size:14px">Questions? Just reply to this email.</p>` +
    `<p style="color:#9ca3af;font-size:12px;margin-top:32px">— The BundleForge team</p>` +
    `</body></html>`;

  return { subject, html, text };
}
