import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
  const backendUrl = "http://api2.crawl4ai.com";

  // Get gateway secret from environment
  const gatewaySecret = context.env.GATEWAY_SECRET;

  // Log error if secret is missing
  if (!gatewaySecret) {
    context.log.error("GATEWAY_SECRET environment variable not configured");
    throw new Error("Gateway secret not configured");
  }

  // Construct the full URL
  const url = new URL(request.url);
  const targetUrl = `${backendUrl}${url.pathname}${url.search}`;

  // Forward the request to the backend
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Secret": gatewaySecret
    },
    body: request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined,
  });

  return response;
}
