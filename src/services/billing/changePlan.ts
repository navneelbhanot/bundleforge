/**
 * Plan change wrapper. Shopify replaces the existing recurring charge
 * automatically when a new one activates, so plan-change is mostly the
 * same as createSubscription.
 *
 * See docs/specs/M-034-cancel-and-change.md.
 */
import {
  createSubscription,
  type CreateSubscriptionArgs,
} from "./createSubscription";

export async function changePlan(
  args: CreateSubscriptionArgs,
): Promise<{ confirmationUrl: string; chargeId: string }> {
  return createSubscription(args);
}
