"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, destroySession, requireAdmin } from "./auth";
import { query } from "./db";
import { label } from "./format";
import { displayName, getResource, shortLabel } from "./resources";

// Messages travel in the URL and are shown by components/admin/Toast.js
const withError = (path, msg) => `${path}?error=${encodeURIComponent(msg)}`;
const withOk = (path, msg) => `${path}?ok=${encodeURIComponent(msg)}`;

function errorMessage(e) {
  if (e.code === "ER_DUP_ENTRY") return "ข้อมูลซ้ำกับที่มีอยู่แล้ว (เช่น อีเมลซ้ำ)";
  if (e.code === "ER_ROW_IS_REFERENCED_2") return "ลบไม่ได้ เพราะมีข้อมูลอื่นอ้างอิงอยู่ (เช่น ลูกค้ามีการจองแล้ว)";
  return e.message ?? "เกิดข้อผิดพลาด";
}

// ---------- Auth ----------

export async function login(formData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const [user] = await query(
    "SELECT id, password_hash FROM admins WHERE email = ? AND status = 'active'",
    [email],
  );
  if (!user || !(await bcrypt.compare(password, user.password_hash))) redirect("/login?error=1");
  await createSession(user.id);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ---------- Generic CRUD ----------

const NUMERIC = ["number", "money", "ref", "stars"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message for one field, or undefined. Mirrors the browser checks in AdminForm. */
function checkField(f, raw, isNew) {
  const name = shortLabel(f);
  if (f.type === "checkbox") return;
  if (f.type === "password") {
    if (!raw && isNew) return "กรุณาตั้งรหัสผ่าน";
    if (raw && raw.length < (f.minLength ?? 8)) return `รหัสผ่านต้องมีอย่างน้อย ${f.minLength ?? 8} ตัวอักษร`;
    return;
  }
  if (raw === "") {
    if (!f.required) return;
    if (f.type === "date") return `กรุณาเลือกวันที่${name}`;
    if (f.type === "datetime") return `กรุณาเลือกวันและเวลา${name}`;
    return `กรุณา${["select", "ref", "stars"].includes(f.type) ? "เลือก" : "กรอก"}${name}`;
  }
  if (NUMERIC.includes(f.type)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "กรุณากรอกเป็นตัวเลข";
    if (n < (f.min ?? 0)) return `ต้องไม่น้อยกว่า ${f.min ?? 0}`;
    if (f.max !== undefined && n > f.max) return `ต้องไม่เกิน ${f.max}`;
  }
  if (f.type === "select" && !f.options.includes(raw)) return `กรุณาเลือก${name}`;
  if (f.type === "email" && !EMAIL_RE.test(raw)) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (f.type === "image" && !/^https?:\/\//i.test(raw)) return "กรุณาใส่ลิงก์ที่ขึ้นต้นด้วย https://";
  if (f.maxLength && raw.length > f.maxLength) return `ยาวได้ไม่เกิน ${f.maxLength} ตัวอักษร`;
  if (f.minLength && raw.length < f.minLength) return `ต้องมีอย่างน้อย ${f.minLength} ตัวอักษร`;
  if (f.pattern && !new RegExp(`^(?:${f.pattern})$`).test(raw)) return f.title ?? "รูปแบบไม่ถูกต้อง";
}

/**
 * Create (id = null) or update a row. Called from AdminForm.
 * On success redirects back to the list with a toast; on failure returns
 * { error, fieldErrors } so the form keeps what the user typed.
 */
export async function saveResource(key, id, formData) {
  await requireAdmin();
  const res = getResource(key);
  if (!res) throw new Error("Unknown resource");

  const data = {};
  const fieldErrors = {};
  for (const f of res.fields) {
    const raw = String(formData.get(f.name) ?? "").trim();
    const err = checkField(f, raw, !id);
    if (err) { fieldErrors[f.name] = err; continue; }

    if (f.type === "checkbox") data[f.name] = formData.has(f.name) ? 1 : 0;
    else if (f.type === "password") { if (raw) data[f.name] = await bcrypt.hash(raw, 10); }
    else if (raw === "") data[f.name] = null;
    else if (NUMERIC.includes(f.type)) data[f.name] = Number(raw);
    else if (f.type === "datetime") data[f.name] = raw.replace("T", " ");
    else data[f.name] = f.upper ? raw.toUpperCase() : raw;
  }
  if (!Object.keys(fieldErrors).length && res.validate) Object.assign(fieldErrors, res.validate(data));

  const count = Object.keys(fieldErrors).length;
  if (count) return { error: `กรุณาแก้ไขข้อมูลให้ถูกต้อง (${count} ช่อง)`, fieldErrors };

  const cols = Object.keys(data);
  const values = Object.values(data);
  try {
    if (id) {
      await query(`UPDATE \`${res.table}\` SET ${cols.map((c) => `\`${c}\` = ?`).join(", ")} WHERE id = ?`, [...values, id]);
    } else {
      await query(
        `INSERT INTO \`${res.table}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        values,
      );
    }
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY" && "email" in data) {
      return { error: "กรุณาแก้ไขข้อมูลให้ถูกต้อง (1 ช่อง)", fieldErrors: { email: "อีเมลนี้ถูกใช้แล้ว" } };
    }
    return { error: errorMessage(e) };
  }
  revalidatePath(`/admin/${key}`);
  redirect(withOk(`/admin/${key}`, id ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : `เพิ่ม${res.title}เรียบร้อยแล้ว`));
}

export async function deleteResource(key, id) {
  const admin = await requireAdmin();
  const res = getResource(key);
  if (!res) throw new Error("Unknown resource");
  if (key === "admins" && id === admin.id) redirect(withError("/admin/admins", "ลบบัญชีตัวเองไม่ได้"));

  const [row] = await query(`SELECT * FROM \`${res.table}\` WHERE id = ?`, [id]);
  const name = row ? displayName(res, row) : `#${id}`;
  try {
    await query(`DELETE FROM \`${res.table}\` WHERE id = ?`, [id]);
  } catch (e) {
    redirect(withError(`/admin/${key}`, errorMessage(e)));
  }
  revalidatePath(`/admin/${key}`);
  redirect(withOk(`/admin/${key}`, `ลบ${res.title} “${name}” เรียบร้อยแล้ว`));
}

// ---------- Bookings ----------

const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

export async function updateBooking(id, formData) {
  await requireAdmin();
  const status = String(formData.get("status"));
  if (!BOOKING_STATUSES.includes(status)) throw new Error("Invalid status");
  await query("UPDATE bookings SET status = ?, note = ? WHERE id = ?", [status, String(formData.get("note") ?? "") || null, id]);
  revalidatePath(`/admin/bookings/${id}`);
  redirect(withOk(`/admin/bookings/${id}`, "บันทึกการจองเรียบร้อยแล้ว"));
}

export async function updatePayment(paymentId, bookingId, formData) {
  await requireAdmin();
  const status = String(formData.get("status"));
  if (!PAYMENT_STATUSES.includes(status)) throw new Error("Invalid status");
  await query(
    "UPDATE payments SET status = ?, paid_at = IF(? = 'paid' AND paid_at IS NULL, NOW(), paid_at) WHERE id = ? AND booking_id = ?",
    [status, status, paymentId, bookingId],
  );
  revalidatePath(`/admin/bookings/${bookingId}`);
  redirect(withOk(`/admin/bookings/${bookingId}`, `อัปเดตการชำระเงินเป็น “${label(status)}” แล้ว`));
}
