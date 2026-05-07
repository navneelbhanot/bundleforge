/**
 * Cap-warning email template (M-202).
 *
 * Sent once when a Starter shop crosses 80% of its monthly bundle
 * order cap. Goal: convert the merchant to Growth before the wall
 * hits at 100%. Tone: helpful heads-up, not alarmist.
 */
import type { EmailTemplate } from "..";

export interface CapWarningArgs {
  shopName: string;
  count: number;
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

export function capWarningTemplate(args: CapWarningArgs): EmailTemplate {
  const { shopName, count, cap, upgradeUrl } = args;
  const remaining = Math.max(0, cap - count);
  const subject = `${shopName}: ${count} of ${cap} BundleForge orders used this month`;

  const text =
    `Hi ${shopName},\n` +
    `\n` +
    `Heads up — your shop has used ${count} of its ${cap} monthly bundle\n` +
    `orders on the BundleForge Starter plan. That's about ${remaining} bundle\n` +
    `orders left before new bundle checkouts will be paused for the rest of\n` +
    `the month.\n` +
    `\n` +
    `Upgrading to Growth ($12/month) gives you unlimited bundle orders and\n` +
    `unblocks all the paid-tier features (audit trail, live chat, basic\n` +
    `analytics, AI suggestions).\n` +
    `\n` +
    `Upgrade here:\n` +
    `${upgradeUrl}\n` +
    `\n` +
    `If you'd rather keep going with Starter, no action is needed — orders\n` +
    `will simply pause once the limit is reached, and resume on the 1st of\n` +
    `next month.\n` +
    `\n` +
    `— The BundleForge team\n`;

  const html =
    `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">` +
    `<h1 style="font-size:20px;margin:0 0 16px">Hi ${escapeHtml(shopName)},</h1>` +
    `<p>Heads up — your shop has used <strong>${count} of its ${cap} monthly bundle orders</strong> on the BundleForge Starter plan.</p>` +
    `<p>That's about <strong>${remaining} bundle orders</strong> left before new bundle checkouts will be paused for the rest of the month.</p>` +
    `<p style="margin:24px 0">` +
    `<a href="${escapeHtml(upgradeUrl)}" style="display:inline-block;background:#008060;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Upgrade to Growth</a>` +
    `</p>` +
    `<p style="color:#4b5563;font-size:14px">Growth is $12/month and unlocks unlimited bundle orders, audit trail, live chat support, basic analytics, and AI suggestions.</p>` +
    `<p style="color:#4b5563;font-size:14px">If you'd rather keep going with Starter, no action is needed — orders will simply pause once the limit is reached, and resume on the 1st of next month.</p>` +
    `<p style="color:#9ca3af;font-size:12px;margin-top:32px">— The BundleForge team</p>` +
    `</body></html>`;

  return { subject, html, text };
}
