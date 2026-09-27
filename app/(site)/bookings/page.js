import Link from "next/link";
import { requireCustomer } from "@/lib/customer";
import { query } from "@/lib/db";
import { itemImages } from "@/lib/catalog";
import { baht, label } from "@/lib/format";
import { sized } from "@/lib/images";

export const metadata = { title: "การจองของฉัน · Hotel Travel" };

const thaiDate = (d) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function MyBookings() {
  const user = await requireCustomer("/bookings");
  const rows = await query(
    `SELECT b.*, MIN(bi.start_date) AS trip_start, MAX(COALESCE(bi.end_date, bi.start_date)) AS trip_end,
            GROUP_CONCAT(bi.description ORDER BY bi.start_date SEPARATOR ' · ') AS items,
            (SELECT status FROM payments WHERE booking_id = b.id ORDER BY id DESC LIMIT 1) AS pay_status,
            (SELECT item_type FROM booking_items WHERE booking_id = b.id ORDER BY item_type = 'flight', start_date, id LIMIT 1) AS cover_type,
            (SELECT item_id FROM booking_items WHERE booking_id = b.id ORDER BY item_type = 'flight', start_date, id LIMIT 1) AS cover_id
     FROM bookings b LEFT JOIN booking_items bi ON bi.booking_id = b.id
     WHERE b.user_id = ? GROUP BY b.id ORDER BY b.created_at DESC`,
    [user.id],
  );
  // cover photo per booking: its first hotel/ticket (a flight only if that's all it has)
  const covers = await itemImages(rows.filter((b) => b.cover_type).map((b) => ({ item_type: b.cover_type, item_id: b.cover_id })));

  return (
    <>
      <div className="st-pagehead">
        <div className="st-wrap">
          <div className="st-eyebrow">My trips</div>
          <h1>การจองของฉัน</h1>
          <div>สวัสดี {user.name} · {user.email}</div>
        </div>
      </div>
      <div className="st-wrap st-pull">
        {rows.length === 0 ? (
          <div className="st-card st-empty">
            ยังไม่มีการจอง — <Link href="/hotels" className="st-link">เริ่มหาที่พัก</Link>
          </div>
        ) : (
          <div className="st-bookings">
            {rows.map((b) => (
              <Link key={b.id} href={`/bookings/${b.booking_code}`} className="st-booking-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sized(covers.get(`${b.cover_type}:${b.cover_id}`), 240)} alt="" className="st-booking-img" />
                <div style={{ minWidth: 0 }}>
                  <div className="st-row" style={{ gap: 8 }}>
                    <strong>{b.booking_code}</strong>
                    <span className={`st-badge st-badge--${b.status}`}>{label(b.status)}</span>
                    {b.status === "pending" && b.pay_status === "pending" && <span className="st-badge st-badge--pending">รอชำระเงิน</span>}
                  </div>
                  <div className="st-muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.items}</div>
                </div>
                <div className="st-muted" style={{ fontSize: 13 }}>🗓 {thaiDate(b.trip_start)} – {thaiDate(b.trip_end)}</div>
                <strong className="st-price" style={{ fontSize: 20 }}>{baht(b.total_amount)}</strong>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
