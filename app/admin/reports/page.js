import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { baht, label, THAI_MONTHS, THAI_MONTHS_FULL } from "@/lib/format";
import { breakdown, monthlyReport, reportYears, sum } from "@/lib/reports";

const ICON = { room: "🛏️", flight: "✈️", ticket: "🎟️" };

// Round the axis max up to 1 / 2 / 2.5 / 5 × 10^n so gridlines land on clean numbers
function niceMax(v) {
  if (v <= 0) return 1000;
  const mag = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= v);
}
const compact = (n) => (n >= 1e6 ? `฿${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `฿${+(n / 1e3).toFixed(1)}k` : `฿${n}`);

function Delta({ now, before, year }) {
  if (!before) return <span className="adm-muted">ไม่มีข้อมูลปี {year - 1}</span>;
  const pct = ((now - before) / before) * 100;
  const up = pct >= 0;
  return (
    <span className={up ? "adm-delta-up" : "adm-delta-down"}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% <span className="adm-muted">จากปี {year - 1}</span>
    </span>
  );
}

export default async function Reports({ searchParams }) {
  await requireAdmin();
  const years = await reportYears();
  const { year: y } = await searchParams;
  const year = years.includes(Number(y)) ? Number(y) : years[0];

  const [months, prevMonths, { byType, top }] = await Promise.all([
    monthlyReport(year),
    monthlyReport(year - 1),
    breakdown(year),
  ]);

  const revenue = sum(months, "revenue");
  const refunded = sum(months, "refunded");
  const bookings = sum(months, "bookings");
  const paidCount = sum(months, "paidCount");
  const max = niceMax(Math.max(...months.map((m) => m.revenue)));
  const ticks = [4, 3, 2, 1, 0].map((i) => (max / 4) * i);
  const best = months.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  const typeTotal = byType.reduce((s, t) => s + Number(t.revenue), 0) || 1;

  return (
    <div className="adm-stack">
      <PageHead eyebrow="Reports" title="รายงานยอดขาย" subtitle="รายได้จากการชำระเงินที่สำเร็จ แยกรายเดือน">
        <a href={`/admin/reports/export?year=${year}`} className="adm-btn-ghost">⬇ ดาวน์โหลด CSV</a>
      </PageHead>

      <div className="adm-pills">
        {years.map((yr) => (
          <Link key={yr} href={`/admin/reports?year=${yr}`} className={`adm-pill ${yr === year ? "active" : ""}`}>
            ปี {yr}
          </Link>
        ))}
      </div>

      <div className="adm-grid adm-grid-4">
        <div className="adm-card adm-stat">
          <div className="adm-stat-label">รายได้ทั้งปี {year}</div>
          <div className="adm-stat-value">{baht(revenue)}</div>
          <div className="adm-stat-foot"><Delta now={revenue} before={sum(prevMonths, "revenue")} year={year} /></div>
        </div>
        <div className="adm-card adm-stat">
          <div className="adm-stat-label">การจอง</div>
          <div className="adm-stat-value">{bookings}</div>
          <div className="adm-stat-foot adm-muted">ยกเลิก {sum(months, "cancelled")} รายการ</div>
        </div>
        <div className="adm-card adm-stat">
          <div className="adm-stat-label">ยอดเฉลี่ยต่อการจอง</div>
          <div className="adm-stat-value">{baht(paidCount ? Math.round(revenue / paidCount) : 0)}</div>
          <div className="adm-stat-foot adm-muted">จาก {paidCount} การชำระเงิน</div>
        </div>
        <div className="adm-card adm-stat">
          <div className="adm-stat-label">คืนเงิน</div>
          <div className="adm-stat-value">{baht(refunded)}</div>
          <div className="adm-stat-foot adm-muted">
            {best.revenue > 0 ? <>เดือนที่ขายดีที่สุด: {THAI_MONTHS_FULL[best.month - 1]}</> : "ยังไม่มียอดขาย"}
          </div>
        </div>
      </div>

      {/* Monthly revenue — single series, so no legend; the title names it */}
      <div className="adm-card">
        <h2>รายได้รายเดือน ปี {year}</h2>
        <div className="adm-chart" role="img" aria-label={`กราฟแท่งรายได้รายเดือน ปี ${year} รายละเอียดอยู่ในตารางด้านล่าง`}>
          <div className="adm-chart-y">
            {ticks.map((t) => <span key={t}>{compact(t)}</span>)}
          </div>
          <div className="adm-chart-plot">
            {ticks.map((t) => (
              <div
                key={t}
                className={`adm-chart-grid ${t === 0 ? "is-base" : ""}`}
                style={{ bottom: `calc(26px + (100% - 26px) * ${t / max})` }}
              />
            ))}
            {months.map((m) => (
              <div
                key={m.month}
                className={`adm-chart-col ${m.month <= 2 ? "tip-left" : m.month >= 11 ? "tip-right" : ""}`}
                tabIndex={0}
              >
                <div className="adm-chart-bar" style={{ height: `${(m.revenue / max) * 100}%` }}>
                  {m === best && m.revenue > 0 && <span className="adm-chart-value">{compact(m.revenue)}</span>}
                  <div className="adm-chart-tip" role="tooltip">
                    <strong>{THAI_MONTHS_FULL[m.month - 1]} {year}</strong>
                    <span>รายได้ <b>{baht(m.revenue)}</b></span>
                    <span>การจอง {m.bookings} · ยกเลิก {m.cancelled}</span>
                    {m.refunded > 0 && <span>คืนเงิน {baht(m.refunded)}</span>}
                  </div>
                </div>
                <span className="adm-chart-x">{THAI_MONTHS[m.month - 1]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="adm-grid adm-grid-2">
        <div className="adm-card adm-card-flush">
          <div className="adm-card-head"><h2>ตารางรายเดือน</h2></div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>เดือน</th><th className="adm-num">การจอง</th><th className="adm-num">ยกเลิก</th><th className="adm-num">คืนเงิน</th><th className="adm-num">รายได้</th></tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className={m.bookings || m.revenue ? undefined : "adm-row-empty"}>
                    <td>{THAI_MONTHS_FULL[m.month - 1]}</td>
                    <td className="adm-num">{m.bookings}</td>
                    <td className="adm-num">{m.cancelled}</td>
                    <td className="adm-num">{m.refunded ? baht(m.refunded) : "—"}</td>
                    <td className="adm-num"><strong>{baht(m.revenue)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>รวม</strong></td>
                  <td className="adm-num"><strong>{bookings}</strong></td>
                  <td className="adm-num"><strong>{sum(months, "cancelled")}</strong></td>
                  <td className="adm-num"><strong>{baht(refunded)}</strong></td>
                  <td className="adm-num"><strong>{baht(revenue)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="adm-stack">
          <div className="adm-card">
            <h2>รายได้ตามประเภท</h2>
            {byType.length === 0 && <span className="adm-muted">ยังไม่มีข้อมูล</span>}
            <div style={{ display: "grid", gap: 14 }}>
              {byType.map((t) => {
                const pct = (Number(t.revenue) / typeTotal) * 100;
                return (
                  <div key={t.item_type} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{ICON[t.item_type]} {label(t.item_type)}</span>
                      <span><strong>{baht(t.revenue)}</strong> <span className="adm-muted">· {pct.toFixed(0)}%</span></span>
                    </div>
                    <div className="adm-meter"><div style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="adm-card">
            <h2>ขายดี 5 อันดับ</h2>
            {top.length === 0 && <span className="adm-muted">ยังไม่มีข้อมูล</span>}
            <ol className="adm-rank">
              {top.map((t) => (
                <li key={t.description}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{ICON[t.item_type]} {t.description}</div>
                    <div className="adm-muted" style={{ fontSize: 12 }}>{label(t.item_type)} · {Number(t.qty)} รายการ</div>
                  </div>
                  <strong>{baht(t.revenue)}</strong>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
