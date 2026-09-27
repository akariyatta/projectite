"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerCustomer, signinCustomer } from "@/lib/site-actions";

/** Sign-in and register share one form component; `mode` picks the action and fields. */
export default function AuthForm({ mode, next }) {
  const register = mode === "register";
  const [state, action, pending] = useActionState(register ? registerCustomer : signinCustomer, null);
  const err = state?.fieldErrors ?? {};
  const v = state?.values ?? {};

  const field = (name, label, props) => (
    <label className={`st-field ${err[name] ? "has-error" : ""}`}>
      <span>{label}</span>
      <input name={name} className="st-input" defaultValue={v[name] ?? ""} {...props} />
      {err[name] && <small className="st-error">{err[name]}</small>}
    </label>
  );

  return (
    <form action={action} className="st-card">
      <div style={{ textAlign: "center" }}>
        <div className="st-eyebrow">✦ Hotel Travel ✦</div>
        <h1>{register ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}</h1>
        <p className="st-muted" style={{ fontSize: 14 }}>{register ? "จองง่าย ดูการจองได้ทุกที่" : "เข้าสู่ระบบเพื่อจองและดูการจองของคุณ"}</p>
      </div>
      <input type="hidden" name="next" value={next} />
      {state?.error && <div className="st-alert st-alert-error">{state.error}</div>}
      {register && field("name", "ชื่อ-นามสกุล", { required: true, autoComplete: "name", maxLength: 100 })}
      {field("email", "อีเมล", { type: "email", required: true, autoComplete: "email", maxLength: 150 })}
      {register && field("phone", "เบอร์โทร (ไม่บังคับ)", { type: "tel", autoComplete: "tel", placeholder: "0812345678" })}
      {field("password", "รหัสผ่าน", { type: "password", required: true, autoComplete: register ? "new-password" : "current-password", defaultValue: undefined })}
      {register && field("confirm", "ยืนยันรหัสผ่าน", { type: "password", required: true, autoComplete: "new-password", defaultValue: undefined })}
      {register && <small className="st-muted">รหัสผ่านอย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข</small>}
      <button className="st-btn" style={{ padding: 13 }} disabled={pending}>
        {pending ? "กำลังดำเนินการ…" : register ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
      </button>
      <p style={{ textAlign: "center", fontSize: 14 }}>
        {register ? "มีบัญชีแล้ว? " : "ยังไม่มีบัญชี? "}
        <Link href={`/${register ? "signin" : "register"}?next=${encodeURIComponent(next)}`} className="st-link">
          {register ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </Link>
      </p>
    </form>
  );
}
