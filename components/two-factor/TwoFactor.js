"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import "./two-factor.css";

// Shared by the customer profile (ui="st") and admin security page (ui="adm") — only the class names differ.
const UI = {
  st: { card: "st-card", btn: "st-btn", ghost: "st-btn-ghost", input: "st-input", field: "st-field", error: "st-alert st-alert-error", info: "st-alert st-alert-info", muted: "st-muted", fieldError: "st-error" },
  adm: { card: "adm-card", btn: "adm-btn adm-btn-gold", ghost: "adm-btn adm-btn-ghost", input: "adm-input", field: "adm-field", error: "adm-alert adm-alert-error", info: "adm-alert adm-alert-ok", muted: "adm-muted", fieldError: "adm-field-error" },
};

/** The 6-digit / backup code box used on sign-in and when turning 2FA off. */
export function CodeInput({ ui = "st", name = "code", autoFocus }) {
  const c = UI[ui];
  const [backup, setBackup] = useState(false);
  return (
    <div className="tf-code-wrap">
      <input
        key={backup ? "b" : "t"}
        name={name}
        className={`${c.input} tf-code ${backup ? "is-backup" : ""}`}
        required
        autoFocus={autoFocus}
        autoComplete="one-time-code"
        inputMode={backup ? "text" : "numeric"}
        maxLength={backup ? 9 : 6}
        placeholder={backup ? "xxxx-xxxx" : "000000"}
        aria-label={backup ? "รหัสสำรอง" : "รหัส 6 หลักจากแอป"}
      />
      <button type="button" className="tf-switch" onClick={() => setBackup((b) => !b)}>
        {backup ? "ใช้รหัส 6 หลักจากแอปแทน" : "มือถือไม่อยู่? ใช้รหัสสำรองแทน"}
      </button>
    </div>
  );
}

/** Second sign-in step (/login/verify, /signin/verify). */
export function VerifyForm({ action, ui = "st", next }) {
  const c = UI[ui];
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="tf-verify">
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <div className={c.error}>{state.error}</div>}
      <CodeInput ui={ui} autoFocus />
      <button className={c.btn} style={{ width: "100%", padding: 13 }} disabled={pending}>{pending ? "กำลังตรวจสอบ…" : "ยืนยัน"}</button>
    </form>
  );
}

function BackupCodes({ codes, c, onDone }) {
  const [copied, setCopied] = useState(false);
  const text = `Hotel Travel — รหัสสำรองสำหรับยืนยันตัวตน 2 ขั้น\nแต่ละรหัสใช้ได้ครั้งเดียว\n\n${codes.join("\n")}\n`;
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "hotel-travel-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="tf-stack">
      <div className={c.info}>✅ เปิดการยืนยันตัวตน 2 ขั้นเรียบร้อย — เครื่องอื่นที่ล็อกอินค้างไว้ถูกออกจากระบบแล้ว</div>
      <div>
        <strong>รหัสสำรอง (แสดงครั้งเดียวเท่านั้น)</strong>
        <p className={c.muted} style={{ fontSize: 13 }}>ใช้แทนรหัสจากแอปได้ถ้ามือถือหาย แต่ละรหัสใช้ได้ครั้งเดียว — เก็บไว้ในที่ปลอดภัย</p>
      </div>
      <ol className="tf-backup">{codes.map((code) => <li key={code}>{code}</li>)}</ol>
      <div className="tf-row">
        <button type="button" className={c.ghost} onClick={download}>⬇️ ดาวน์โหลด .txt</button>
        <button type="button" className={c.ghost} onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}>{copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอก"}</button>
        <button type="button" className={c.btn} onClick={onDone}>บันทึกรหัสไว้แล้ว</button>
      </div>
    </div>
  );
}

