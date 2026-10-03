import Link from "next/link";
import ActionForm from "@/components/site/ActionForm";
import { requestPasswordReset } from "@/lib/site-actions";

export const metadata = { title: "ลืมรหัสผ่าน · Hotel Travel" };

export default function Forgot() {
  return (
    <div className="st-wrap st-auth">
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div className="st-eyebrow">✦ Hotel Travel ✦</div>
        <h1>ลืมรหัสผ่าน</h1>
        <p className="st-muted" style={{ fontSize: 14 }}>กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ (ใช้ได้ 30 นาที)</p>
      </div>
      <ActionForm
        action={requestPasswordReset}
        fields={[{ name: "email", label: "อีเมล", type: "email", required: true, autoComplete: "email", maxLength: 150 }]}
        submit="ส่งลิงก์ตั้งรหัสผ่านใหม่"
        sentMessage="ถ้ามีบัญชีที่ใช้อีเมลนี้ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว — กรุณาเช็กกล่องจดหมาย (รวมถึงจดหมายขยะ)"
      />
      <p style={{ textAlign: "center", fontSize: 14, marginTop: 16 }}>
        นึกออกแล้ว? <Link href="/signin" className="st-link">กลับไปเข้าสู่ระบบ</Link>
      </p>
    </div>
  );
}
