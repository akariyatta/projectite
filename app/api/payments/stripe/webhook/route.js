import { confirmPayment } from "@/lib/booking-flow";
import { query } from "@/lib/db";
import { stripeEnabled, verifyWebhook } from "@/lib/payments";

// Stripe → POST /api/payments/stripe/webhook (set this URL + STRIPE_WEBHOOK_SECRET in the Stripe dashboard).
// Confirms bookings even if the customer closes the browser before returning to the site.
export async function POST(request) {
  if (!stripeEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) return new Response("Webhook not configured", { status: 503 });

  let event;
  try {
    event = verifyWebhook(await request.text(), request.headers.get("stripe-signature"));
  } catch (e) {
    return new Response(`Bad signature: ${e.message}`, { status: 400 });
  }

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    const s = event.data.object;
    if (s.payment_status === "paid") {
      const code = s.metadata?.booking_code ?? s.client_reference_id;
      const [booking] = await query("SELECT id FROM bookings WHERE booking_code = ?", [code]);
      const intent = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
      if (booking) await confirmPayment(booking.id, intent);
    }
  }
  return Response.json({ received: true });
}
