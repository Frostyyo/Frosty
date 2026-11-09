import { createAdminCookie, passwordMatches } from "../../_lib/auth.js";
import { json, readJson, isSameOrigin } from "../../_lib/http.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return json({ error: "Admin login is not configured. Add ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET in Cloudflare." }, 503);
  }

  let body;
  try {
    body = await readJson(request, 2_000);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const submittedUsername = typeof body.username === "string" ? body.username.trim() : "";
  const validUsername = submittedUsername === env.ADMIN_USERNAME;
  const validPassword = await passwordMatches(body.password, env.ADMIN_PASSWORD);
  if (!validUsername || !validPassword) {
    return json({ error: "Incorrect username or password." }, 401);
  }

  return json({ ok: true }, 200, { "set-cookie": await createAdminCookie(env.SESSION_SECRET) });
}
