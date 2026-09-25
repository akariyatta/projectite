import Link from "next/link";
import { Badge, PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { baht, label } from "@/lib/format";

const STATUSES = ["pending", "confirmed", "completed", "cancelled"];

export default async function Bookings({ searchParams }) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";

  const where = [];
  const params = [];
  if (STATUSES.includes(status)) { where.push("b.status = ?"); params.push(status); }
  if (search) { where.push("(b.booking_code LIKE ? OR u.name LIKE ? OR u.email LIKE ?)"); params.push(...Array(3).fill(`%${search}%`)); }

  const rows = await query(
    `SELECT b.*, u.name, u.email,
       (SELECT GROUP_CONCAT(DISTINCT item_type) FROM booking_items WHERE booking_id = b.id) AS types,
       (SELECT status FROM payments WHERE booking_id = b.id ORDER BY id DESC LIMIT 1) AS pay_status
     FROM bookings b JOIN users u ON u.id = b.user_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY b.created_at DESC LIMIT 200`,
    params,
  );

  const qs = (s) => `/admin/bookings?${new URLSearchParams({ ...(s && { status: s }), ...(search && { q: search }) })}`;

  return (
    <div className="adm-stack">
      <PageHead eyebrow="Reservations" title="การจอง" subtitle="การจองโรงแรม เที่ยวบิน และตั๋วงานทั้งหมดจากหน้าเว็บ" />

      <div className="adm-row" style={{ justifyContent: "space-between" }}>
        <div className="adm-pills">
          <Link href={qs()} className={`adm-pill ${!status ? "active" : ""}`}>ทั้งหมด</Link>
          {STATUSES.map((s) => (
            <Link key={s} href={qs(s)} className={`adm-pill ${status === s ? "active" : ""}`}>{label(s)}</Link>
          ))}
        </div>
        <form className="adm-search">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={search} placeholder="รหัสการจอง / ชื่อ / อีเมล" className="adm-input" />
          <button className="adm-btn-ghost">ค้นหา</button>
        </form>
      </div>

      <div className="adm-card adm-card-flush">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>รหัสการจอง</th><th>ลูกค้า</th><th>รายการ</th><th>สถานะ</th><th>การชำระ</th><th className="adm-num">ยอดรวม</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="adm-empty">ไม่พบการจอง</td></tr>}
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/admin/bookings/${b.id}`} className="adm-link">{b.booking_code}</Link>
                    <div className="adm-muted" style={{ fontSize: 12 }}>{b.created_at.slice(0, 16)}</div>
                  </td>
                  <td>{b.name}<div className="adm-muted" style={{ fontSize: 12 }}>{b.email}</div></td>
                  <td>{(b.types ?? "").split(",").filter(Boolean).map(label).join(" · ") || "—"}</td>
                  <td><Badge value={b.status} /></td>
                  <td>{b.pay_status ? <Badge value={b.pay_status} /> : <span className="adm-muted">—</span>}</td>
                  <td className="adm-num">{baht(b.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
