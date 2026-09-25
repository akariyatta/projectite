import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, PageHead } from "@/components/admin/ui";
import { updateBooking, updatePayment } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { baht, label } from "@/lib/format";

const ICON = { room: "🛏️", flight: "✈️", ticket: "🎟️" };

export default async function BookingDetail({ params, searchParams }) {
  await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;

  const [booking] = await query(
    `SELECT b.*, u.name, u.email, u.phone FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.id = ?`,
    [Number(id)],
  );
  if (!booking) notFound();
  const [items, payments] = await Promise.all([
    query("SELECT * FROM booking_items WHERE booking_id = ? ORDER BY start_date, id", [booking.id]),
    query("SELECT * FROM payments WHERE booking_id = ? ORDER BY id", [booking.id]),
  ]);

  return (
    <div className="adm-stack" style={{ maxWidth: 1100 }}>
      <Link href="/admin/bookings" className="adm-back">← กลับไปหน้าการจอง</Link>
      <PageHead eyebrow={`Booking · ${booking.created_at.slice(0, 16)}`} title={booking.booking_code}>
        <Badge value={booking.status} />
      </PageHead>

      <Alert ok={saved && "บันทึกเรียบร้อยแล้ว"} />

      <div className="adm-grid adm-grid-2">
        <div className="adm-stack">
          <div className="adm-card adm-card-flush">
            <div className="adm-card-head"><h2>รายการที่จอง</h2></div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>รายการ</th><th>วันที่</th><th className="adm-num">จำนวน</th><th className="adm-num">ราคา</th></tr></thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ICON[it.item_type]} {it.description}</div>
                        <div className="adm-muted" style={{ fontSize: 12 }}>{label(it.item_type)}</div>
                      </td>
                      <td>{it.start_date ?? "—"}{it.end_date && ` → ${it.end_date}`}</td>
                      <td className="adm-num">{it.quantity} × {baht(it.unit_price)}</td>
                      <td className="adm-num">{baht(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adm-total"><span>ยอดรวม</span><strong>{baht(booking.total_amount)}</strong></div>
          </div>

          <div className="adm-card adm-card-flush">
            <div className="adm-card-head"><h2>การชำระเงิน</h2></div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>ช่องทาง</th><th className="adm-num">จำนวน</th><th>ชำระเมื่อ</th><th>สถานะ</th></tr></thead>
                <tbody>
                  {payments.length === 0 && <tr><td colSpan={4} className="adm-empty">ยังไม่มีการชำระเงิน</td></tr>}
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{label(p.method)}</td>
                      <td className="adm-num">{baht(p.amount)}</td>
                      <td>{p.paid_at?.slice(0, 16) ?? "—"}</td>
                      <td>
                        <form action={updatePayment.bind(null, p.id, booking.id)} className="adm-row" style={{ flexWrap: "nowrap" }}>
                          <select name="status" defaultValue={p.status} className="adm-input" style={{ width: 150 }}>
                            {["pending", "paid", "failed", "refunded"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                          </select>
                          <button className="adm-btn-ghost" style={{ padding: "8px 12px" }}>อัปเดต</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="adm-stack">
          <div className="adm-card">
            <h2>ข้อมูลลูกค้า</h2>
            <dl className="adm-dl">
              <dt>ชื่อ</dt><dd>{booking.name}</dd>
              <dt>อีเมล</dt><dd>{booking.email}</dd>
              <dt>เบอร์โทร</dt><dd>{booking.phone ?? "—"}</dd>
            </dl>
            <div style={{ marginTop: 14 }}>
              <Link href={`/admin/customers/${booking.user_id}`} className="adm-back">ดูโปรไฟล์ลูกค้า →</Link>
            </div>
          </div>

          <form action={updateBooking.bind(null, booking.id)} className="adm-card adm-form">
            <h2 style={{ marginBottom: 0 }}>จัดการการจอง</h2>
            <label className="adm-field">
              <span>สถานะ</span>
              <select name="status" defaultValue={booking.status} className="adm-input">
                {["pending", "confirmed", "completed", "cancelled"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            </label>
            <label className="adm-field">
              <span>บันทึกภายใน</span>
              <textarea name="note" rows={4} defaultValue={booking.note ?? ""} className="adm-input" placeholder="เช่น ลูกค้าขอเตียงเสริม" />
            </label>
            <button className="adm-btn">บันทึก</button>
          </form>
        </div>
      </div>
    </div>
  );
}
