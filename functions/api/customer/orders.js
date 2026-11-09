import { getCustomerId } from "../../_lib/customer-auth.js";
import { json } from "../../_lib/http.js";
export async function onRequestGet({request,env}) {
  const customerId = await getCustomerId(request,env.SESSION_SECRET);
  if (!customerId) return json({error:"Please sign in."},401);
  if (!env.DB) return json({error:"Database not connected."},503);
  try {
    const result = await env.DB.prepare(
      "SELECT id, created_at, notes, items_json, status FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100"
    ).bind(customerId).all();
    const orders = (result.results || []).map(row => ({
      id:row.id,
      created_at:row.created_at,
      notes:row.notes,
      status:row.status,
      items:(()=>{try{return JSON.parse(row.items_json || "[]");}catch{return [];}})()
    }));
    return json({ok:true,orders});
  } catch {
    return json({error:"Could not load your orders. Please check that the customer database migration has been applied."},500);
  }
}
