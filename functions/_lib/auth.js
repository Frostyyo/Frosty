const COOKIE_NAME = "fusion_admin";
const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signingKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function cookieHeader(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function createAdminCookie(secret) {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const payload = toBase64Url(encoder.encode(JSON.stringify({ exp: expiresAt })));
  const key = await signingKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return cookieHeader(`${payload}.${toBase64Url(signature)}`, 8 * 60 * 60);
}

export async function clearAdminCookie() {
  return cookieHeader("", 0);
}

export async function hasAdminSession(request, secret) {
  if (!secret) return false;
  const cookieHeaderValue = request.headers.get("Cookie") || "";
  const pair = cookieHeaderValue.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!pair) return false;

  const token = pair.slice(COOKIE_NAME.length + 1);
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return false;

  try {
    const key = await signingKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return false;
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return Number.isFinite(data.exp) && data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function passwordMatches(input, expected) {
  if (typeof input !== "string" || typeof expected !== "string" || !expected) return false;
  const digest = async (value) => new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  const [a, b] = await Promise.all([digest(input), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
