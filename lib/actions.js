"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp, diff, logAudit } from "./audit";
import { createSession, destroySession, requireAdmin } from "./auth";
import { query, transaction } from "./db";
import { holds, moveStock, StockError } from "./inventory";
import { label } from "./format";
import { suggestPlans } from "./planner";
import { displayName, getResource, shortLabel } from "./resources";
import { UPLOAD_URL_RE } from "./uploads";

// Messages travel in the URL and are shown by components/admin/Toast.js
const withError = (path, msg) => `${path}?error=${encodeURIComponent(msg)}`;
const withOk = (path, msg) => `${path}?ok=${encodeURIComponent(msg)}`;

function errorMessage(e) {
  if (e.code === "ER_DUP_ENTRY") return "ข้อมูลซ้ำกับที่มีอยู่แล้ว (เช่น อีเมลซ้ำ)";
  if (e.code === "ER_ROW_IS_REFERENCED_2") return "ลบไม่ได้ เพราะมีข้อมูลอื่นอ้างอิงอยู่ (เช่น ลูกค้ามีการจองแล้ว)";
  return e.message ?? "เกิดข้อผิดพลาด";
}

// ---------- Auth ----------

const LOCK_MINUTES = 15;
const MAX_FAILS_PER_EMAIL = 5; // wrong passwords for one account within the window
const MAX_FAILS_PER_IP = 20; // wrong passwords from one machine (across accounts)

/** Minutes until this email / IP may try again (0 = not locked). */
async function lockedFor(email, ip) {
  const [row] = await query(
    `SELECT
       (SELECT COUNT(*) FROM admin_login_attempts WHERE email = ? AND success = 0
          AND created_at > NOW() - INTERVAL ? MINUTE
          AND created_at > COALESCE((SELECT MAX(created_at) FROM admin_login_attempts WHERE email = ? AND success = 1), '1970-01-01')) AS by_email,
       (SELECT COUNT(*) FROM admin_login_attempts WHERE ip = ? AND success = 0 AND created_at > NOW() - INTERVAL ? MINUTE) AS by_ip,
       (SELECT TIMESTAMPDIFF(SECOND, NOW(), MAX(created_at) + INTERVAL ? MINUTE)
          FROM admin_login_attempts WHERE (email = ? OR ip = ?) AND success = 0) AS wait_s`,
    [email, LOCK_MINUTES, email, ip, LOCK_MINUTES, LOCK_MINUTES, email, ip],
  );
  if (row.by_email < MAX_FAILS_PER_EMAIL && row.by_ip < MAX_FAILS_PER_IP) return 0;
  return Math.max(1, Math.ceil(Number(row.wait_s) / 60));
}

export async function login(formData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 150);
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();

  const wait = await lockedFor(email, ip);
  if (wait) redirect(`/login?locked=${wait}`);

  const [admin] = await query(
    "SELECT id, name, password_hash, session_version FROM admins WHERE email = ? AND status = 'active'",
    [email],
  );
  const ok = admin && (await bcrypt.compare(password, admin.password_hash));
  await query("INSERT INTO admin_login_attempts (email, ip, success) VALUES (?,?,?)", [email, ip, ok ? 1 : 0]);
  if (!ok) {
    const nowLocked = await lockedFor(email, ip);
    redirect(nowLocked ? `/login?locked=${nowLocked}` : "/login?error=1");
  }
  await createSession(admin.id, admin.session_version);
  await logAudit(admin, "login", "admins", admin.id, `${admin.name} เข้าสู่ระบบ`);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/** Password rules shared by "change my password" and admin edits. Returns an error message or null. */
function passwordProblem(password, email) {
  if (password.length < 8) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "ต้องมีทั้งตัวอักษรภาษาอังกฤษและตัวเลข";
  const name = String(email ?? "").split("@")[0].toLowerCase();
  if (name.length >= 3 && password.toLowerCase().includes(name)) return "ห้ามมีชื่อผู้ใช้อยู่ในรหัสผ่าน";
  return null;
}

