import Link from "next/link";
import ActionForm from "@/components/site/ActionForm";
import { checkResetToken, resetPassword } from "@/lib/site-actions";

export const metadata = { title: "ตั้งรหัสผ่านใหม่ · Hotel Travel" };

export default async function Reset({ searchParams }) {
  const token = String((await searchParams).token ?? "");
  const valid = await checkResetToken(token);

  return (
    <div className="st-wrap st-auth">
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div className="st-eyebrow">✦ Hotel Travel ✦</div>
        <h1>ตั้งรหัสผ่านใหม่</h1>
      </div>
      {valid ? (
        <ActionForm
          action={resetPassword}
          hidden={{ token }}
          fields={[
            { name: "password", label: "รหัสผ่านใหม่", type: "password", required: true, autoComplete: "new-password", hint: "อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข" },
            { name: "confirm", label: "ยืนยันรหัสผ่านใหม่", type: "password", required: true, autoComplete: "new-password" },
          ]}
          submit="บันทึกรหัสผ่านใหม่"
        />
      ) : (
        <div className="st-card" style={{ textAlign: "center" }}>
          <div className="st-alert st-alert-error">ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว</div>
          <p style={{ marginTop: 16 }}><Link href="/forgot" className="st-btn">ขอลิงก์ใหม่</Link></p>
        </div>
      )}
    </div>
  );
}
