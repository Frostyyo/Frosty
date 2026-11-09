import { createCustomerCookie, hashCustomerPassword } from "../../_lib/customer-auth.js";
import { json, readJson, isSameOrigin } from "../../_lib/http.js";

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length === 12) digits = "0" + digits.slice(2);
  return digits;
}
function cleanText(value, max) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0,max) : "";
}

export async function onRequestPost({request,env}) {
  if (!isSameOrigin(request)) return json({error:"Invalid request origin."},403);
  if (!env.DB || !env.SESSION_SECRET) return json({error:"Customer accounts are not configured yet."},503);
  let body;
  try { body = await readJson(request,4000); } catch(error) { return json({error:error.message},400); }
  const name = cleanText(body.name,100);
  const phone = normalizePhone(body.phone);
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2) return json({error:"Please enter your full name."},400);
  if (!/^01[0125][0-9]{8}$/.test(phone)) return json({error:"Enter a valid Egyptian mobile number."},400);
  if (password.length < 10 || password.length > 128) return json({error:"Password must be at least 10 characters."},400);

  const credentials = await hashCustomerPassword(password);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO customers (id, full_name, phone, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id,name,phone,credentials.salt,credentials.hash,new Date().toISOString()).run();
  } catch(error) {
    const message = String(error?.message || "");
    if (/unique|constraint/i.test(message)) return json({error:"An account with this phone number already exists. Please sign in."},409);
    return json({error:"Could not create your account. Please try again."},500);
  }
  return json({ok:true,user:{id,name,phone}},201,{"set-cookie":await createCustomerCookie(env.SESSION_SECRET,id)});
}
