import { ZuploContext, ZuploRequest, CustomRateLimitDetails } from "@zuplo/runtime";

/**
 * Tier-based rate limiting for Crawl4AI Platform
 *
 * Rate limits per tier (requests per hour):
 * - free: 100 requests/hour
 * - crawler: 280 requests/hour
 * - spider: 1388 requests/hour
 * - enterprise: 13888 requests/hour
 */

// Rate limit configuration per tier
const TIER_LIMITS: Record<string, number> = {
  free: 100,
  crawler: 280,
  spider: 1388,
  enterprise: 13888,
};

/**
 * Custom rate limit function that returns rate limit details based on consumer tier
 *
 * @param request - The incoming Zuplo request with user authentication data
 * @param context - The Zuplo context
 * @param policyName - The name of the policy being applied
 * @returns CustomRateLimitDetails object with key, requestsAllowed, and timeWindowMinutes
 */
export function rateLimitByTier(
  request: ZuploRequest,
  context: ZuploContext,
  policyName: string
): CustomRateLimitDetails {
  // Get the authenticated user from the request
  const user = request.user;

  // Extract tier from user metadata, default to "free" if not set
  const tier = (user?.data?.tier as string) || "free";

  // Get the request limit for this tier, default to free tier if tier not recognized
  const requestsAllowed = TIER_LIMITS[tier] || TIER_LIMITS.free;

  // Log for debugging (can be viewed in Zuplo logs)
  context.log.info(`Rate limiting: user=${user?.sub}, tier=${tier}, limit=${requestsAllowed}/hour`);

  // Return rate limit configuration
  // - key: unique identifier per consumer (using sub from authentication)
  // - requestsAllowed: requests allowed in the time window
  // - timeWindowMinutes: 60 minutes (1 hour)
  return {
    key: user?.sub || "anonymous",
    requestsAllowed: requestsAllowed,
    timeWindowMinutes: 60, // 1 hour window for all tiers
  };
}
