import Link from "next/link";
import { Badge, PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { smtpEnabled } from "@/lib/mail";

const STATUS = { sent: "ส่งแล้ว", logged: "บันทึกไว้ (ยังไม่ตั้ง SMTP)", failed: "ส่งไม่สำเร็จ" };
const STYLE = { sent: "completed", logged: "pending", failed: "failed" };

export default async function Emails({ searchParams }) {
  await requireAdmin();
  const { id, q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const rows = await query(
    `SELECT id, to_email, subject, status, error, created_at FROM email_outbox
     ${search ? "WHERE to_email LIKE ? OR subject LIKE ?" : ""} ORDER BY id DESC LIMIT 100`,
    search ? [`%${search}%`, `%${search}%`] : [],
  );
  const [open] = id ? await query("SELECT * FROM email_outbox WHERE id = ?", [Number(id)]) : [];

  return (
    <div className="adm-stack">
      <PageHead
        eyebrow="Email"
        title="อีเมลที่ระบบส่ง"
        subtitle={smtpEnabled() ? "ส่งจริงผ่าน SMTP · ทุกฉบับเก็บสำเนาไว้ที่นี่" : "ยังไม่ได้ตั้ง SMTP — อีเมลถูกบันทึกไว้ที่นี่แทนการส่งจริง (ดูวิธีตั้งที่ การตั้งค่าระบบ)"}
      />
      <form className="adm-search">
        <input name="q" defaultValue={search} placeholder="ค้นหาผู้รับ / หัวข้อ" className="adm-input" />
        <button className="adm-btn-ghost">ค้นหา</button>
      </form>

      <div className={`adm-grid ${open ? "adm-grid-2" : ""}`}>
        <div className="adm-card adm-card-flush">
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>เวลา</th><th>ผู้รับ</th><th>หัวข้อ</th><th>สถานะ</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={4} className="adm-empty">ยังไม่มีอีเมล</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} style={open?.id === r.id ? { background: "var(--gold-soft)" } : undefined}>
                    <td className="adm-muted" style={{ whiteSpace: "nowrap" }}>{r.created_at.slice(5, 16)}</td>
                    <td>{r.to_email}</td>
                    <td><Link href={`/admin/emails?${new URLSearchParams({ id: r.id, ...(search && { q: search }) })}`} className="adm-link">{r.subject}</Link></td>
                    <td><span className={`adm-badge adm-badge--${STYLE[r.status]}`} title={r.error ?? ""}>{STATUS[r.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {open && (
          <div className="adm-card adm-stack" style={{ display: "grid", gap: 10 }}>
            <div className="adm-row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>{open.subject}</h2>
              <Link href="/admin/emails" className="adm-btn-text">ปิด ×</Link>
            </div>
            <div className="adm-muted" style={{ fontSize: 13 }}>ถึง {open.to_email} · {open.created_at} · <Badge value={open.status === "sent" ? "paid" : open.status === "failed" ? "failed" : "pending"} /></div>
            {open.error && <div className="adm-alert adm-alert-error">{open.error}</div>}
            {/* Rendered in a sandboxed frame: the HTML is ours, but it's still kept away from the admin page */}
            <iframe title="ตัวอย่างอีเมล" srcDoc={open.body_html} sandbox="allow-popups" style={{ width: "100%", height: 560, border: "1px solid var(--line)", borderRadius: 10, background: "#fff" }} />
          </div>
        )}
      </div>
    </div>
  );
}
