import Link from "next/link";
import { Badge, PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { baht, label } from "@/lib/format";

export default async function Dashboard() {
  const admin = await requireAdmin();
  const [[stats], byStatus, recent, arrivals] = await Promise.all([
    query(`SELECT
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='paid') AS revenue,
      (SELECT COUNT(*) FROM bookings) AS bookings,
      (SELECT COUNT(*) FROM bookings WHERE status='pending') AS pending,
      (SELECT COUNT(*) FROM users) AS customers,
      (SELECT COUNT(*) FROM hotels WHERE is_active=1) AS hotels`),
    query("SELECT status, COUNT(*) AS n FROM bookings GROUP BY status"),
    query(`SELECT b.id, b.booking_code, b.status, b.total_amount, b.created_at, u.name
      FROM bookings b JOIN users u ON u.id = b.user_id ORDER BY b.created_at DESC LIMIT 6`),
    query(`SELECT bi.description, bi.item_type, bi.start_date, b.id AS booking_id, u.name
      FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id JOIN users u ON u.id = b.user_id
      WHERE bi.start_date >= CURDATE() AND b.status IN ('pending','confirmed')
      ORDER BY bi.start_date LIMIT 6`),
  ]);

  const tiles = [
    { icon: "💰", label: "รายได้ที่ชำระแล้ว", value: baht(stats.revenue) },
    { icon: "🧾", label: "การจองทั้งหมด", value: stats.bookings },
    { icon: "⏳", label: "รอดำเนินการ", value: stats.pending },
    { icon: "🏨", label: "โรงแรมที่เปิดขาย", value: stats.hotels },
  ];
  const total = byStatus.reduce((s, r) => s + Number(r.n), 0) || 1;

  return (
    <div className="adm-stack">
      <PageHead eyebrow="Dashboard" title={`สวัสดี, ${admin.name}`} subtitle="ภาพรวมการจองและรายได้ของเว็บไซต์" />

      <div className="adm-grid adm-grid-4">
        {tiles.map((t) => (
          <div key={t.label} className="adm-card adm-stat">
            <span className="adm-stat-icon">{t.icon}</span>
            <div className="adm-stat-label">{t.label}</div>
            <div className="adm-stat-value">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="adm-grid adm-grid-2">
        <div className="adm-card adm-card-flush">
          <div className="adm-card-head">
            <h2>การจองล่าสุด</h2>
            <Link href="/admin/bookings" className="adm-back">ดูทั้งหมด →</Link>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>รหัส</th><th>ลูกค้า</th><th>สถานะ</th><th className="adm-num">ยอด</th></tr></thead>
              <tbody>
                {recent.length === 0 && <tr><td colSpan={4} className="adm-empty">ยังไม่มีการจอง</td></tr>}
                {recent.map((b) => (
                  <tr key={b.id}>
                    <td><Link href={`/admin/bookings/${b.id}`} className="adm-link">{b.booking_code}</Link><div className="adm-muted" style={{ fontSize: 12 }}>{b.created_at.slice(0, 16)}</div></td>
                    <td>{b.name}</td>
                    <td><Badge value={b.status} /></td>
                    <td className="adm-num">{baht(b.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="adm-stack">
          <div className="adm-card">
            <h2>สถานะการจอง</h2>
            <div className="adm-stack" style={{ display: "grid", gap: 12 }}>
              {byStatus.length === 0 && <span className="adm-muted">ยังไม่มีข้อมูล</span>}
              {byStatus.map((s) => (
                <Link key={s.status} href={`/admin/bookings?status=${s.status}`} style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Badge value={s.status} /> <strong>{s.n}</strong>
                  </div>
                  <div style={{ height: 6, background: "#f1ece2", borderRadius: 4 }}>
                    <div style={{ width: `${(s.n / total) * 100}%`, height: "100%", background: "var(--gold)", borderRadius: 4 }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="adm-card">
            <h2>กำหนดการที่จะถึง</h2>
            {arrivals.length === 0 && <span className="adm-muted">ไม่มีกำหนดการ</span>}
            <div style={{ display: "grid", gap: 12 }}>
              {arrivals.map((a, i) => (
                <Link key={i} href={`/admin/bookings/${a.booking_id}`} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="adm-thumb" style={{ width: 48, height: 48, fontSize: 13, lineHeight: 1.1, textAlign: "center" }}>
                    {a.start_date.slice(8, 10)}<br />{a.start_date.slice(5, 7)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.description}</div>
                    <div className="adm-muted" style={{ fontSize: 12 }}>{label(a.item_type)} · {a.name}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
