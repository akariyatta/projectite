import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/admin/ConfirmButton";
import SubmitButton from "@/components/admin/SubmitButton";
import ClearCartAfterOrder from "@/components/site/ClearCartAfterOrder";
import Countdown from "@/components/site/Countdown";
import { addDaysStr, itemImages, todayStr } from "@/lib/catalog";
import { sized } from "@/lib/images";
import { requireCustomer } from "@/lib/customer";
import { query } from "@/lib/db";
import { baht, label } from "@/lib/format";
import { cancelMyBooking, payBooking } from "@/lib/site-actions";

const ICON = { room: "🏨", flight: "✈️", ticket: "🎟️" };
const thaiDate = (d) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "");

export default async function BookingPage({ params }) {
  const { code } = await params;
  const user = await requireCustomer(`/bookings/${code}`);
  const [booking] = await query("SELECT * FROM bookings WHERE booking_code = ? AND user_id = ?", [code, user.id]);
  if (!booking) notFound();
  const [items, payments] = await Promise.all([
    query("SELECT * FROM booking_items WHERE booking_id = ? ORDER BY start_date, id", [booking.id]),
    query("SELECT * FROM payments WHERE booking_id = ? ORDER BY id DESC", [booking.id]),
  ]);
  const payment = payments[0];
  const images = await itemImages(items);
  const firstDay = items.map((i) => i.start_date).filter(Boolean).sort()[0];
  const canCancel = ["pending", "confirmed"].includes(booking.status) && (!firstDay || firstDay > addDaysStr(todayStr(), 0));
  const awaitingPayment = booking.status === "pending" && payment?.status === "pending";

  return (
    <>
      <ClearCartAfterOrder />
      <div className="st-pagehead">
        <div className="st-wrap">
          <Link href="/bookings" className="st-link">← การจองของฉัน</Link>
          <h1>การจอง {booking.booking_code}</h1>
          <div className="st-row" style={{ gap: 8 }}>
            <span className={`st-badge st-badge--${booking.status}`}>{label(booking.status)}</span>
            <span>จองเมื่อ {thaiDate(booking.created_at)} {booking.created_at.slice(11, 16)}</span>
          </div>
        </div>
      </div>

      <div className="st-wrap st-pull st-two">
        <div className="st-card">
          <h2>รายการที่จอง</h2>
          {items.map((it) => (
            <div key={it.id} className="st-line">
              <div className="st-line-main">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sized(images.get(`${it.item_type}:${it.item_id}`), 200)} alt="" className="st-line-img" />
                <div>
                  <strong>{ICON[it.item_type]} {it.description}</strong>
                  <div className="st-muted" style={{ fontSize: 13 }}>
                    {thaiDate(it.start_date)}{it.end_date ? ` – ${thaiDate(it.end_date)}` : ""}
                  </div>
                </div>
              </div>
              <span className="st-muted">× {it.quantity}</span>
              <strong>{baht(it.subtotal)}</strong>
            </div>
          ))}
          <div className="st-total">
            <span>ยอดรวม</span>
            <strong className="st-price">{baht(booking.total_amount)}</strong>
          </div>
        </div>

        <aside className="st-card st-sticky" style={{ display: "grid", gap: 14 }}>
          <h2 style={{ margin: 0 }}>การชำระเงิน</h2>
          {payment && (
            <div className="st-row" style={{ justifyContent: "space-between" }}>
              <span>{label(payment.method)}</span>
              <span className={`st-badge st-badge--${payment.status}`}>{label(payment.status)}</span>
            </div>
          )}

          {awaitingPayment && (
            <>
              {booking.expires_at && <Countdown until={booking.expires_at} />}
              {payment.provider === "stripe" ? (
                <>
                  <p className="st-muted" style={{ fontSize: 13 }}>
                    ชำระ {baht(payment.amount)} ผ่าน{payment.method === "promptpay" ? " PromptPay QR" : "บัตรเครดิต/เดบิต"} บนหน้าชำระเงินที่ปลอดภัยของ Stripe
                  </p>
                  <form action={payBooking.bind(null, booking.booking_code)}>
                    <SubmitButton className="st-btn" pendingText="กำลังเปิดหน้าชำระเงิน…" style={{ width: "100%", padding: 13 }}>
                      🔒 ไปหน้าชำระเงิน
                    </SubmitButton>
                  </form>
                  <p className="st-test-note">ระบบไม่เก็บข้อมูลบัตรของคุณ — Stripe เป็นผู้ดูแลการชำระเงิน</p>
                </>
              ) : (
                <>
                  {payment.method === "promptpay" ? (
                    <div style={{ textAlign: "center" }}>
                      <div className="st-qr" aria-label="QR PromptPay (ตัวอย่าง)" />
                      <p className="st-muted" style={{ fontSize: 13 }}>สแกนเพื่อชำระ {baht(payment.amount)}</p>
                    </div>
                  ) : (
                    <p className="st-muted" style={{ fontSize: 13 }}>ชำระด้วยบัตรเครดิต/เดบิต จำนวน {baht(payment.amount)}</p>
                  )}
                  <form action={payBooking.bind(null, booking.booking_code)}>
                    <SubmitButton className="st-btn" pendingText="กำลังชำระเงิน…" style={{ width: "100%", padding: 13 }}>
                      {payment.method === "promptpay" ? "ฉันโอนเงินแล้ว" : "ชำระเงิน"}
                    </SubmitButton>
                  </form>
                  <p className="st-test-note">🔒 โหมดทดสอบ — กดแล้วถือว่าชำระสำเร็จ ไม่มีการตัดเงินจริง</p>
                </>
              )}
            </>
          )}
          {booking.status === "cancelled" && booking.note?.includes("หมดเวลาชำระเงิน") && (
            <div className="st-alert st-alert-error">⏳ ยกเลิกอัตโนมัติเพราะไม่ได้ชำระเงินภายในเวลาที่กำหนด</div>
          )}

          {booking.status === "confirmed" && <div className="st-alert st-alert-info">✓ การจองได้รับการยืนยันแล้ว แสดงรหัส {booking.booking_code} ตอนเช็คอิน/ขึ้นเครื่อง</div>}
          {booking.status === "cancelled" && <div className="st-alert st-alert-error">การจองนี้ถูกยกเลิกแล้ว{payment?.status === "refunded" ? " — คืนเงินแล้ว" : ""}</div>}

          {canCancel && (
            <form action={cancelMyBooking.bind(null, booking.booking_code)}>
              <ConfirmButton className="st-btn-ghost" confirmLabel="ยกเลิกการจอง" title={`ยกเลิกการจอง ${booking.booking_code}?`} message={payment?.status === "paid" ? "ระบบจะคืนเงินเต็มจำนวน" : "ที่นั่งและห้องจะถูกปล่อยให้คนอื่นจอง"}>
                ยกเลิกการจอง
              </ConfirmButton>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
