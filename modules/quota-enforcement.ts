import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

/**
 * Quota Enforcement - Inbound Policy
 *
 * This policy checks monthly quota usage before allowing requests.
 * Features:
 * - Fetches current usage from Stripe API
 * - Compares against tier quota (100k, 1M, 10M)
 * - ALWAYS ALLOWS (pay-as-you-go model)
 * - Stores quota info in request context for headers
 * - Caches Stripe responses (1 minute TTL) to reduce API calls
 *
 * Error handling: Failures are graceful (fail open, allow request)
 *
 * Requirements:
 * - Environment variables: STRIPE_SECRET_KEY_TEST, STRIPE_SECRET_KEY_LIVE, STRIPE_MODE
 * - Consumer metadata: tier, stripeSubscriptionItemId, quota
 */

// Tier quotas (monthly requests)
const TIER_QUOTAS: Record<string, number> = {
  free: 10000,
  crawler: 100000,
  spider: 1000000,
  enterprise: 10000000,
};

// Overage rates ($ per 1000 requests)
const OVERAGE_RATES: Record<string, number> = {
  free: 0,        // No overage for free tier
  crawler: 0.50,  // $0.50/1k
  spider: 0.20,   // $0.20/1k
  enterprise: 0.10, // $0.10/1k
};

// Cache TTL in milliseconds (1 minute)
const CACHE_TTL = 60 * 1000;

/**
 * QuotaInfo structure stored in request context
 */
export interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
  overage: number;
  isOverage: boolean;
  overageRate: number;
  resetDate: string;
  tier: string;
}

/**
 * Cached usage data structure
 */
interface CachedUsage {
  usage: number;
  timestamp: number;
}

/**
 * Get monthly usage from Stripe API
 *
 * @param subscriptionItemId - Stripe subscription item ID
 * @param stripeKey - Stripe API secret key
 * @param context - Zuplo context for logging
 * @returns Promise<number> - Total usage for current period, or 0 on failure
 */
async function getMonthlyUsage(
  subscriptionItemId: string,
  stripeKey: string,
  context: ZuploContext
): Promise<number> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/subscription_items/${subscriptionItemId}/usage_record_summaries`,
      {
        headers: {
          Authorization: `Bearer ${stripeKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      context.log.warn(
        `Stripe usage query failed: status=${response.status}, error=${errorText}`
      );
      return 0; // Fail open
    }

    const data = await response.json();

    // Get the most recent period's usage
    if (data.data && data.data.length > 0) {
      const currentPeriod = data.data[0];
      context.log.info(
        `Stripe usage: subscriptionItemId=${subscriptionItemId}, usage=${currentPeriod.total_usage}`
      );
      return currentPeriod.total_usage || 0;
    }

    return 0;
  } catch (error) {
    context.log.error(`Stripe usage query exception: ${error}`);
    return 0; // Fail open
  }
}

/**
 * Get cached usage or fetch from Stripe
 *
 * @param subscriptionItemId - Stripe subscription item ID
 * @param stripeKey - Stripe API secret key
 * @param context - Zuplo context
 * @returns Promise<number> - Current usage
 */
async function getCachedUsage(
  subscriptionItemId: string,
  stripeKey: string,
  context: ZuploContext
): Promise<number> {
  const cacheKey = `quota-usage:${subscriptionItemId}`;

  try {
    // Try to get cached value
    const cached = await environment.get(cacheKey);

    if (cached) {
      const cachedData: CachedUsage = JSON.parse(cached);
      const age = Date.now() - cachedData.timestamp;

      if (age < CACHE_TTL) {
        context.log.debug(
          `Using cached usage: age=${Math.round(age / 1000)}s, usage=${cachedData.usage}`
        );
        return cachedData.usage;
      }
    }
  } catch (error) {
    context.log.warn(`Cache read failed: ${error}`);
  }

  // Cache miss or expired, fetch from Stripe
  const usage = await getMonthlyUsage(subscriptionItemId, stripeKey, context);

  // Store in cache
  try {
    const cacheData: CachedUsage = {
      usage,
      timestamp: Date.now(),
    };
    await environment.set(cacheKey, JSON.stringify(cacheData), CACHE_TTL / 1000);
  } catch (error) {
    context.log.warn(`Cache write failed: ${error}`);
  }

  return usage;
}

/**
 * Calculate reset date (first day of next month)
 */
function getResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Inbound policy to enforce quota limits (pay-as-you-go)
 *
 * This policy:
 * 1. Retrieves tier and Stripe subscription info from user metadata
 * 2. Fetches current usage from Stripe (with caching)
 * 3. Calculates quota status (limit, used, remaining, overage)
 * 4. ALWAYS ALLOWS request (pay-as-you-go model)
 * 5. Stores quota info in request context for headers
 * 6. Gracefully handles errors (fail open)
 *
 * @param request - The incoming Zuplo request
 * @param context - The Zuplo context with env vars and logging
 * @param policyName - The name of the policy being applied
 * @returns The original request with quotaInfo attached to user data
 */
export default async function (
  request: ZuploRequest,
  context: ZuploContext,
  policyName: string
): Promise<ZuploRequest> {
  // Get user data from authenticated request
  const user = request.user;

  if (!user) {
    context.log.warn("Quota enforcement: no authenticated user");
    return request;
  }

  // Extract tier and quota from user metadata
  const tier = (user.data?.tier as string) || "free";
  const quota = TIER_QUOTAS[tier] || TIER_QUOTAS.free;
  const overageRate = OVERAGE_RATES[tier] || 0;

  // Extract Stripe subscription info
  const subscriptionItemId = user.data?.stripeSubscriptionItemId as string | undefined;

  // Default quota info (for free tier or users without Stripe)
  let usage = 0;

  // Fetch usage from Stripe if available
  if (subscriptionItemId) {
    // Get Stripe API key from environment
    const stripeMode = context.env.STRIPE_MODE || "test";
    const stripeKey = stripeMode === "live"
      ? context.env.STRIPE_SECRET_KEY_LIVE
      : context.env.STRIPE_SECRET_KEY_TEST;

    if (stripeKey) {
      usage = await getCachedUsage(subscriptionItemId, stripeKey, context);
    } else {
      context.log.error(
        `Stripe key not configured: mode=${stripeMode}, missing STRIPE_SECRET_KEY_${stripeMode.toUpperCase()}`
      );
    }
  } else {
    context.log.debug(
      `No Stripe subscription for user=${user.sub}, tier=${tier} (expected for free tier)`
    );
  }

  // Calculate quota status
  const remaining = Math.max(0, quota - usage);
  const overage = Math.max(0, usage - quota);
  const isOverage = usage >= quota;
  const resetDate = getResetDate();

  // Create quota info object
  const quotaInfo: QuotaInfo = {
    limit: quota,
    used: usage,
    remaining,
    overage,
    isOverage,
    overageRate,
    resetDate,
    tier,
  };

  // Store quota info in request user data (for headers and billing)
  if (!user.data) {
    user.data = {};
  }
  user.data.quotaInfo = quotaInfo;

  // Log quota status
  if (isOverage) {
    context.log.warn(
      `Quota overage: user=${user.sub}, tier=${tier}, used=${usage}, quota=${quota}, overage=${overage}`
    );
  } else {
    context.log.info(
      `Quota check: user=${user.sub}, tier=${tier}, used=${usage}, remaining=${remaining}`
    );
  }

  // ALWAYS ALLOW (pay-as-you-go model)
  return request;
}
