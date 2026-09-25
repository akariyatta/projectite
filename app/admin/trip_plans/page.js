import Link from "next/link";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { PageHead } from "@/components/admin/ui";
import { deleteResource } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { baht } from "@/lib/format";
import { aiEnabled } from "@/lib/planner";

const SOURCES = { ai: "🤖 AI เสนอ", customer: "✍️ ลูกค้าวางเอง" };
const STYLE_TH = { budget: "ประหยัด", balanced: "สมดุล", premium: "พรีเมียม" };

function parsePlan(raw) {
  try {
    const p = JSON.parse(raw ?? "{}");
    const days = Array.isArray(p.days) ? p.days : [];
    const cost = days.flatMap((d) => d.items ?? []).reduce((s, it) => s + (Number(it?.cost) || 0), 0);
    return { days, cost, summary: p.summary ?? "" };
  } catch {
    return { days: [], cost: 0, summary: "" };
  }
}

export default async function TripPlans({ searchParams }) {
  await requireAdmin();
  const { source, q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";

  const where = [];
  const args = [];
  if (SOURCES[source]) { where.push("p.source = ?"); args.push(source); }
  if (search) { where.push("(p.title LIKE ? OR p.destination LIKE ? OR u.email LIKE ? OR u.name LIKE ?)"); args.push(...Array(4).fill(`%${search}%`)); }
  const rows = await query(
    `SELECT p.*, u.name AS customer, u.email FROM trip_plans p JOIN users u ON u.id = p.user_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY p.updated_at DESC LIMIT 100`,
    args,
  );
  const href = (s) => `/admin/trip_plans?${new URLSearchParams({ ...(s && { source: s }), ...(search && { q: search }) })}`;

  return (
    <div className="adm-stack">
      <PageHead
        eyebrow="Trip planner"
        title="แผนเที่ยว AI"
        subtitle={aiEnabled() ? "ลูกค้าวางเอง หรือให้ AI (Claude) เสนอแผนให้เลือก" : "ลูกค้าวางเอง หรือให้ระบบเสนอแผนให้เลือก — ใส่ ANTHROPIC_API_KEY เพื่อใช้ AI"}
      >
        <Link href="/admin/trip_plans/new" className="adm-btn adm-btn-gold">+ สร้างแผนเที่ยว</Link>
      </PageHead>

      <div className="adm-row" style={{ justifyContent: "space-between" }}>
        <div className="adm-pills">
          <Link href={href()} className={`adm-pill ${!SOURCES[source] ? "active" : ""}`}>ทั้งหมด</Link>
          {Object.entries(SOURCES).map(([k, v]) => (
            <Link key={k} href={href(k)} className={`adm-pill ${source === k ? "active" : ""}`}>{v}</Link>
          ))}
        </div>
        <form className="adm-search">
          {SOURCES[source] && <input type="hidden" name="source" value={source} />}
          <input name="q" defaultValue={search} placeholder="ชื่อแผน / ปลายทาง / ลูกค้า" className="adm-input" />
          <button className="adm-btn-ghost">ค้นหา</button>
        </form>
      </div>

      {rows.length === 0 && (
        <div className="adm-card adm-empty">{search || source ? "ไม่พบแผนเที่ยว" : "ยังไม่มีแผนเที่ยว — กด “สร้างแผนเที่ยว” เพื่อเริ่ม"}</div>
      )}

      <div className="adm-plan-grid">
        {rows.map((p) => {
          const plan = parsePlan(p.plan);
          return (
            <div key={p.id} className="adm-card adm-plan-card">
              <div className="adm-row" style={{ justifyContent: "space-between" }}>
                <span className={`adm-badge adm-badge--${p.source === "ai" ? "confirmed" : "pending"}`}>
                  {SOURCES[p.source]}{p.style ? ` · ${STYLE_TH[p.style]}` : ""}
                </span>
                <span className="adm-muted" style={{ fontSize: 12 }}>#{p.id}</span>
              </div>
              <Link href={`/admin/trip_plans/${p.id}`} className="adm-plan-title">{p.title}</Link>
              <div className="adm-muted" style={{ fontSize: 13 }}>
                📍 {p.destination} · 🗓 {p.start_date?.slice(0, 10) ?? "—"} → {p.end_date?.slice(0, 10) ?? "—"} · 👥 {p.travelers} คน
              </div>
              {plan.summary && <p className="adm-plan-summary">{plan.summary}</p>}
              <ol className="adm-plan-days">
                {plan.days.slice(0, 4).map((d, i) => (
                  <li key={i}><span>วัน {i + 1}</span> {d.title || `${d.items?.length ?? 0} รายการ`}</li>
                ))}
                {plan.days.length > 4 && <li className="adm-muted">…อีก {plan.days.length - 4} วัน</li>}
              </ol>
              <div className="adm-plan-foot">
                <div>
                  <div className="adm-muted" style={{ fontSize: 12 }}>{p.customer} · {p.email}</div>
                  <strong>{baht(plan.cost)}</strong>
                  {p.budget && <span className="adm-muted" style={{ fontSize: 12 }}> / งบ {baht(p.budget)}</span>}
                </div>
                <div className="adm-row" style={{ gap: 4, flexWrap: "nowrap" }}>
                  <Link href={`/admin/trip_plans/${p.id}`} className="adm-btn-text">เปิด</Link>
                  <form action={deleteResource.bind(null, "trip_plans", p.id)}>
                    <ConfirmButton className="adm-btn-text adm-btn-danger" title={`ลบแผน “${p.title}”?`}>ลบ</ConfirmButton>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
