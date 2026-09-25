import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { Alert, Badge, PageHead, Stars, Thumb } from "@/components/admin/ui";
import { deleteResource } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { baht } from "@/lib/format";
import { getResource } from "@/lib/resources";

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
  const { q, error } = await searchParams;
  const res = getResource(resource);
  if (!res) notFound();

  const cols = res.fields.filter((f) => f.list);
  const search = typeof q === "string" ? q.trim() : "";
  const where = search ? `WHERE ${res.search.map((c) => `\`${c}\` LIKE ?`).join(" OR ")}` : "";
  const rows = await query(
    `SELECT * FROM \`${res.table}\` ${where} ORDER BY id DESC LIMIT 200`,
    search ? res.search.map(() => `%${search}%`) : [],
  );

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

      <Alert error={error} />

      <form className="adm-search">
        <input name="q" defaultValue={search} placeholder={`ค้นหา${res.title}…`} className="adm-input" />
        <button className="adm-btn-ghost">ค้นหา</button>
      </form>

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
              {rows.length === 0 && <tr><td colSpan={cols.length + 2} className="adm-empty">ไม่มีข้อมูล</td></tr>}
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
                      <ConfirmButton className="adm-btn-text adm-btn-danger" message={`ลบ${res.title} #${row.id}?`}>ลบ</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
