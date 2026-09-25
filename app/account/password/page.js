import Link from "next/link";
import "@/components/admin/admin.css";
import { adminFonts } from "@/components/admin/fonts";
import PasswordForm from "@/components/admin/PasswordForm";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "ตั้งรหัสผ่านใหม่ · Hotel Travel Admin" };

// Outside /admin on purpose: the admin layout sends temp-password admins here.
export default async function ChangePasswordPage() {
  const admin = await requireAdmin({ allowTempPassword: true });
  const forced = Boolean(admin.must_change_password);

  return (
    <div className={`adm-root adm-login ${adminFonts}`}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div className="adm-login-card adm-form">
          <div className="adm-brand" style={{ marginBottom: 0 }}>
            <div className="adm-brand-mark" style={{ color: "var(--gold)" }}>✦ ✦ ✦</div>
            <div className="adm-brand-name">Hotel Travel</div>
            <div className="adm-brand-sub">Admin Console</div>
          </div>
          <div>
            <h1>{forced ? "ตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน" : "เปลี่ยนรหัสผ่าน"}</h1>
            <p>
              {forced
                ? `สวัสดี ${admin.name} — บัญชีนี้ยังใช้รหัสชั่วคราวอยู่ กรุณาตั้งรหัสของคุณเอง`
                : "หลังเปลี่ยน เครื่องอื่นที่ล็อกอินค้างไว้จะถูกออกจากระบบ"}
            </p>
          </div>
          <PasswordForm />
          {!forced && <Link href="/admin" className="adm-back" style={{ textAlign: "center" }}>← กลับหลังบ้าน</Link>}
        </div>
        <div className="adm-login-foot">อย่างน้อย 8 ตัว · มีตัวอักษรและตัวเลข · ห้ามมีชื่อผู้ใช้</div>
      </div>
    </div>
  );
}
