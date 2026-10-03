import { PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { HOLD_MINUTES } from "@/lib/booking-flow";
import { query } from "@/lib/db";
import { appUrl, smtpEnabled } from "@/lib/mail";
import { stripeEnabled } from "@/lib/payments";
import { aiEnabled } from "@/lib/planner";

// Read-only status page: which outside services are connected, and exactly what to set to turn each on.
// All settings live in .env.local (never in the database or the repo).

function Item({ ok, title, status, children }) {
  return (
    <div className="adm-card" style={{ display: "grid", gap: 10, borderLeft: `4px solid ${ok ? "#2f7d57" : "var(--gold)"}` }}>
      <div className="adm-row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className={`adm-badge adm-badge--${ok ? "completed" : "pending"}`}>{ok ? "✓ เชื่อมต่อแล้ว" : "ยังไม่ได้ตั้งค่า"}</span>
      </div>
      <div style={{ fontSize: 14 }}>{status}</div>
      {!ok && <div className="adm-muted" style={{ fontSize: 13.5 }}>{children}</div>}
    </div>
  );
}

const code = (s) => <code style={{ background: "#f4efe4", padding: "1px 6px", borderRadius: 4, fontSize: 12.5 }}>{s}</code>;

export default async function Settings() {
  await requireAdmin();
  const [[counts]] = await Promise.all([
    query(`SELECT (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pending,
                  (SELECT COUNT(*) FROM email_outbox WHERE status = 'failed') AS mail_failed`),
  ]);

  return (
    <div className="adm-stack">
      <PageHead eyebrow="Settings" title="การตั้งค่าระบบ" subtitle="สถานะการเชื่อมต่อบริการภายนอก — ตั้งค่าในไฟล์ .env.local แล้วรัน npm run dev ใหม่" />

      <Item ok={stripeEnabled()} title="💳 ชำระเงินออนไลน์ (Stripe)"
        status={stripeEnabled()
          ? <>ลูกค้าจ่ายผ่านบัตรเครดิต/เดบิต หรือ PromptPay ได้จริง · คืนเงินอัตโนมัติเมื่อยกเลิก{process.env.STRIPE_WEBHOOK_SECRET ? " · webhook พร้อม" : " · ⚠ ยังไม่ได้ตั้ง STRIPE_WEBHOOK_SECRET (ควรตั้งก่อนเปิดใช้จริง)"}</>
          : "ตอนนี้ใช้ “โหมดทดสอบ” — กดชำระแล้วถือว่าจ่ายสำเร็จ ไม่มีเงินเข้าจริง"}>
        สมัครที่ dashboard.stripe.com → Developers → API keys → ใส่ {code("STRIPE_SECRET_KEY=sk_test_...")} (ทดสอบ) หรือ {code("sk_live_...")} (ใช้จริง)
        · PromptPay ต้องเปิดใน Settings → Payment methods (บัญชีประเทศไทย) · Webhook: {code(`${appUrl()}/api/payments/stripe/webhook`)} event {code("checkout.session.completed")} แล้วใส่ {code("STRIPE_WEBHOOK_SECRET=whsec_...")}
      </Item>

      <Item ok={smtpEnabled()} title="✉️ ส่งอีเมล (SMTP)"
        status={smtpEnabled()
          ? <>ส่งจริงจาก {code(process.env.MAIL_FROM || process.env.SMTP_USER)} ผ่าน {code(process.env.SMTP_HOST)}{counts.mail_failed ? ` · ⚠ มี ${counts.mail_failed} ฉบับส่งไม่สำเร็จ (ดูที่หน้า อีเมล)` : ""}</>
          : "อีเมลทั้งหมด (ยืนยันการจอง, รีเซ็ตรหัสผ่าน ฯลฯ) ถูกบันทึกไว้ที่หน้า “อีเมล” แต่ยังไม่ถูกส่งออกไปจริง"}>
        ตัวอย่าง Gmail: เปิด 2-Step Verification → สร้าง App password แล้วใส่
        {" "}{code("SMTP_HOST=smtp.gmail.com")} {code("SMTP_PORT=587")} {code("SMTP_USER=you@gmail.com")} {code("SMTP_PASS=<app password>")} {code("MAIL_FROM=Hotel Travel <you@gmail.com>")}
      </Item>

      <Item ok={aiEnabled()} title="🤖 AI วางแผนเที่ยว (Claude)"
        status={aiEnabled() ? "ปุ่ม “ให้ AI เสนอ 3 แผน” ใช้ Claude จริง · ลูกค้าต้องเข้าสู่ระบบก่อนใช้ (มีค่าใช้จ่ายต่อครั้ง)" : "ตอนนี้ระบบจัดแผนอัตโนมัติจากเที่ยวบิน/ที่พัก/ตั๋วที่มีขาย (ใช้งานได้ ไม่มีค่าใช้จ่าย)"}>
        สร้าง API key ที่ console.anthropic.com → ใส่ {code("ANTHROPIC_API_KEY=sk-ant-...")}
      </Item>

      <Item ok title="⏳ หมดเวลาชำระเงิน" status={<>การจองที่ไม่จ่ายเงินภายใน <strong>{HOLD_MINUTES()} นาที</strong> จะถูกยกเลิกและคืนห้อง/ที่นั่ง/ตั๋วอัตโนมัติ · ตอนนี้มีการจองรอชำระ {counts.pending} รายการ</>}>
        {null}
      </Item>
      <p className="adm-muted" style={{ fontSize: 13 }}>
        ปรับเวลาได้ด้วย {code("BOOKING_HOLD_MINUTES=30")} · บนเซิร์ฟเวอร์จริงให้ตั้ง {code("CRON_SECRET=...")} แล้วเรียก {code("GET /api/cron/expire-bookings")} (header {code("Authorization: Bearer <CRON_SECRET>")}) ทุก 5 นาที
        · ลิงก์ในอีเมลใช้ {code(`APP_URL=${appUrl()}`)}
      </p>
    </div>
  );
}
