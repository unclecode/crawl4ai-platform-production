import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { environment } from "@zuplo/runtime";

/**
 * Outbound policy to add rate limit headers to responses
 *
 * This policy adds standard rate limiting headers to every response:
 * - RateLimit-Limit: Maximum requests allowed in the time window
 * - RateLimit-Remaining: Requests remaining in current window
 * - RateLimit-Reset: Seconds until the rate limit resets
 *
 * Also includes legacy X-RateLimit-* headers for compatibility
 */

// Rate limit configuration per tier (must match rate-limiting.ts)
const TIER_LIMITS: Record<string, number> = {
  free: 100,
  crawler: 280,
  spider: 1388,
  enterprise: 13888,
};

export default async function (
  response: Response,
  request: ZuploRequest,
  context: ZuploContext,
  options: any,
  policyName: string
) {
  // Get user info from request
  const user = request.user;
  const tier = (user?.data?.tier as string) || "free";
  const requestsAllowed = TIER_LIMITS[tier] || TIER_LIMITS.free;

  // Create a unique key for this user
  const userKey = user?.sub || "anonymous";

  // Try to get current usage from ZoneCache
  // Note: ZoneCache key format should match what rate-limit-inbound policy uses
  const cacheKey = `rate-limit:${userKey}`;

  let remaining = requestsAllowed;
  let resetTime = 3600; // Default to 1 hour in seconds

  try {
    // Try to read from environment cache if available
    // This is a best-effort approach since we can't directly access rate limit state
    const cache = await environment.get(cacheKey);

    if (cache) {
      const data = JSON.parse(cache);
      remaining = Math.max(0, requestsAllowed - (data.count || 0));

      // Calculate reset time
      if (data.windowStart) {
        const windowStart = new Date(data.windowStart).getTime();
        const now = Date.now();
        const windowDuration = 60 * 60 * 1000; // 60 minutes in milliseconds
        const elapsed = now - windowStart;
        resetTime = Math.max(0, Math.ceil((windowDuration - elapsed) / 1000));
      }
    }
  } catch (error) {
    // If we can't access cache, use default values
    context.log.warn(`Could not access rate limit cache: ${error}`);
  }

  // Add standard RateLimit headers (draft IETF spec)
  response.headers.set("RateLimit-Limit", requestsAllowed.toString());
  response.headers.set("RateLimit-Remaining", remaining.toString());
  response.headers.set("RateLimit-Reset", resetTime.toString());

  // Add legacy X-RateLimit headers for compatibility
  response.headers.set("X-RateLimit-Limit", requestsAllowed.toString());
  response.headers.set("X-RateLimit-Remaining", remaining.toString());
  response.headers.set("X-RateLimit-Reset", resetTime.toString());

  // Log for debugging
  context.log.info(
    `Rate limit headers: tier=${tier}, limit=${requestsAllowed}, remaining=${remaining}, reset=${resetTime}s`
  );

  return response;
}
