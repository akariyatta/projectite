"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, destroySession, requireAdmin } from "./auth";
import { query } from "./db";
import { getResource } from "./resources";

const withError = (path, msg) => `${path}?error=${encodeURIComponent(msg)}`;

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

export async function saveResource(key, id, formData) {
  await requireAdmin();
  const res = getResource(key);
  if (!res) throw new Error("Unknown resource");
  const formPath = `/admin/${key}/${id ?? "new"}`;

  const data = {};
  for (const f of res.fields) {
    const raw = String(formData.get(f.name) ?? "").trim();
    if (f.type === "checkbox") data[f.name] = formData.has(f.name) ? 1 : 0;
    else if (f.type === "password") {
      if (raw) data[f.name] = await bcrypt.hash(raw, 10);
      else if (!id) redirect(withError(formPath, "กรุณาตั้งรหัสผ่าน"));
    } else if (raw === "") data[f.name] = null;
    else if (["number", "money", "ref", "stars"].includes(f.type)) data[f.name] = Number(raw);
    else if (f.type === "datetime") data[f.name] = raw.replace("T", " ");
    else data[f.name] = raw;
  }

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
    redirect(withError(formPath, errorMessage(e)));
  }
  revalidatePath(`/admin/${key}`);
  redirect(`/admin/${key}`);
}

export async function deleteResource(key, id) {
  const admin = await requireAdmin();
  const res = getResource(key);
  if (!res) throw new Error("Unknown resource");
  if (key === "admins" && id === admin.id) redirect(withError("/admin/admins", "ลบบัญชีตัวเองไม่ได้"));
  try {
    await query(`DELETE FROM \`${res.table}\` WHERE id = ?`, [id]);
  } catch (e) {
    redirect(withError(`/admin/${key}`, errorMessage(e)));
  }
  revalidatePath(`/admin/${key}`);
  redirect(`/admin/${key}`);
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
  redirect(`/admin/bookings/${id}?saved=1`);
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
  redirect(`/admin/bookings/${bookingId}?saved=1`);
}
