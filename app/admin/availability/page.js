import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { occupancy } from "@/lib/inventory";
import { THAI_MONTHS } from "@/lib/format";

const DAYS = 14;
const WEEKDAY = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const shift = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export default async function Availability({ searchParams }) {
  await requireAdmin();
  const { from: f } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(f ?? "") ? f : today;
  const { nights, rooms } = await occupancy(from, DAYS);

  return (
    <div className="adm-stack">
      <PageHead eyebrow="Availability" title="ห้องว่าง" subtitle="จำนวนห้องที่ถูกจองในแต่ละคืน (นับเฉพาะการจองที่ยังไม่ยกเลิก)">
        <Link href={`/admin/availability?from=${shift(from, -DAYS)}`} className="adm-btn-ghost">← {DAYS} วันก่อน</Link>
        <Link href="/admin/availability" className="adm-btn-ghost">วันนี้</Link>
        <Link href={`/admin/availability?from=${shift(from, DAYS)}`} className="adm-btn-ghost">{DAYS} วันถัดไป →</Link>
      </PageHead>

      <div className="adm-row" style={{ gap: 16, fontSize: 13 }}>
        <span><i className="adm-occ-key adm-occ--free" /> ว่างทั้งหมด</span>
        <span><i className="adm-occ-key adm-occ--some" /> จองบางส่วน</span>
        <span><i className="adm-occ-key adm-occ--most" /> เหลือน้อย (≥ 80%)</span>
        <span><i className="adm-occ-key adm-occ--full" /> เต็ม</span>
        <span className="adm-muted">ตัวเลข = ห้องที่เหลือ / ทั้งหมด</span>
      </div>

      <div className="adm-card adm-card-flush">
        <div className="adm-table-wrap">
          <table className="adm-table adm-occ">
            <thead>
              <tr>
                <th>ห้องพัก</th>
                {nights.map((n) => {
                  const d = new Date(`${n}T00:00:00Z`);
                  return (
                    <th key={n} className={n === today ? "is-today" : undefined}>
                      <span>{WEEKDAY[d.getUTCDay()]}</span>
                      <strong>{d.getUTCDate()}</strong>
                      <span>{THAI_MONTHS[d.getUTCMonth()]}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 && <tr><td colSpan={DAYS + 1} className="adm-empty">ยังไม่มีห้องพัก</td></tr>}
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.hotel}</div>
                    <div className="adm-muted" style={{ fontSize: 12 }}>{r.name} · {r.city} · {r.total_rooms} ห้อง</div>
                  </td>
                  {r.cells.map((c) => {
                    const left = c.total - c.used;
                    const ratio = c.total ? c.used / c.total : 1;
                    const tone = left <= 0 ? "full" : ratio >= 0.8 ? "most" : c.used > 0 ? "some" : "free";
                    return (
                      <td key={c.night} className={`adm-occ--${tone}`} title={`${c.night}: จองแล้ว ${c.used} / ${c.total} ห้อง`}>
                        {Math.max(0, left)}<small>/{c.total}</small>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
