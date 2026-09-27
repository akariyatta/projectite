import Link from "next/link";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { requireCustomer } from "@/lib/customer";
import { query } from "@/lib/db";
import { baht } from "@/lib/format";
import { cityPhoto, sized } from "@/lib/images";
import { deleteMyTrip } from "@/lib/site-actions";

export const metadata = { title: "แผนเที่ยวของฉัน · Hotel Travel" };

const STYLE_TH = { budget: "ประหยัด", balanced: "สมดุล", premium: "พรีเมียม" };
const thaiDate = (d) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function MyPlans() {
  const user = await requireCustomer("/plans");
  const rows = await query("SELECT * FROM trip_plans WHERE user_id = ? ORDER BY updated_at DESC", [user.id]);

  return (
    <>
      <div className="st-pagehead">
        <div className="st-wrap">
          <div className="st-eyebrow">My plans</div>
          <h1>แผนเที่ยวของฉัน</h1>
          <div>แผนที่วางเอง หรือเลือกจากที่ AI เสนอ — เปิดแก้ต่อหรือเพิ่มลงตะกร้าได้ทุกเมื่อ</div>
        </div>
      </div>
      <div className="st-wrap st-pull st-stack">
        <div className="st-row" style={{ justifyContent: "flex-end" }}>
          <Link href="/plans/new" className="st-btn">✨ วางแผนเที่ยวใหม่</Link>
        </div>
        {rows.length === 0 && <div className="st-card st-empty">ยังไม่มีแผนเที่ยว — <Link href="/plans/new" className="st-link">เริ่มวางแผน</Link></div>}
        <div className="st-results" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {rows.map((p) => {
            let plan = { days: [], summary: "" };
            try { plan = { ...plan, ...JSON.parse(p.plan ?? "{}") }; } catch {}
            const cost = (plan.days ?? []).flatMap((d) => d.items ?? []).reduce((s, it) => s + (Number(it?.cost) || 0), 0);
            return (
              <div key={p.id} className="st-card" style={{ display: "grid", gap: 8, paddingTop: 0, overflow: "hidden" }}>
                <Link href={`/plans/${p.id}`} className="st-plan-cover" style={{ backgroundImage: `url(${sized(cityPhoto(p.destination), 700)})` }} />
                <span className={`st-badge ${p.source === "ai" ? "st-badge--confirmed" : "st-badge--pending"}`} style={{ justifySelf: "start" }}>
                  {p.source === "ai" ? `🤖 AI เสนอ${p.style ? ` · ${STYLE_TH[p.style]}` : ""}` : "✍️ วางเอง"}
                </span>
                <Link href={`/plans/${p.id}`}><h3 style={{ fontSize: 19 }}>{p.title}</h3></Link>
                <div className="st-muted" style={{ fontSize: 13 }}>📍 {p.destination} · 🗓 {thaiDate(p.start_date)} – {thaiDate(p.end_date)} · 👥 {p.travelers} คน</div>
                {plan.summary && <p style={{ fontSize: 13.5 }}>{plan.summary}</p>}
                <div className="st-row" style={{ justifyContent: "space-between", marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <strong className="st-price" style={{ fontSize: 20 }}>{baht(cost)}</strong>
                  <div className="st-row" style={{ gap: 4 }}>
                    <Link href={`/plans/${p.id}`} className="st-btn-ghost" style={{ padding: "7px 14px" }}>เปิด</Link>
                    <form action={deleteMyTrip.bind(null, p.id)}>
                      <ConfirmButton className="st-btn-ghost" confirmLabel="ลบแผน" title={`ลบแผน “${p.title}”?`} message="แผนที่ลบแล้วกู้คืนไม่ได้">ลบ</ConfirmButton>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
