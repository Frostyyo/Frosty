import { hasAdminSession } from "../../../_lib/auth.js";
import { json, readJson, isSameOrigin } from "../../../_lib/http.js";

const allowedStatuses = new Set(["pending", "confirmed", "shipped", "delivered", "cancelled"]);

export async function onRequestPatch({ request, env, params }) {
  if (!isSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!(await hasAdminSession(request, env.SESSION_SECRET))) return json({ error: "Please sign in." }, 401);
  if (!env.DB) return json({ error: "Orders database is not connected." }, 503);

  let body;
  try {
    body = await readJson(request, 2_000);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  if (!allowedStatuses.has(body.status)) return json({ error: "Invalid order status." }, 400);

  try {
    const result = await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?")
      .bind(body.status, params.id).run();
    if (!result.meta?.changes) return json({ error: "Order not found." }, 404);
    return json({ ok: true });
  } catch {
    return json({ error: "Could not update order." }, 500);
  }
}
