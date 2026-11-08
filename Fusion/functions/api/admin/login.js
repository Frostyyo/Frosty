import { createAdminCookie, passwordMatches } from "../../_lib/auth.js";
import { json, readJson, isSameOrigin } from "../../_lib/http.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return json({ error: "Admin login is not configured. Add the required secrets in Cloudflare." }, 503);
  }

  let body;
  try {
    body = await readJson(request, 2_000);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const valid = await passwordMatches(body.password, env.ADMIN_PASSWORD);
  if (!valid) return json({ error: "Incorrect password." }, 401);

  return json({ ok: true }, 200, { "set-cookie": await createAdminCookie(env.SESSION_SECRET) });
}
