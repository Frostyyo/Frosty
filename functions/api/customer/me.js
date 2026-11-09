import { getCustomerId } from "../../_lib/customer-auth.js";
import { json } from "../../_lib/http.js";
export async function onRequestGet({request,env}) {
  const customerId = await getCustomerId(request,env.SESSION_SECRET);
  if (!customerId) return json({error:"Please sign in."},401);
  if (!env.DB) return json({error:"Database not connected."},503);
  const user = await env.DB.prepare("SELECT id, full_name, phone, created_at FROM customers WHERE id = ?")
    .bind(customerId).first();
  if (!user) return json({error:"Account not found."},404);
  return json({ok:true,user:{id:user.id,name:user.full_name,phone:user.phone,createdAt:user.created_at}});
}
