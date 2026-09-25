import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

const PER_PAGE = 30;
const ACTIONS = {
  create: { label: "เพิ่ม", style: "completed" },
  update: { label: "แก้ไข", style: "confirmed" },
  delete: { label: "ลบ", style: "failed" },
  status: { label: "เปลี่ยนสถานะ", style: "pending" },
  login: { label: "เข้าสู่ระบบ", style: "cancelled" },
  password: { label: "รหัสผ่าน", style: "refunded" },
};
const ENTITY_TH = {
  hotels: "โรงแรม", rooms: "ห้องพัก", flights: "เที่ยวบิน", events: "งาน", event_tickets: "ตั๋ว",
  bookings: "การจอง", payments: "การชำระเงิน", trip_plans: "แผนเที่ยว", users: "ลูกค้า", admins: "ผู้ดูแลระบบ",
};

const show = (v) => (v === null || v === undefined || v === "" ? "—" : String(v).length > 80 ? `${String(v).slice(0, 80)}…` : String(v));

export default async function AuditLog({ searchParams }) {
  await requireAdmin();
  const { entity, admin: adminId, action, page } = await searchParams;

  const where = [];
  const args = [];
  if (ENTITY_TH[entity]) { where.push("entity = ?"); args.push(entity); }
  if (ACTIONS[action]) { where.push("action = ?"); args.push(action); }
  if (Number(adminId)) { where.push("admin_id = ?"); args.push(Number(adminId)); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }], admins] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM audit_logs ${w}`, args),
    query("SELECT id, name FROM admins ORDER BY name"),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const rows = await query(`SELECT * FROM audit_logs ${w} ORDER BY id DESC LIMIT ? OFFSET ?`, [...args, PER_PAGE, (current - 1) * PER_PAGE]);

  const filters = { ...(entity && { entity }), ...(action && { action }), ...(adminId && { admin: adminId }) };
  const pageHref = (p) => `/admin/audit?${new URLSearchParams({ ...filters, page: p })}`;

  return (
    <div className="adm-stack">
      <PageHead eyebrow="Audit log" title="บันทึกการแก้ไข" subtitle="ใคร ทำอะไร กับข้อมูลไหน เมื่อไร — บันทึกอัตโนมัติ แก้ไขหรือลบไม่ได้" />

      <form className="adm-row">
        <select name="admin" defaultValue={adminId ?? ""} className="adm-input" style={{ width: "auto" }}>
          <option value="">ทุกคน</option>
          {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select name="entity" defaultValue={entity ?? ""} className="adm-input" style={{ width: "auto" }}>
          <option value="">ทุกข้อมูล</option>
          {Object.entries(ENTITY_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="action" defaultValue={action ?? ""} className="adm-input" style={{ width: "auto" }}>
          <option value="">ทุกการกระทำ</option>
          {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="adm-btn-ghost">กรอง</button>
        {Object.keys(filters).length > 0 && <Link href="/admin/audit" className="adm-btn-text">ล้าง</Link>}
        <span className="adm-muted" style={{ marginLeft: "auto" }}>ทั้งหมด {total} รายการ</span>
      </form>

      <div className="adm-card adm-card-flush">
        {rows.length === 0 && <div className="adm-empty">ยังไม่มีบันทึก</div>}
        <ul className="adm-audit">
          {rows.map((r) => {
            let changes = null;
            try { changes = r.changes ? JSON.parse(r.changes) : null; } catch {}
            const a = ACTIONS[r.action] ?? { label: r.action, style: "cancelled" };
            return (
              <li key={r.id}>
                <div className="adm-audit-when">
                  <strong>{r.created_at.slice(11, 16)}</strong>
                  <span>{r.created_at.slice(0, 10)}</span>
                </div>
                <div className="adm-audit-body">
                  <div className="adm-row" style={{ gap: 8 }}>
                    <span className={`adm-badge adm-badge--${a.style}`}>{a.label}</span>
                    <span className="adm-muted" style={{ fontSize: 12 }}>{ENTITY_TH[r.entity] ?? r.entity}{r.entity_id ? ` #${r.entity_id}` : ""}</span>
                  </div>
                  <div className="adm-audit-summary"><strong>{r.admin_name}</strong> · {r.summary}</div>
                  {changes && (
                    <details>
                      <summary>ดูรายละเอียด ({Object.keys(changes).length} ช่อง)</summary>
                      <table className="adm-table adm-audit-diff">
                        <thead><tr><th>ช่อง</th><th>ค่าเดิม</th><th>ค่าใหม่</th></tr></thead>
                        <tbody>
                          {Object.entries(changes).map(([k, [before, after]]) => (
                            <tr key={k}><td>{k}</td><td className="adm-diff-old">{show(before)}</td><td className="adm-diff-new">{show(after)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
                <div className="adm-muted adm-audit-ip">{r.ip}</div>
              </li>
            );
          })}
        </ul>
      </div>

      {pages > 1 && (
        <nav className="adm-pager">
          {current > 1 ? <Link href={pageHref(current - 1)} className="adm-btn-ghost">← ใหม่กว่า</Link> : <span />}
          <span className="adm-muted">หน้า {current} / {pages}</span>
          {current < pages ? <Link href={pageHref(current + 1)} className="adm-btn-ghost">เก่ากว่า →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