/** /account/password — required on first login, available any time after. */
export async function changeOwnPassword(_prev, formData) {
  const admin = await requireAdmin({ allowTempPassword: true });
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const [row] = await query("SELECT email, password_hash FROM admins WHERE id = ?", [admin.id]);
  if (!(await bcrypt.compare(current, row.password_hash))) return { fieldErrors: { current: "รหัสผ่านปัจจุบันไม่ถูกต้อง" } };
  const problem = passwordProblem(next, row.email);
  if (problem) return { fieldErrors: { password: problem } };
  if (await bcrypt.compare(next, row.password_hash)) return { fieldErrors: { password: "รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม" } };
  if (next !== confirm) return { fieldErrors: { confirm: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" } };

  await query(
    `UPDATE admins SET password_hash = ?, must_change_password = 0, session_version = session_version + 1,
       password_changed_at = NOW() WHERE id = ?`,
    [await bcrypt.hash(next, 10), admin.id],
  );
  // Other devices are now logged out; keep this one signed in with the new version
  await createSession(admin.id, admin.session_version + 1);
  await logAudit(admin, "password", "admins", admin.id, `${admin.name} เปลี่ยนรหัสผ่านของตัวเอง`);
  redirect(withOk("/admin", "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว"));
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
  if (f.type === "image" && !/^https?:\/\/\S+$/i.test(raw) && !UPLOAD_URL_RE.test(raw)) {
    return "ลิงก์รูปต้องขึ้นต้นด้วย https:// หรืออัปโหลดจากเครื่อง";
  }
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
  const admin = await requireAdmin();
  const res = getResource(key);
  if (!res) throw new Error("Unknown resource");

  const data = {};
  const fieldErrors = {};
  for (const f of res.fields) {
    const raw = String(formData.get(f.name) ?? "").trim();
    const err = checkField(f, raw, !id) ?? (f.type === "password" && raw ? passwordProblem(raw, formData.get("email")) : null);
    if (err) { fieldErrors[f.name] = err; continue; }

    if (f.type === "checkbox") data[f.name] = formData.has(f.name) ? 1 : 0;
    else if (f.type === "password") { if (raw) data[f.name] = await bcrypt.hash(raw, 10); }
    else if (raw === "") data[f.name] = null;
    else if (NUMERIC.includes(f.type)) data[f.name] = Number(raw);
    else if (f.type === "datetime") data[f.name] = raw.replace("T", " ");
    else data[f.name] = f.upper ? raw.toUpperCase() : raw;
  }
  if (!Object.keys(fieldErrors).length && res.validate) Object.assign(fieldErrors, res.validate(data));
  const self = key === "admins" && id === admin.id;
  if (self && data.status === "banned") fieldErrors.status = "ระงับบัญชีตัวเองไม่ได้";

  const count = Object.keys(fieldErrors).length;
  if (count) return { error: `กรุณาแก้ไขข้อมูลให้ถูกต้อง (${count} ช่อง)`, fieldErrors };

  // Admin passwords: a password set by someone else is temporary (must change at next login),
  // and any password change logs that admin out of every device.
  const adminPasswordChanged = key === "admins" && "password_hash" in data;
  const extra = adminPasswordChanged ? { must_change_password: self ? 0 : 1 } : {};

  const [before] = id ? await query(`SELECT * FROM \`${res.table}\` WHERE id = ?`, [id]) : [];
  const cols = [...Object.keys(data), ...Object.keys(extra)];
  const values = [...Object.values(data), ...Object.values(extra)];
  try {
    if (id) {
      const bump = adminPasswordChanged ? ", session_version = session_version + 1, password_changed_at = NOW()" : "";
      await query(`UPDATE \`${res.table}\` SET ${cols.map((c) => `\`${c}\` = ?`).join(", ")}${bump} WHERE id = ?`, [...values, id]);
    } else {
      const r = await query(
        `INSERT INTO \`${res.table}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        values,
      );
      id = r.insertId;
    }
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY" && "email" in data) {
      return { error: "กรุณาแก้ไขข้อมูลให้ถูกต้อง (1 ช่อง)", fieldErrors: { email: "อีเมลนี้ถูกใช้แล้ว" } };
    }
    return { error: errorMessage(e) };
  }

  const name = displayName(res, { ...before, ...data, id });
  await logAudit(admin, before ? "update" : "create", res.table, id,
    `${before ? "แก้ไข" : "เพิ่ม"}${res.title} “${name}”`, diff(before, data));
  if (self && adminPasswordChanged) {
    const [me] = await query("SELECT session_version FROM admins WHERE id = ?", [admin.id]);
    await createSession(admin.id, me.session_version); // stay signed in on this device
  }
  revalidatePath(`/admin/${key}`);
  redirect(withOk(`/admin/${key}`, before ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : `เพิ่ม${res.title}เรียบร้อยแล้ว`));
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
  const { password_hash: _secret, ...snapshot } = row ?? {};
  await logAudit(admin, "delete", res.table, id, `ลบ${res.title} “${name}”`,
    Object.fromEntries(Object.entries(snapshot).map(([k, v]) => [k, [v, null]])));
  revalidatePath(`/admin/${key}`);
  redirect(withOk(`/admin/${key}`, `ลบ${res.title} “${name}” เรียบร้อยแล้ว`));
}

// ---------- Trip plans ----------

const ITEM_TYPES = ["flight", "hotel", "event", "activity", "food", "transport"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Checks the trip form (shared by "suggest" and "save"). Returns { req, fieldErrors }. */
function readTripRequest(input) {
  const req = {
    user_id: Number(input.user_id) || null,
    title: String(input.title ?? "").trim().slice(0, 150),
    destination: String(input.destination ?? "").trim().slice(0, 150),
    start_date: String(input.start_date ?? ""),
    end_date: String(input.end_date ?? "") || String(input.start_date ?? ""),
    travelers: Math.min(20, Math.max(1, Number(input.travelers) || 1)),
    budget: input.budget === "" || input.budget == null ? null : Number(input.budget),
    prompt: String(input.prompt ?? "").trim().slice(0, 2000),
  };
  const fieldErrors = {};
  if (!req.user_id) fieldErrors.user_id = "กรุณาเลือกลูกค้า";
  if (!req.destination) fieldErrors.destination = "กรุณาเลือกปลายทาง";
  if (!DATE_RE.test(req.start_date)) fieldErrors.start_date = "กรุณาเลือกวันเริ่มเดินทาง";
  if (!DATE_RE.test(req.end_date) || req.end_date < req.start_date) fieldErrors.end_date = "วันกลับต้องไม่ก่อนวันเริ่ม";
  else if ((new Date(req.end_date) - new Date(req.start_date)) / 864e5 > 13) fieldErrors.end_date = "วางแผนได้สูงสุด 14 วัน";
  if (req.budget !== null && !(req.budget >= 0)) fieldErrors.budget = "งบต้องเป็นตัวเลขไม่ติดลบ";
  return { req, fieldErrors };
}

/** Ask the planner (Claude, or rules without an API key) for 3 plan options. Nothing is saved. */
export async function suggestTripPlans(input) {
  await requireAdmin();
  const { req, fieldErrors } = readTripRequest(input);
  if (Object.keys(fieldErrors).length) return { error: "กรุณากรอกข้อมูลการเดินทางให้ครบ", fieldErrors };
  return suggestPlans(req);
}

/** Create (id = null) or update a trip plan with its day-by-day items. */
export async function saveTripPlan(id, input) {
  const admin = await requireAdmin();
  const isUpdate = Boolean(id);
  const { req, fieldErrors } = readTripRequest(input);
  if (!req.title) fieldErrors.title = "กรุณาตั้งชื่อแผน";
  if (Object.keys(fieldErrors).length) return { error: "กรุณากรอกข้อมูลให้ครบ", fieldErrors };

  const days = (Array.isArray(input.plan?.days) ? input.plan.days : []).slice(0, 14).map((d, i) => ({
    day: i + 1,
    date: DATE_RE.test(d.date) ? d.date : null,
    title: String(d.title ?? "").slice(0, 150),
    items: (Array.isArray(d.items) ? d.items : []).slice(0, 30).map((it) => ({
      time: /^\d{2}:\d{2}$/.test(it.time) ? it.time : "",
      type: ITEM_TYPES.includes(it.type) ? it.type : "activity",
      ref_id: Number.isInteger(it.ref_id) ? it.ref_id : null,
      title: String(it.title ?? "").slice(0, 200),
      note: String(it.note ?? "").slice(0, 300),
      cost: Math.max(0, Number(it.cost) || 0),
    })),
  }));
  const plan = {
    summary: String(input.plan?.summary ?? "").slice(0, 1000),
    estimated_cost: days.flatMap((d) => d.items).reduce((s, it) => s + it.cost, 0),
    days,
  };
  const source = input.source === "ai" ? "ai" : "customer";
  const style = ["budget", "balanced", "premium"].includes(input.style) ? input.style : null;
  const values = [req.user_id, req.title, req.destination, req.start_date, req.end_date, req.travelers, req.budget, source, style, req.prompt || null, JSON.stringify(plan)];

  try {
    if (id) {
      await query(
        `UPDATE trip_plans SET user_id=?, title=?, destination=?, start_date=?, end_date=?, travelers=?, budget=?, source=?, style=?, prompt=?, plan=? WHERE id=?`,
        [...values, id],
      );
    } else {
      const res = await query(
        `INSERT INTO trip_plans (user_id, title, destination, start_date, end_date, travelers, budget, source, style, prompt, plan)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        values,
      );
      id = res.insertId;
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  await logAudit(admin, isUpdate ? "update" : "create", "trip_plans", id, `${isUpdate ? "แก้ไข" : "สร้าง"}แผนเที่ยว “${req.title}”`,
    { destination: [null, req.destination], days: [null, days.length], estimated_cost: [null, plan.estimated_cost] });
  revalidatePath("/admin/trip_plans");
  redirect(withOk(`/admin/trip_plans/${id}`, "บันทึกแผนเที่ยวเรียบร้อยแล้ว"));
}

// ---------- Bookings ----------

const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

/**
 * Change a booking's status inside one transaction, keeping stock in sync:
 * cancelling gives seats/tickets back; un-cancelling takes them again (fails if sold out / rooms full).
 * Returns a short Thai note about the stock change.
 */
async function setBookingStatus(q, booking, status) {
  let note = "";
  if (holds(booking.status) && !holds(status)) {
    await moveStock(q, booking.id, -1);
    note = " · คืนที่นั่ง/ตั๋วเข้าสต็อกแล้ว";
  } else if (!holds(booking.status) && holds(status)) {
    await moveStock(q, booking.id, +1);
    note = " · ตัดสต็อกที่นั่ง/ตั๋วแล้ว";
  }
  await q("UPDATE bookings SET status = ? WHERE id = ?", [status, booking.id]);
  return note;
}

export async function updateBooking(id, formData) {
  const admin = await requireAdmin();
  const status = String(formData.get("status"));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!BOOKING_STATUSES.includes(status)) throw new Error("Invalid status");

  let stockNote = "";
  let booking;
  try {
    await transaction(async (q) => {
      [booking] = await q("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [id]);
      if (!booking) throw new StockError("ไม่พบการจองนี้");
      stockNote = await setBookingStatus(q, booking, status);
      await q("UPDATE bookings SET note = ? WHERE id = ?", [note, id]);
    });
  } catch (e) {
    if (e instanceof StockError) redirect(withError(`/admin/bookings/${id}`, `เปลี่ยนสถานะไม่ได้ — ${e.message}`));
    throw e;
  }
  await logAudit(admin, "status", "bookings", id, `การจอง ${booking.booking_code}: ${label(booking.status)} → ${label(status)}${stockNote}`,
    diff({ status: booking.status, note: booking.note }, { status, note }));
  revalidatePath(`/admin/bookings/${id}`);
  redirect(withOk(`/admin/bookings/${id}`, `บันทึกการจองเรียบร้อยแล้ว${stockNote}`));
}

export async function updatePayment(paymentId, bookingId, formData) {
  const admin = await requireAdmin();
  const status = String(formData.get("status"));
  if (!PAYMENT_STATUSES.includes(status)) throw new Error("Invalid status");

  let before;
  let extra = "";
  await transaction(async (q) => {
    [before] = await q("SELECT * FROM payments WHERE id = ? AND booking_id = ? FOR UPDATE", [paymentId, bookingId]);
    if (!before) throw new Error("ไม่พบการชำระเงินนี้");
    await q(
      "UPDATE payments SET status = ?, paid_at = IF(? = 'paid' AND paid_at IS NULL, NOW(), paid_at) WHERE id = ?",
      [status, status, paymentId],
    );
    // Refunding means the trip is off: cancel the booking and return its stock
    if (status === "refunded") {
      const [booking] = await q("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
      if (booking.status !== "cancelled") extra = " · ยกเลิกการจองอัตโนมัติ" + (await setBookingStatus(q, booking, "cancelled"));
    }
  });
  await logAudit(admin, "status", "payments", paymentId, `การชำระเงิน #${paymentId}: ${label(before.status)} → ${label(status)}${extra}`,
    diff({ status: before.status }, { status }));
  revalidatePath(`/admin/bookings/${bookingId}`);
  redirect(withOk(`/admin/bookings/${bookingId}`, `อัปเดตการชำระเงินเป็น “${label(status)}” แล้ว${extra}`));
}
