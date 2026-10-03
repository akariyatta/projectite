import Link from "next/link";
import ActionForm from "@/components/site/ActionForm";
import { requireCustomer } from "@/lib/customer";
import { query } from "@/lib/db";
import { changeMyPassword, updateProfile } from "@/lib/site-actions";

export const metadata = { title: "บัญชีของฉัน · Hotel Travel" };

export default async function Profile() {
  const user = await requireCustomer("/profile");
  const [[stats]] = await Promise.all([
    query(
      `SELECT (SELECT COUNT(*) FROM bookings WHERE user_id = ?) AS bookings,
              (SELECT COUNT(*) FROM trip_plans WHERE user_id = ?) AS plans,
              (SELECT created_at FROM users WHERE id = ?) AS since`,
      [user.id, user.id, user.id],
    ),
  ]);

  return (
    <>
      <div className="st-pagehead">
        <div className="st-wrap">
          <div className="st-eyebrow">My account</div>
          <h1>บัญชีของฉัน</h1>
          <div>{user.email} · สมาชิกตั้งแต่ {stats.since?.slice(0, 10)}</div>
        </div>
      </div>
      <div className="st-wrap st-pull st-two">
        <div className="st-stack">
          <section>
            <ActionForm
              title="ข้อมูลส่วนตัว"
              action={updateProfile}
              fields={[
                { name: "name", label: "ชื่อ-นามสกุล", required: true, autoComplete: "name", maxLength: 100, defaultValue: user.name },
                { name: "phone", label: "เบอร์โทร", type: "tel", autoComplete: "tel", defaultValue: user.phone ?? "", placeholder: "0812345678" },
              ]}
              submit="บันทึกข้อมูล"
            />
          </section>
          <section>
            <ActionForm
              title="เปลี่ยนรหัสผ่าน"
              action={changeMyPassword}
              fields={[
                { name: "current", label: "รหัสผ่านปัจจุบัน", type: "password", required: true, autoComplete: "current-password" },
                { name: "password", label: "รหัสผ่านใหม่", type: "password", required: true, autoComplete: "new-password", hint: "อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข" },
                { name: "confirm", label: "ยืนยันรหัสผ่านใหม่", type: "password", required: true, autoComplete: "new-password" },
              ]}
              submit="เปลี่ยนรหัสผ่าน"
            />
          </section>
        </div>
        <aside className="st-card st-sticky" style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0 }}>ทางลัด</h2>
          <Link href="/bookings" className="st-btn-ghost">🧾 การจองของฉัน ({stats.bookings})</Link>
          <Link href="/plans" className="st-btn-ghost">✨ แผนเที่ยวของฉัน ({stats.plans})</Link>
          <p className="st-muted" style={{ fontSize: 12.5 }}>อีเมลใช้สำหรับเข้าสู่ระบบและรับการยืนยันการจอง หากต้องการเปลี่ยนอีเมล กรุณาติดต่อเจ้าหน้าที่</p>
        </aside>
      </div>
    </>
  );
}
