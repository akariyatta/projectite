import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, PageHead } from "@/components/admin/ui";
import { saveResource } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { label } from "@/lib/format";
import { getResource } from "@/lib/resources";

async function Input({ field, value }) {
  const v = value === null || value === undefined ? "" : String(value);
  const common = { name: field.name, required: field.required, className: "adm-input" };

  switch (field.type) {
    case "textarea":
      return <textarea {...common} rows={field.name === "plan" ? 12 : 4} defaultValue={v} />;
    case "number":
      return <input {...common} type="number" min="0" defaultValue={v} />;
    case "money":
      return <input {...common} type="number" min="0" step="0.01" defaultValue={v} />;
    case "stars":
      return (
        <select {...common} defaultValue={v || "3"}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n} ดาว)</option>)}
        </select>
      );
    case "date":
      return <input {...common} type="date" defaultValue={v.slice(0, 10)} />;
    case "datetime":
      return <input {...common} type="datetime-local" defaultValue={v.slice(0, 16).replace(" ", "T")} />;
    case "password":
      return <input name={field.name} type="password" className="adm-input" autoComplete="new-password" />;
    case "image":
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {v && <img src={v} alt="" className="adm-preview" />}
          <input {...common} type="url" placeholder="https://…" defaultValue={v} />
        </>
      );
    case "select":
      return (
        <select {...common} defaultValue={v}>
          {field.options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
        </select>
      );
    case "ref": {
      const opts = await query(`SELECT id, \`${field.ref.label}\` AS label FROM \`${field.ref.table}\` ORDER BY label`);
      return (
        <select {...common} defaultValue={v}>
          <option value="">— เลือก —</option>
          {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      );
    }
    default:
      return <input {...common} type="text" defaultValue={v} />;
  }
}

const WIDE = ["textarea", "image", "password"];

export default async function ResourceForm({ params, searchParams }) {
  await requireAdmin();
  const { resource, id } = await params;
  const { error } = await searchParams;
  const res = getResource(resource);
  if (!res) notFound();

  const isNew = id === "new";
  let row = {};
  if (!isNew) {
    [row] = await query(`SELECT * FROM \`${res.table}\` WHERE id = ?`, [Number(id)]);
    if (!row) notFound();
  }

  return (
    <div className="adm-stack" style={{ maxWidth: 820 }}>
      <Link href={`/admin/${resource}`} className="adm-back">← กลับไปหน้า{res.title}</Link>
      <PageHead
        eyebrow={isNew ? "Create" : `Edit · #${id}`}
        title={isNew ? `เพิ่ม${res.title}` : row.name ?? row.title ?? `แก้ไข${res.title}`}
      />

      <Alert error={error} />

      <form action={saveResource.bind(null, resource, isNew ? null : Number(id))} className="adm-card adm-form">
        <div className="adm-form-grid">
          {res.fields.map((f) =>
            f.type === "checkbox" ? (
              <label key={f.name} className="adm-check adm-field-wide">
                <input name={f.name} type="checkbox" defaultChecked={isNew ? true : Boolean(Number(row[f.name]))} />
                {f.label}
              </label>
            ) : (
              <label key={f.name} className={`adm-field ${WIDE.includes(f.type) ? "adm-field-wide" : ""}`}>
                <span>{f.label} {f.required && <span className="adm-req">*</span>}</span>
                <Input field={f} value={isNew ? undefined : row[f.name]} />
              </label>
            ),
          )}
        </div>
        <div className="adm-row">
          <button className="adm-btn">บันทึก</button>
          <Link href={`/admin/${resource}`} className="adm-btn-ghost">ยกเลิก</Link>
        </div>
      </form>
    </div>
  );
}
