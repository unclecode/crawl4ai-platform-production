import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
  const backendUrl = "http://api2.crawl4ai.com";

  // Construct the full URL
  const url = new URL(request.url);
  const targetUrl = `${backendUrl}${url.pathname}${url.search}`;

  // Forward the request to the backend
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Secret": context.env.GATEWAY_SECRET
    },
    body: request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined,
  });

  return response;
}
