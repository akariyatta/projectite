"use client";

import { useActionState, useState } from "react";
import { changeOwnPassword } from "@/lib/actions";

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const LEVELS = ["", "อ่อนมาก", "อ่อน", "พอใช้", "ดี", "แข็งแรงมาก"];

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, null);
  const [pw, setPw] = useState("");
  const err = state?.fieldErrors ?? {};
  const s = strength(pw);

  const field = (name, label, props = {}) => (
    <label className={`adm-field ${err[name] ? "has-error" : ""}`}>
      <span>{label}</span>
      <input name={name} type="password" required className="adm-input" {...props} />
      {err[name] && <small className="adm-field-error">{err[name]}</small>}
    </label>
  );

  return (
    <form action={action} className="adm-form">
      {field("current", "รหัสผ่านปัจจุบัน", { autoComplete: "current-password", autoFocus: true })}
      {field("password", "รหัสผ่านใหม่", { autoComplete: "new-password", minLength: 8, onChange: (e) => setPw(e.target.value) })}
      {pw && (
        <div className="adm-strength" data-level={s}>
          <div><span style={{ width: `${(s / 5) * 100}%` }} /></div>
          <small>ความแข็งแรง: {LEVELS[s] || LEVELS[1]}</small>
        </div>
      )}
      {field("confirm", "ยืนยันรหัสผ่านใหม่", { autoComplete: "new-password" })}
      <button className="adm-btn adm-btn-gold" style={{ width: "100%", padding: 12 }} disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
      </button>
    </form>
  );
}
