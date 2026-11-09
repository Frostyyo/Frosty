const COOKIE_NAME = "fusion_customer";
const encoder = new TextEncoder();
const ITERATIONS = 210000;

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function toHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
function fromHex(value) {
  if (typeof value !== "string" || !/^[a-f0-9]+$/i.test(value) || value.length % 2) {
    throw new Error("Invalid stored credential.");
  }
  return Uint8Array.from(value.match(/.{2}/g), pair => parseInt(pair, 16));
}
async function signingKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign","verify"]);
}
async function passwordKey(password, salt) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:ITERATIONS,hash:"SHA-256"}, material, 256);
  return new Uint8Array(bits);
}
export async function hashCustomerPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await passwordKey(password, salt);
  return { salt: toHex(salt), hash: toHex(hash) };
}
export async function verifyCustomerPassword(password, saltHex, hashHex) {
  if (typeof password !== "string") return false;
  try {
    const [actual, expected] = await Promise.all([
      passwordKey(password, fromHex(saltHex)),
      Promise.resolve(fromHex(hashHex))
    ]);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
    return difference === 0;
  } catch { return false; }
}
function customerCookie(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export async function createCustomerCookie(secret, customerId) {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = toBase64Url(encoder.encode(JSON.stringify({sub:customerId,exp:expiresAt})));
  const key = await signingKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(payload)));
  return customerCookie(`${payload}.${toBase64Url(signature)}`,30 * 24 * 60 * 60);
}
export function clearCustomerCookie() {
  return customerCookie("",0);
}
export async function getCustomerId(request, secret) {
  if (!secret) return null;
  const cookieHeader = request.headers.get("Cookie") || "";
  const pair = cookieHeader.split(";").map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE_NAME}=`));
  if (!pair) return null;
  const token = pair.slice(COOKIE_NAME.length+1);
  const [payload,signature,extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  try {
    const key = await signingKey(secret);
    const valid = await crypto.subtle.verify("HMAC",key,fromBase64Url(signature),encoder.encode(payload));
    if (!valid) return null;
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return typeof data.sub === "string" && data.sub && Number.isFinite(data.exp) && data.exp > Date.now() ? data.sub : null;
  } catch { return null; }
}
