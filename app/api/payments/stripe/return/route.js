import { redirect } from "next/navigation";
import { confirmPayment } from "@/lib/booking-flow";
import { query } from "@/lib/db";
import { readCheckout, stripeEnabled } from "@/lib/payments";

// Stripe sends the customer back here after Checkout. We ask Stripe directly whether the session
// is paid (never trust the URL), so payments are confirmed even without a webhook (handy locally).
export async function GET(request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!stripeEnabled() || !sessionId?.startsWith("cs_")) redirect("/bookings");

  let result;
  try {
    result = await readCheckout(sessionId);
  } catch (e) {
    console.error("Stripe return:", e);
    redirect("/bookings?error=" + encodeURIComponent("ตรวจสอบการชำระเงินไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง"));
  }
  const [booking] = await query("SELECT id, booking_code FROM bookings WHERE booking_code = ?", [result.bookingCode]);
  if (!booking) redirect("/bookings");
  const path = `/bookings/${encodeURIComponent(booking.booking_code)}`;

  if (result.paid) {
    await confirmPayment(booking.id, result.paymentIntent);
    redirect(`${path}?ok=${encodeURIComponent("ชำระเงินสำเร็จ — การจองได้รับการยืนยันแล้ว")}`);
  }
  // e.g. PromptPay still processing: the webhook will confirm it when the money arrives
  redirect(`${path}?ok=${encodeURIComponent("ได้รับข้อมูลการชำระเงินแล้ว ระบบจะยืนยันให้อัตโนมัติเมื่อเงินเข้า")}`);
}
