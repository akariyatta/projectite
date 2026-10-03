import { query, transaction } from "./db";
import { emails } from "./emails";
import { setBookingStatus } from "./inventory";
import { sendMail } from "./mail";
import { readCheckout, refund, stripeEnabled } from "./payments";

// What happens to a booking after it's placed: paid → confirmed, unpaid too long → expired,
// cancelled → refunded. Shared by the customer site, the admin and the Stripe routes.

export const HOLD_MINUTES = () => Math.max(5, Number(process.env.BOOKING_HOLD_MINUTES) || 30);

async function bookingWithUser(bookingId) {
  const [b] = await query(
    "SELECT b.*, u.name, u.email FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.id = ?",
    [bookingId],
  );
  return b;
}
const itemsOf = (bookingId) => query("SELECT * FROM booking_items WHERE booking_id = ? ORDER BY start_date, id", [bookingId]);

/** Email the customer about a booking. `kind` is a key of lib/emails.js. */
export async function notify(bookingId, kind, ...extra) {
  const b = await bookingWithUser(bookingId);
  if (!b) return;
  const user = { name: b.name, email: b.email };
  const needItems = kind === "bookingCreated" || kind === "paymentConfirmed";
  const { subject, html } = emails[kind](user, b, ...(needItems ? [await itemsOf(b.id)] : []), ...extra);
  await sendMail(b.email, subject, html);
}

/**
 * Mark a booking paid. Safe to call more than once (Stripe return page and webhook may both arrive).
 * Returns true only the first time.
 */
export async function confirmPayment(bookingId, providerRef = null) {
  const changed = await transaction(async (q) => {
    const [b] = await q("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
    if (!b || b.status !== "pending") return false;
    await q(
      "UPDATE payments SET status = 'paid', paid_at = NOW(), provider_ref = COALESCE(?, provider_ref) WHERE booking_id = ? AND status = 'pending'",
      [providerRef, bookingId],
    );
    await q("UPDATE bookings SET status = 'confirmed', expires_at = NULL WHERE id = ?", [bookingId]);
    return true;
  });
  if (changed) await notify(bookingId, "paymentConfirmed");
  return changed;
}

/**
 * Cancel a booking (customer or admin): returns stock, refunds a paid Stripe payment, emails the customer.
 * Throws with a Thai message if the refund fails (the booking is then left untouched).
 */
export async function cancelBooking(bookingId, { allowed = ["pending", "confirmed"] } = {}) {
  const [pay] = await query("SELECT * FROM payments WHERE booking_id = ? ORDER BY id DESC LIMIT 1", [bookingId]);
  // Refund first: if the bank refuses, nothing else changes
  if (pay?.status === "paid" && pay.provider === "stripe") await refund(pay.provider_ref);

  const done = await transaction(async (q) => {
    const [b] = await q("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
    if (!b || !allowed.includes(b.status)) return false;
    await setBookingStatus(q, b, "cancelled");
    await q(
      "UPDATE payments SET status = IF(status = 'paid', 'refunded', 'failed') WHERE booking_id = ? AND status IN ('paid','pending')",
      [bookingId],
    );
    return true;
  });
  if (done) await notify(bookingId, "bookingCancelled", pay?.status === "paid");
  return done;
}

let lastSweep = 0;

/**
 * Cancel pending bookings whose payment deadline passed (stock goes back on sale).
 * Called on normal page loads, at most once a minute, and from /api/cron/expire-bookings.
 * Before expiring a Stripe booking it double-checks Stripe, in case the payment just went through.
 */
export async function expireStaleBookings({ force = false } = {}) {
  if (!force && Date.now() - lastSweep < 60_000) return 0;
  lastSweep = Date.now();
  const due = await query(
    `SELECT b.id, p.provider, p.provider_ref FROM bookings b
     LEFT JOIN payments p ON p.booking_id = b.id AND p.status = 'pending'
     WHERE b.status = 'pending' AND b.expires_at IS NOT NULL AND b.expires_at < NOW()`,
  );
  let expired = 0;
  for (const row of due) {
    try {
      if (row.provider === "stripe" && row.provider_ref?.startsWith("cs_") && stripeEnabled()) {
        const s = await readCheckout(row.provider_ref);
        if (s.paid) { await confirmPayment(row.id, s.paymentIntent); continue; }
      }
      const changed = await transaction(async (q) => {
        const [b] = await q("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [row.id]);
        if (!b || b.status !== "pending") return false;
        await setBookingStatus(q, b, "cancelled");
        await q("UPDATE payments SET status = 'failed' WHERE booking_id = ? AND status = 'pending'", [row.id]);
        await q("UPDATE bookings SET note = CONCAT(COALESCE(note, ''), '[ระบบ] ยกเลิกอัตโนมัติ: หมดเวลาชำระเงิน') WHERE id = ?", [row.id]);
        return true;
      });
      if (changed) { expired++; await notify(row.id, "bookingExpired"); }
    } catch (e) {
      console.error("expire booking", row.id, e);
    }
  }
  return expired;
}
