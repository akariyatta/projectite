import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/admin/ui";
import TripPlanner from "@/components/planner/TripPlanner";
import { saveTripPlan, suggestTripPlans } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { aiEnabled, loadCatalog } from "@/lib/planner";
import { planForEditor } from "@/lib/trips";

export default async function TripPlanPage({ params }) {
  await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";

  let plan = null;
  if (!isNew) {
    const [row] = await query("SELECT * FROM trip_plans WHERE id = ?", [Number(id)]);
    if (!row) notFound();
    plan = planForEditor(row);
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
      <TripPlanner
        id={isNew ? null : Number(id)}
        initial={plan}
        customers={customers}
        catalog={catalog}
        aiEnabled={aiEnabled()}
        suggestAction={suggestTripPlans}
        saveAction={saveTripPlan}
      />
    </div>
  );
}