/** Status + turn on (scan QR → confirm code → backup codes) + turn off. */
export default function TwoFactorPanel({ enabled, backupLeft, start, confirm, disable, ui = "st" }) {
  const c = UI[ui];
  const router = useRouter();
  const [setup, startAction, starting] = useActionState(start, null);
  const [confirmed, confirmAction, confirming] = useActionState(confirm, null);
  const [off, disableAction, disabling] = useActionState(disable, null);
  const offErr = off?.fieldErrors ?? {};

  return (
    <div className={`${c.card} tf-panel`}>
      <div className="tf-head">
        <div>
          <h2 style={{ margin: 0 }}>ยืนยันตัวตน 2 ขั้น</h2>
          <p className={c.muted} style={{ fontSize: 13.5 }}>เข้าสู่ระบบด้วยรหัสผ่าน + รหัส 6 หลักจากแอป Authenticator ในมือถือ ถึงรหัสผ่านหลุดก็ไม่มีใครเข้าบัญชีได้</p>
        </div>
        <span className={`tf-pill ${enabled ? "is-on" : ""}`}>{enabled ? "🛡️ เปิดอยู่" : "ปิดอยู่"}</span>
      </div>

      {confirmed?.codes ? (
        <BackupCodes codes={confirmed.codes} c={c} onDone={() => router.refresh()} />
      ) : enabled ? (
        <form action={disableAction} className="tf-stack">
          <p className={c.muted} style={{ fontSize: 13.5 }}>
            รหัสสำรองเหลือ <strong>{backupLeft}</strong> รหัส{backupLeft <= 2 && " — ใกล้หมดแล้ว ปิดแล้วเปิดใหม่เพื่อรับรหัสชุดใหม่"}
          </p>
          <details className="tf-details">
            <summary>ปิดการยืนยันตัวตน 2 ขั้น</summary>
            <div className="tf-stack" style={{ marginTop: 12 }}>
              <label className={c.field}>
                <span>รหัสผ่านปัจจุบัน</span>
                <input name="password" type="password" required autoComplete="current-password" className={c.input} />
                {offErr.password && <small className={c.fieldError}>{offErr.password}</small>}
              </label>
              <label className={c.field}>
                <span>รหัสจากแอป หรือรหัสสำรอง</span>
                <CodeInput ui={ui} />
                {offErr.code && <small className={c.fieldError}>{offErr.code}</small>}
              </label>
              <button className={`${c.ghost} tf-danger`} disabled={disabling}>{disabling ? "กำลังปิด…" : "ปิดการยืนยัน 2 ขั้น"}</button>
            </div>
          </details>
        </form>
      ) : setup?.qr ? (
        <div className="tf-setup">
          <ol className="tf-steps">
            <li>ติดตั้งแอป <strong>Google Authenticator</strong> หรือ <strong>Microsoft Authenticator</strong> ในมือถือ</li>
            <li>
              กด “+” ในแอป แล้วสแกน QR code นี้
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="QR code สำหรับแอป Authenticator" className="tf-qr" width={200} height={200} />
              <span className={c.muted} style={{ fontSize: 12.5 }}>สแกนไม่ได้? พิมพ์รหัสนี้ในแอปแทน</span>
              <code className="tf-secret">{setup.secret}</code>
            </li>
            <li>
              ใส่รหัส 6 หลักที่แอปแสดง เพื่อยืนยัน
              <form action={confirmAction} className="tf-confirm">
                {confirmed?.error && <div className={c.error}>{confirmed.error}</div>}
                <input name="code" className={`${c.input} tf-code`} required autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="000000" aria-label="รหัส 6 หลัก" />
                <button className={c.btn} disabled={confirming}>{confirming ? "กำลังตรวจสอบ…" : "ยืนยันและเปิดใช้"}</button>
              </form>
            </li>
          </ol>
        </div>
      ) : (
        <form action={startAction}>
          {setup?.error && <div className={c.error}>{setup.error}</div>}
          <button className={c.btn} disabled={starting}>{starting ? "กำลังเตรียม…" : "🛡️ เปิดการยืนยันตัวตน 2 ขั้น"}</button>
        </form>
      )}
    </div>
  );
}
