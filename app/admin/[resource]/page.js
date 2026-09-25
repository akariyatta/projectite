import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { Badge, PageHead, Stars, Thumb } from "@/components/admin/ui";
import { deleteResource } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { baht } from "@/lib/format";
import { displayName, getResource } from "@/lib/resources";

const PER_PAGE = 20;

function Cell({ field, row, refs }) {
  const v = row[field.name];
  if (field.type === "image") return <Thumb src={v} name={row.name} />;
  if (v === null || v === undefined || v === "") return <span className="adm-muted">—</span>;
  switch (field.type) {
    case "checkbox": return v ? <span className="adm-yes">● เปิด</span> : <span className="adm-no">○ ปิด</span>;
    case "ref": return refs[field.name]?.[v] ?? `#${v}`;
    case "select": return <Badge value={v} />;
    case "money": return baht(v);
    case "stars": return <Stars n={v} />;
    case "datetime": return String(v).slice(0, 16);
    default: return String(v);
  }
}

export default async function ResourceList({ params, searchParams }) {
  await requireAdmin();
  const { resource } = await params;
  const { q, page } = await searchParams;
  const res = getResource(resource);
  if (!res) notFound();

  const cols = res.fields.filter((f) => f.list);
  const search = typeof q === "string" ? q.trim() : "";
  const where = search ? `WHERE ${res.search.map((c) => `\`${c}\` LIKE ?`).join(" OR ")}` : "";
  const args = search ? res.search.map(() => `%${search}%`) : [];

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM \`${res.table}\` ${where}`, args);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const rows = await query(
    `SELECT * FROM \`${res.table}\` ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...args, PER_PAGE, (current - 1) * PER_PAGE],
  );
  const pageHref = (p) => `/admin/${resource}?${new URLSearchParams({ ...(search && { q: search }), page: p })}`;

  // Look up display names for foreign-key columns
  const refs = {};
  for (const f of cols.filter((f) => f.type === "ref")) {
    const ids = [...new Set(rows.map((r) => r[f.name]).filter(Boolean))];
    refs[f.name] = {};
    if (ids.length) {
      const found = await query(`SELECT id, \`${f.ref.label}\` AS label FROM \`${f.ref.table}\` WHERE id IN (?)`, [ids]);
      for (const r of found) refs[f.name][r.id] = r.label;
    }
  }

  return (
    <div className="adm-stack">
      <PageHead eyebrow="Manage" title={res.title} subtitle={res.subtitle}>
        <Link href={`/admin/${resource}/new`} className="adm-btn adm-btn-gold">+ เพิ่ม{res.title}</Link>
      </PageHead>

      <div className="adm-row" style={{ justifyContent: "space-between" }}>
        <form className="adm-search">
          <input name="q" defaultValue={search} placeholder={`ค้นหา${res.title}…`} className="adm-input" />
          <button className="adm-btn-ghost">ค้นหา</button>
          {search && <Link href={`/admin/${resource}`} className="adm-btn-text">ล้าง</Link>}
        </form>
        <span className="adm-muted">{search ? `พบ ${total} รายการ` : `ทั้งหมด ${total} รายการ`}</span>
      </div>

      <div className="adm-card adm-card-flush">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>#</th>
                {cols.map((f) => <th key={f.name} className={f.type === "money" ? "adm-num" : undefined}>{f.type === "image" ? "" : f.label}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={cols.length + 2} className="adm-empty">{search ? `ไม่พบ “${search}”` : "ยังไม่มีข้อมูล — กด “เพิ่ม” เพื่อเริ่ม"}</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="adm-muted">{row.id}</td>
                  {cols.map((f) => (
                    <td key={f.name} className={f.type === "money" ? "adm-num" : undefined}>
                      <Cell field={f} row={row} refs={refs} />
                    </td>
                  ))}
                  <td className="adm-actions">
                    <Link href={`/admin/${resource}/${row.id}`} className="adm-btn-text">แก้ไข</Link>
                    <form action={deleteResource.bind(null, resource, row.id)} style={{ display: "inline" }}>
                      <ConfirmButton
                        className="adm-btn-text adm-btn-danger"
                        title={`ลบ${res.title} “${displayName(res, row)}”?`}
                        message="ข้อมูลที่ลบแล้วจะกู้คืนไม่ได้"
                      >
                        ลบ
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <nav className="adm-pager">
          {current > 1 ? <Link href={pageHref(current - 1)} className="adm-btn-ghost">← ก่อนหน้า</Link> : <span />}
          <span className="adm-muted">หน้า {current} / {pages}</span>
          {current < pages ? <Link href={pageHref(current + 1)} className="adm-btn-ghost">ถัดไป →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
