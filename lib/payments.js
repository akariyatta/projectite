import Stripe from "stripe";
import { appUrl } from "./mail";

// Real payments via Stripe Checkout (card + PromptPay, THB). Switched on by STRIPE_SECRET_KEY;
// without it the site uses the simulated "test mode" payment so everything still works locally.
//   STRIPE_SECRET_KEY      sk_test_... (test mode) or sk_live_...
//   STRIPE_WEBHOOK_SECRET  whsec_... — optional locally (the return page also verifies), needed in production

export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

let client;
const stripe = () => (client ??= new Stripe(process.env.STRIPE_SECRET_KEY));

const MIN_SESSION_MS = 31 * 60 * 1000; // Stripe requires a checkout session to live at least 30 minutes

/** Create a Stripe Checkout page for a pending booking. Returns { id, url }. */
export async function createCheckout({ booking, payment, user, items }) {
  const expires = Math.max(new Date(booking.expires_at.replace(" ", "T")).getTime(), Date.now() + MIN_SESSION_MS);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: payment.method === "promptpay" ? ["promptpay"] : ["card"],
    customer_email: user.email,
    client_reference_id: booking.booking_code,
    metadata: { booking_code: booking.booking_code, payment_id: String(payment.id) },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "thb",
          unit_amount: Math.round(Number(payment.amount) * 100), // satang
          product_data: {
            name: `การจอง ${booking.booking_code}`,
            description: items.map((i) => i.description).join(" · ").slice(0, 500),
          },
        },
      },
    ],
    expires_at: Math.floor(expires / 1000),
    success_url: `${appUrl()}/api/payments/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/bookings/${encodeURIComponent(booking.booking_code)}?error=${encodeURIComponent("ยกเลิกการชำระเงิน — ชำระใหม่ได้ก่อนหมดเวลา")}`,
  });
  return { id: session.id, url: session.url };
}

/** Look up a checkout session. Returns { paid, bookingCode, paymentIntent }. */
export async function readCheckout(sessionId) {
  const s = await stripe().checkout.sessions.retrieve(sessionId);
  return {
    paid: s.payment_status === "paid",
    bookingCode: s.metadata?.booking_code ?? s.client_reference_id,
    paymentIntent: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null,
  };
}

/** Verify a webhook call really came from Stripe. Throws if the signature is wrong. */
export function verifyWebhook(rawBody, signature) {
  return stripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

/** Full refund of a Stripe payment. `ref` is the payment intent id we stored when it was paid. */
export async function refund(ref) {
  if (!ref?.startsWith("pi_")) throw new Error("ไม่พบรหัสการชำระเงินของ Stripe สำหรับคืนเงิน");
  return stripe().refunds.create({ payment_intent: ref });
}
