import Link from "next/link";
import { notFound } from "next/navigation";
import PlanClient from "@/components/site/PlanClient";
import { getCustomer, requireCustomer } from "@/lib/customer";
import { query } from "@/lib/db";
import { aiEnabled, loadCatalog } from "@/lib/planner";
import { planForEditor } from "@/lib/trips";

export const metadata = { title: "วางแผนเที่ยว · Hotel Travel" };

// /plans/new is open to everyone (sign-in is only needed to save); /plans/<id> is the owner's saved plan.
export default async function PlanPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";

  let initial = null;
  if (isNew) {
    // Allow deep links such as /plans/new?destination=Tokyo from other pages
    if (sp.destination) initial = { destination: String(sp.destination), start_date: sp.start_date ?? "", end_date: sp.end_date ?? "" };
  } else {
    const user = await requireCustomer(`/plans/${id}`);
    const [row] = await query("SELECT * FROM trip_plans WHERE id = ? AND user_id = ?", [Number(id), user.id]);
    if (!row) notFound();
    initial = planForEditor(row);
  }
  const [catalog, user] = await Promise.all([loadCatalog(), getCustomer()]);

  return (
    <>
      <div className="st-pagehead">
        <div className="st-wrap">
          <div className="st-eyebrow">Trip planner</div>
          <h1>{isNew ? "วางแผนเที่ยว" : initial.title}</h1>
          <div>
            {isNew ? "บอกเราว่าอยากไปไหน แล้วเลือกว่าจะวางเองหรือให้ " + (aiEnabled() ? "AI" : "ระบบ") + " เสนอ 3 แผน" : "แก้แผนต่อ หรือเพิ่มทั้งแผนลงตะกร้าเพื่อจอง"}
            {user && <> · <Link href="/plans" className="st-link">แผนเที่ยวของฉัน</Link></>}
          </div>
        </div>
      </div>
      <div className="st-wrap st-pull">
        {!user && (
          <div className="st-alert st-alert-info" style={{ marginBottom: 16 }}>
            ลองวางแผนได้เลยโดยไม่ต้องเข้าสู่ระบบ — <Link href="/signin?next=/plans/new" className="st-link">เข้าสู่ระบบ</Link> เพื่อบันทึกแผนไว้ดูภายหลัง
          </div>
        )}
        <PlanClient id={isNew ? null : Number(id)} initial={initial} catalog={catalog} aiEnabled={aiEnabled()} />
      </div>
    </>
  );
}
