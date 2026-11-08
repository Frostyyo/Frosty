export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readJson(request, maxBytes = 16_000) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("Request is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new Error("Request is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON.");
  }
}
