import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { QuotaInfo } from "./quota-enforcement";

/**
 * Quota Headers - Outbound Policy
 *
 * This policy adds quota information to response headers.
 * Headers added:
 * - X-Quota-Limit: Monthly quota limit
 * - X-Quota-Used: Current month usage
 * - X-Quota-Remaining: Remaining quota
 * - X-Quota-Overage: Overage amount (0 if under quota)
 * - X-Quota-Overage-Rate: Cost per 1k requests for overage (if applicable)
 * - X-Quota-Reset-Date: Date when quota resets (first of next month)
 * - X-Quota-Tier: User's tier name
 *
 * This runs AFTER quota-enforcement (inbound) which populates the quotaInfo.
 */

/**
 * Outbound policy to add quota headers to responses
 *
 * This policy:
 * 1. Retrieves quota info from request.user.data.quotaInfo
 * 2. Creates new Response with quota headers
 * 3. Returns response with quota information for client transparency
 *
 * @param response - The backend response
 * @param request - The original Zuplo request with quota info
 * @param context - The Zuplo context with logging
 * @returns Response with quota headers added
 */
export default async function (
  response: Response,
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  // Get quota info from request user data
  const quotaInfo = request.user?.data?.quotaInfo as QuotaInfo | undefined;

  if (!quotaInfo) {
    context.log.debug("No quota info available (expected for unauthenticated requests)");
    return response;
  }

  // Create new headers object by cloning existing headers
  const newHeaders = new Headers(response.headers);

  // Add quota headers
  newHeaders.set("X-Quota-Limit", quotaInfo.limit.toString());
  newHeaders.set("X-Quota-Used", quotaInfo.used.toString());
  newHeaders.set("X-Quota-Remaining", quotaInfo.remaining.toString());
  newHeaders.set("X-Quota-Overage", quotaInfo.overage.toString());
  newHeaders.set("X-Quota-Reset-Date", quotaInfo.resetDate);
  newHeaders.set("X-Quota-Tier", quotaInfo.tier);

  // Add overage rate only if in overage or overage is possible
  if (quotaInfo.overageRate > 0) {
    newHeaders.set("X-Quota-Overage-Rate", `$${quotaInfo.overageRate.toFixed(2)}/1k`);
  }

  // Add warning header if in overage
  if (quotaInfo.isOverage) {
    const estimatedCost = (quotaInfo.overage / 1000) * quotaInfo.overageRate;
    newHeaders.set(
      "X-Quota-Warning",
      `Quota exceeded. Current overage: ${quotaInfo.overage} requests (~$${estimatedCost.toFixed(2)})`
    );
  }

  // Log for debugging
  context.log.info(
    `Quota headers: tier=${quotaInfo.tier}, limit=${quotaInfo.limit}, used=${quotaInfo.used}, ` +
    `remaining=${quotaInfo.remaining}, overage=${quotaInfo.overage}, isOverage=${quotaInfo.isOverage}`
  );

  // Create new response with updated headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
