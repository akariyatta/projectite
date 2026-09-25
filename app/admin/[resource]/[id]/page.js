import Link from "next/link";
import { notFound } from "next/navigation";
import AdminForm, { Field } from "@/components/admin/AdminForm";
import ImageInput from "@/components/admin/ImageInput";
import { PageHead } from "@/components/admin/ui";
import { saveResource } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { label } from "@/lib/format";
import { displayName, getResource } from "@/lib/resources";

async function Input({ field, value, isNew }) {
  const v = value === null || value === undefined ? "" : String(value);
  const common = {
    name: field.name,
    required: field.required,
    maxLength: field.maxLength,
    minLength: field.minLength,
    pattern: field.pattern,
    title: field.title,
    placeholder: field.placeholder,
    className: "adm-input",
  };

  switch (field.type) {
    case "textarea":
      return <textarea {...common} rows={field.name === "plan" ? 12 : 4} defaultValue={v} />;
    case "number":
      return <input {...common} type="number" min={field.min ?? 0} max={field.max} step="1" defaultValue={v} />;
    case "money":
      return <input {...common} type="number" min={field.min ?? 0} step="0.01" placeholder="0.00" defaultValue={v} />;
    case "email":
      return <input {...common} type="email" autoComplete="off" defaultValue={v} />;
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
      return <input {...common} required={isNew} type="password" autoComplete="new-password" />;
    case "image":
      return <ImageInput name={field.name} defaultValue={v} maxLength={field.maxLength} />;
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
      return <input {...common} type="text" defaultValue={v} style={field.upper ? { textTransform: "uppercase" } : undefined} />;
  }
}

function hintFor(field, isNew) {
  if (field.type === "password") return isNew ? `อย่างน้อย ${field.minLength ?? 8} ตัวอักษร` : "เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยนรหัสผ่าน";
  if (field.type === "image") return "อัปโหลดจากเครื่อง หรือวางลิงก์รูปจากเว็บ";
  return field.hint;
}

const WIDE = ["textarea", "image", "password"];

export default async function ResourceForm({ params }) {
  await requireAdmin();
  const { resource, id } = await params;
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
        title={isNew ? `เพิ่ม${res.title}` : displayName(res, row)}
        subtitle={<>ช่องที่มี <span className="adm-req">*</span> ต้องกรอก</>}
      />

      <AdminForm action={saveResource.bind(null, resource, isNew ? null : Number(id))} cancelHref={`/admin/${resource}`}>
        <div className="adm-form-grid">
          {res.fields.map((f) =>
            f.type === "checkbox" ? (
              <label key={f.name} className="adm-check adm-field-wide">
                <input name={f.name} type="checkbox" defaultChecked={isNew ? true : Boolean(Number(row[f.name]))} />
                {f.label}
              </label>
            ) : (
              <Field
                key={f.name}
                name={f.name}
                label={f.label}
                required={f.required || (f.type === "password" && isNew)}
                hint={hintFor(f, isNew)}
                suffix={f.suffix}
                wide={WIDE.includes(f.type)}
              >
                <Input field={f} value={isNew ? undefined : row[f.name]} isNew={isNew} />
              </Field>
            ),
          )}
        </div>
      </AdminForm>
    </div>
  );
}
