import { clearAdminCookie, hasAdminSession } from "../../_lib/auth.js";
import { json, isSameOrigin } from "../../_lib/http.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!(await hasAdminSession(request, env.SESSION_SECRET))) return json({ error: "Not signed in." }, 401);
  return json({ ok: true }, 200, { "set-cookie": await clearAdminCookie() });
}
