import Link from "next/link";
import { redirect } from "next/navigation";
import "@/components/admin/admin.css";
import { adminFonts } from "@/components/admin/fonts";
import { VerifyForm } from "@/components/two-factor/TwoFactor";
import { verifyAdminLogin } from "@/lib/actions";
import { getAdmin } from "@/lib/auth";
import { readPending } from "@/lib/two-factor";

export const metadata = { title: "ยืนยันตัวตน · Hotel Travel Admin" };

// Second sign-in step for admins with 2FA on (the password was already checked on /login).
export default async function VerifyLoginPage() {
  if (await getAdmin()) redirect("/admin");
  if (!(await readPending("admin"))) redirect("/login?expired=1");

  return (
    <div className={`adm-root adm-login ${adminFonts}`}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div className="adm-login-card adm-form">
          <div className="adm-brand" style={{ marginBottom: 0 }}>
            <div className="adm-brand-mark" style={{ color: "var(--gold)" }}>✦ ✦ ✦</div>
            <div className="adm-brand-name">Hotel Travel</div>
            <div className="adm-brand-sub">Admin Console</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>🛡️</div>
            <h1>ยืนยันตัวตน 2 ขั้น</h1>
            <p>เปิดแอป Authenticator ในมือถือ แล้วใส่รหัส 6 หลักของ Hotel Travel</p>
          </div>
          <VerifyForm action={verifyAdminLogin} ui="adm" />
          <Link href="/login" className="adm-back" style={{ textAlign: "center" }}>← ใช้บัญชีอื่น</Link>
        </div>
        <div className="adm-login-foot">รหัสเปลี่ยนทุก 30 วินาที · ต้องยืนยันภายใน 5 นาที</div>
      </div>
    </div>
  );
}
