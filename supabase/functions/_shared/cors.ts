export function corsPolicy(request: Request, methods = "POST, OPTIONS") {
  const defaults = Deno.env.get("AMS_ENV") === "development" ? "http://localhost:8000" : "https://nkrishnakarthik2007-hash.github.io";
  const allowed = new Set((Deno.env.get("AMS_ALLOWED_ORIGINS") || defaults)
    .split(",").map(origin => origin.trim()).filter(Boolean));
  const origin = request.headers.get("Origin");
  const accepted = !origin || allowed.has(origin);
  const headers = new Headers({
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": methods,
    "Vary": "Origin",
  });
  if (origin && accepted) headers.set("Access-Control-Allow-Origin", origin);
  return { accepted, headers };
}

export function jsonResponse(request: Request, body: unknown, status = 200, methods = "POST, OPTIONS") {
  const { accepted, headers } = corsPolicy(request, methods);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (!accepted) return new Response(JSON.stringify({ error: "Origin is not allowed." }), { status: 403, headers });
  return new Response(JSON.stringify(body), { status, headers });
}
