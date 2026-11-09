import { createCustomerCookie, verifyCustomerPassword } from "../../_lib/customer-auth.js";
import { json, readJson, isSameOrigin } from "../../_lib/http.js";

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length === 12) digits = "0" + digits.slice(2);
  return digits;
}
export async function onRequestPost({request,env}) {
  if (!isSameOrigin(request)) return json({error:"Invalid request origin."},403);
  if (!env.DB || !env.SESSION_SECRET) return json({error:"Customer accounts are not configured yet."},503);
  let body;
  try { body = await readJson(request,4000); } catch(error) { return json({error:error.message},400); }
  const phone = normalizePhone(body.phone);
  if (!/^01[0125][0-9]{8}$/.test(phone) || typeof body.password !== "string") {
    return json({error:"Incorrect phone number or password."},401);
  }
  const user = await env.DB.prepare(
    "SELECT id, full_name, phone, password_salt, password_hash FROM customers WHERE phone = ?"
  ).bind(phone).first();
  if (!user || !(await verifyCustomerPassword(body.password,user.password_salt,user.password_hash))) {
    return json({error:"Incorrect phone number or password."},401);
  }
  return json({ok:true,user:{id:user.id,name:user.full_name,phone:user.phone}},200,
    {"set-cookie":await createCustomerCookie(env.SESSION_SECRET,user.id)});
}
