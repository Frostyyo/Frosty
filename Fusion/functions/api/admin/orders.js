import { hasAdminSession } from "../../_lib/auth.js";
import { json } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  if (!(await hasAdminSession(request, env.SESSION_SECRET))) return json({ error: "Please sign in." }, 401);
  if (!env.DB) return json({ error: "Orders database is not connected." }, 503);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const allowed = new Set(["pending", "confirmed", "shipped", "delivered", "cancelled"]);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 200);

  try {
    let result;
    if (status && allowed.has(status)) {
      result = await env.DB.prepare(
        "SELECT id, created_at, customer_name, phone, address, notes, items_json, status FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ?",
      ).bind(status, limit).all();
    } else {
      result = await env.DB.prepare(
        "SELECT id, created_at, customer_name, phone, address, notes, items_json, status FROM orders ORDER BY created_at DESC LIMIT ?",
      ).bind(limit).all();
    }
    const orders = (result.results || []).map((row) => ({
      ...row,
      items: (() => { try { return JSON.parse(row.items_json || "[]"); } catch { return []; } })(),
      items_json: undefined,
    }));
    return json({ ok: true, orders });
  } catch {
    return json({ error: "Could not load orders." }, 500);
  }
}
