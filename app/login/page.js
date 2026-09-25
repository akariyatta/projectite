import { redirect } from "next/navigation";
import "@/components/admin/admin.css";
import { adminFonts } from "@/components/admin/fonts";
import { Alert } from "@/components/admin/ui";
import { login } from "@/lib/actions";
import { getAdmin } from "@/lib/auth";

export const metadata = { title: "เข้าสู่ระบบ · Hotel Travel Admin" };

export default async function LoginPage({ searchParams }) {
  if (await getAdmin()) redirect("/admin");
  const { error, locked } = await searchParams;
  const message = locked
    ? `ใส่รหัสผิดหลายครั้งเกินไป — ลองใหม่ได้ในอีก ${Number(locked) || 15} นาที`
    : error && "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

  return (
    <div className={`adm-root adm-login ${adminFonts}`}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <form action={login} className="adm-login-card adm-form">
          <div className="adm-brand" style={{ marginBottom: 0 }}>
            <div className="adm-brand-mark" style={{ color: "var(--gold)" }}>✦ ✦ ✦</div>
            <div className="adm-brand-name">Hotel Travel</div>
            <div className="adm-brand-sub">Admin Console</div>
          </div>
          <div>
            <h1>ยินดีต้อนรับกลับ</h1>
            <p>เข้าสู่ระบบเพื่อจัดการโรงแรม เที่ยวบิน และการจอง</p>
            <Alert error={message} />
          </div>
          <label className="adm-field">
            <span>อีเมล</span>
            <input name="email" type="email" required autoFocus className="adm-input" placeholder="name@hoteltravel.local" />
          </label>
          <label className="adm-field">
            <span>รหัสผ่าน</span>
            <input name="password" type="password" required className="adm-input" />
          </label>
          <button className="adm-btn adm-btn-gold" style={{ width: "100%", padding: "12px" }}>เข้าสู่ระบบ</button>
        </form>
        <div className="adm-login-foot">HOTEL TRAVEL · STAFF ONLY</div>
      </div>
    </div>
  );
}
