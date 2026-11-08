/*
  Add an equivalent call to your existing Place Order handler.
  Replace the values below with the actual field/cart values from Fusion Website.html.
  Do not calculate or trust payment totals in the browser for online payments.
*/
async function sendFusionOrder({ customerName, phone, address, notes = "", cart }) {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName,
      phone,
      address,
      notes,
      items: cart.map((item) => ({
        name: item.name,
        variant: item.variant || "",
        quantity: Number(item.quantity),
      })),
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not place order.");
  return result.orderId;
}
