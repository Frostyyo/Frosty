import { json, readJson, isSameOrigin } from "../_lib/http.js";
import { getCustomerId } from "../_lib/customer-auth.js";

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, maxLength);
}

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.DB) return json({ error: "Orders database is not connected yet." }, 503);

  const customerId = await getCustomerId(request, env.SESSION_SECRET);
  if (!customerId) return json({ error: "Please create an account or sign in before placing an order." }, 401);

  let body;
  try {
    body = await readJson(request, 16_000);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const account = await env.DB.prepare(
    "SELECT id, full_name, phone FROM customers WHERE id = ?"
  ).bind(customerId).first();
  if (!account) return json({ error: "Your customer account could not be found. Please sign in again." }, 401);

  const customerName = cleanText(body.customerName, 100);
  const phone = cleanText(body.phone, 25);
  const address = cleanText(body.address, 350);
  const notes = cleanText(body.notes, 1000);
  if (customerName.length < 2) return json({ error: "Please enter your name." }, 400);
  if (!/^01[0125][0-9]{8}$/.test(phone)) return json({ error: "Please enter a valid Egyptian mobile number." }, 400);
  if (address.length < 5) return json({ error: "Please enter your delivery address." }, 400);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
    return json({ error: "Your order must contain between 1 and 30 items." }, 400);
  }

  const items = [];
  for (const item of body.items) {
    const name = cleanText(item?.name, 120);
    const variant = cleanText(item?.variant, 80);
    const quantity = Number(item?.quantity);
    const price = Number(item?.price);
    if (!name || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 ||
        !Number.isFinite(price) || price < 0 || price > 1000000) {
      return json({ error: "One of the order items is invalid." }, 400);
    }
    items.push({ name, variant, quantity, price });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO orders (id, customer_id, created_at, customer_name, phone, address, notes, items_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    ).bind(id, customerId, createdAt, customerName, phone, address, notes, JSON.stringify(items)).run();
  } catch {
    return json({ error: "We could not save your order. Please try again." }, 500);
  }

  return json({ ok: true, orderId: id, message: "Your order has been received." }, 201);
}
