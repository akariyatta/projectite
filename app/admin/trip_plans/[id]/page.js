import Link from "next/link";
import { notFound } from "next/navigation";
import TripPlanner from "@/components/admin/TripPlanner";
import { PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { aiEnabled, loadCatalog } from "@/lib/planner";

export default async function TripPlanPage({ params }) {
  await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";

  let plan = null;
  if (!isNew) {
    const [row] = await query("SELECT * FROM trip_plans WHERE id = ?", [Number(id)]);
    if (!row) notFound();
    let parsed = { summary: "", days: [] };
    try { parsed = { ...parsed, ...JSON.parse(row.plan ?? "{}") }; } catch {}
    // Old plans stored items as plain strings — turn them into activity items
    parsed.days = (parsed.days ?? []).map((d, i) => ({
      day: i + 1,
      date: d.date ?? "",
      title: d.title ?? "",
      items: (d.items ?? []).map((it) => (typeof it === "string" ? { time: "", type: "activity", ref_id: null, title: it, note: "", cost: 0 } : it)),
    }));
    plan = {
      ...row,
      start_date: row.start_date?.slice(0, 10) ?? "",
      end_date: row.end_date?.slice(0, 10) ?? "",
      budget: row.budget === null ? "" : Number(row.budget),
      plan: parsed,
    };
  }

  const [customers, catalog] = await Promise.all([
    query("SELECT id, name, email FROM users ORDER BY name"),
    loadCatalog(),
  ]);

  return (
    <div className="adm-stack" style={{ maxWidth: 1100 }}>
      <Link href="/admin/trip_plans" className="adm-back">← กลับไปหน้าแผนเที่ยว</Link>
      <PageHead
        eyebrow={isNew ? "New trip" : `Trip · #${id}`}
        title={isNew ? "สร้างแผนเที่ยว" : plan.title}
        subtitle={isNew ? "กรอกข้อมูลการเดินทาง แล้วเลือกว่าจะวางเอง หรือให้ AI เสนอ 3 แผน" : null}
      />
      <TripPlanner id={isNew ? null : Number(id)} initial={plan} customers={customers} catalog={catalog} aiEnabled={aiEnabled()} />
    </div>
  );
}
