import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

/**
 * Stripe Billing Tracking - Outbound Policy
 *
 * Tracks successful API requests (2xx status codes) by sending usage records to Stripe.
 * This runs AFTER the backend responds, ensuring billing only occurs for successful requests.
 *
 * Error handling: Failures are logged but don't block user requests (graceful degradation).
 *
 * Requirements:
 * - Environment variables: STRIPE_SECRET_KEY_TEST, STRIPE_SECRET_KEY_LIVE, STRIPE_MODE
 * - Consumer metadata: stripeSubscriptionId, stripeSubscriptionItemId
 */

/**
 * Send usage record to Stripe API
 *
 * @param subscriptionItemId - Stripe subscription item ID
 * @param quantity - Usage quantity (typically 1 per request)
 * @param stripeKey - Stripe API secret key
 * @param context - Zuplo context for logging
 * @returns Promise<boolean> - true on success, false on failure
 */
async function sendStripeUsageRecord(
  subscriptionItemId: string,
  quantity: number,
  stripeKey: string,
  context: ZuploContext
): Promise<boolean> {
  const timestamp = Math.floor(Date.now() / 1000);

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/subscription_items/${subscriptionItemId}/usage_records`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `quantity=${quantity}&timestamp=${timestamp}&action=increment`,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      context.log.error(
        `Stripe usage record failed: status=${response.status}, error=${errorText}`
      );
      return false;
    }

    const data = await response.json();
    context.log.info(
      `Stripe usage record created: id=${data.id}, quantity=${quantity}, timestamp=${timestamp}`
    );
    return true;
  } catch (error) {
    context.log.error(`Stripe API request failed: ${error}`);
    return false;
  }
}

/**
 * Outbound policy to track billing for successful API requests
 *
 * This policy:
 * 1. Checks if the response was successful (2xx status code)
 * 2. Retrieves Stripe subscription info from user metadata
 * 3. Sends a usage record to Stripe API
 * 4. Gracefully handles errors without impacting user requests
 *
 * @param response - The backend response
 * @param request - The original Zuplo request with user data
 * @param context - The Zuplo context with env vars and logging
 * @returns The original response (unmodified)
 */
export default async function (
  response: Response,
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  // Only track successful requests (2xx status codes)
  if (response.status < 200 || response.status >= 300) {
    context.log.debug(
      `Skipping billing: non-success status code ${response.status}`
    );
    return response;
  }

  // Get user data from authenticated request
  const user = request.user;
  if (!user) {
    context.log.warn("Skipping billing: no authenticated user");
    return response;
  }

  // Extract Stripe subscription info from user metadata
  const subscriptionId = user.data?.stripeSubscriptionId as string | undefined;
  const subscriptionItemId = user.data?.stripeSubscriptionItemId as string | undefined;
  const tier = user.data?.tier as string | undefined;

  // Validate required Stripe metadata
  if (!subscriptionItemId) {
    // This is expected for free tier or users without subscriptions
    context.log.debug(
      `Skipping billing: no stripeSubscriptionItemId for user=${user.sub}, tier=${tier}`
    );
    return response;
  }

  // Get Stripe API key from environment
  const stripeMode = context.env.STRIPE_MODE || "test";
  const stripeKey = stripeMode === "live"
    ? context.env.STRIPE_SECRET_KEY_LIVE
    : context.env.STRIPE_SECRET_KEY_TEST;

  if (!stripeKey) {
    context.log.error(
      `Stripe key not configured: mode=${stripeMode}, missing STRIPE_SECRET_KEY_${stripeMode.toUpperCase()}`
    );
    return response;
  }

  // Send usage record to Stripe (async, non-blocking)
  // We don't await to avoid delaying the response to the user
  sendStripeUsageRecord(subscriptionItemId, 1, stripeKey, context)
    .then((success) => {
      if (success) {
        context.log.info(
          `Billing tracked: user=${user.sub}, tier=${tier}, subscriptionItemId=${subscriptionItemId}`
        );
      } else {
        context.log.warn(
          `Billing failed (non-blocking): user=${user.sub}, tier=${tier}`
        );
      }
    })
    .catch((error) => {
      // This should never happen since sendStripeUsageRecord catches errors
      context.log.error(`Unexpected billing error: ${error}`);
    });

  // Return the original response immediately (don't wait for Stripe)
  return response;
}
