"use server";

import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp } from "./audit";
import { addDaysStr, nightsBetween, todayStr } from "./catalog";
import { createCustomerSession, destroyCustomerSession, getCustomer } from "./customer";
import { query, transaction } from "./db";
import { moveStock, setBookingStatus, StockError } from "./inventory";
import { passwordProblem, safeNext } from "./passwords";
import { cleanPlan, readTripRequest, writeTripPlan } from "./trips";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const sep = (path) => (path.includes("?") ? "&" : "?");
const withOk = (path, msg) => `${path}${sep(path)}ok=${encodeURIComponent(msg)}`;
const withError = (path, msg) => `${path}${sep(path)}error=${encodeURIComponent(msg)}`;

// ---------- Customer accounts ----------

export async function registerCustomer(_prev, formData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 150);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""), "/");

  const fieldErrors = {};
  if (!name) fieldErrors.name = "กรุณากรอกชื่อ";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "รูปแบบอีเมลไม่ถูกต้อง";
  if (phone && !/^[0-9+\-\s]{9,30}$/.test(phone)) fieldErrors.phone = "เบอร์โทรไม่ถูกต้อง";
  const pw = passwordProblem(password, email);
  if (pw) fieldErrors.password = pw;
  else if (password !== confirm) fieldErrors.confirm = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: { name, email, phone } };

  let id;
  try {
    const res = await query("INSERT INTO users (name, email, phone, password_hash) VALUES (?,?,?,?)", [
      name, email, phone || null, await bcrypt.hash(password, 10),
    ]);
    id = res.insertId;
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return { fieldErrors: { email: "อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบ" }, values: { name, email, phone } };
    throw e;
  }
  await createCustomerSession(id);
  redirect(withOk(next, `ยินดีต้อนรับ ${name}!`));
}

const LOCK_MINUTES = 15;

export async function signinCustomer(_prev, formData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 150);
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""), "/");
  const ip = await clientIp();

  const [{ fails }] = await query(
    `SELECT COUNT(*) AS fails FROM customer_login_attempts WHERE success = 0 AND created_at > NOW() - INTERVAL ? MINUTE
       AND (email = ? OR ip = ?)
       AND created_at > COALESCE((SELECT MAX(created_at) FROM customer_login_attempts WHERE email = ? AND success = 1), '1970-01-01')`,
    [LOCK_MINUTES, email, ip, email],
  );
  if (fails >= 5) return { error: `ใส่รหัสผิดหลายครั้งเกินไป — ลองใหม่ใน ${LOCK_MINUTES} นาที`, values: { email } };

  const [user] = await query("SELECT id, name, password_hash FROM users WHERE email = ? AND status = 'active'", [email]);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  await query("INSERT INTO customer_login_attempts (email, ip, success) VALUES (?,?,?)", [email, ip, ok ? 1 : 0]);
  if (!ok) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", values: { email } };

  await createCustomerSession(user.id);
  redirect(withOk(next, `ยินดีต้อนรับกลับ ${user.name}`));
}

export async function signoutCustomer() {
  await destroyCustomerSession();
  redirect("/");
}

// ---------- Trip planner ----------

/**
 * Suggest 3 plans for the customer. Free rule-based suggestions work without signing in;
 * when Claude is switched on (it costs money per call) the customer must be signed in.
 */
export async function suggestMyTrip(input) {
  // Loaded on demand so every page that imports this file doesn't also load the AI SDK
  const { aiEnabled, suggestPlans } = await import("./planner");
  if (aiEnabled() && !(await getCustomer())) {
    return { error: "กรุณาเข้าสู่ระบบก่อนให้ AI วางแผน", fieldErrors: {} };
  }
  const { req, fieldErrors } = readTripRequest(input, { needUser: false });
  if (Object.keys(fieldErrors).length) return { error: "กรุณากรอกข้อมูลการเดินทางให้ครบ", fieldErrors };
  return suggestPlans(req);
}

/** Save the plan to the signed-in customer's account (create, or update one they own). */
export async function saveMyTrip(id, input) {
  const user = await getCustomer();
  if (!user) return { error: "กรุณาเข้าสู่ระบบเพื่อบันทึกแผน — แผนที่วางไว้จะยังอยู่ในหน้านี้" };
  const { req, fieldErrors } = readTripRequest(input, { needUser: false });
  if (!req.title) fieldErrors.title = "กรุณาตั้งชื่อแผน";
  if (Object.keys(fieldErrors).length) return { error: "กรุณากรอกข้อมูลให้ครบ", fieldErrors };
  if (id) {
    const [own] = await query("SELECT id FROM trip_plans WHERE id = ? AND user_id = ?", [id, user.id]);
    if (!own) return { error: "ไม่พบแผนนี้ในบัญชีของคุณ" };
  }
  const newId = await writeTripPlan(id, user.id, req, cleanPlan(input));
  revalidatePath("/plans");
  redirect(withOk(`/plans/${newId}`, "บันทึกแผนเที่ยวแล้ว"));
}

export async function deleteMyTrip(id) {
  const user = await getCustomer();
  if (!user) redirect("/signin?next=/plans");
  await query("DELETE FROM trip_plans WHERE id = ? AND user_id = ?", [id, user.id]);
  revalidatePath("/plans");
  redirect(withOk("/plans", "ลบแผนแล้ว"));
}

// ---------- Booking ----------

function bookingCode() {
  const d = todayStr().replaceAll("-", "");
  return `BK${d}${String(randomInt(0, 10000)).padStart(4, "0")}`;
}

/**
 * Turn the browser cart into a booking. Prices, names and stock are all re-read from the database —
 * nothing from the browser is trusted except "which item" and "how many".
 * Returns { error } / { needLogin } or redirects to the new booking.
 */
export async function placeOrder(cart, method) {
  const user = await getCustomer();
  if (!user) return { needLogin: true };
  if (!["credit_card", "promptpay"].includes(method)) return { error: "กรุณาเลือกวิธีชำระเงิน" };
  if (!Array.isArray(cart) || !cart.length) return { error: "ตะกร้าว่าง" };
  if (cart.length > 20) return { error: "ตะกร้ามีรายการมากเกินไป" };

  const today = todayStr();
  const lines = [];
  for (const raw of cart) {
    const qty = Math.min(10, Math.max(1, Number(raw.qty) || 1));
    if (raw.type === "room") {
      const { check_in: ci, check_out: co } = raw;
      if (!DATE_RE.test(ci) || !DATE_RE.test(co) || ci < today || co <= ci || nightsBetween(ci, co) > 30) {
        return { error: "วันที่เข้าพักไม่ถูกต้อง กรุณาเลือกใหม่" };
      }
      const [r] = await query(
        "SELECT r.*, h.name AS hotel FROM rooms r JOIN hotels h ON h.id = r.hotel_id WHERE r.id = ? AND h.is_active = 1",
        [Number(raw.room_id)],
      );
      if (!r) return { error: "มีห้องพักในตะกร้าที่ไม่เปิดขายแล้ว" };
      const nights = nightsBetween(ci, co);
      lines.push({ type: "room", id: r.id, desc: `${r.hotel} — ${r.name}`, start: ci, end: co, qty, unit: Number(r.price_per_night) * nights });
    } else if (raw.type === "flight") {
      const [f] = await query("SELECT * FROM flights WHERE id = ? AND is_active = 1 AND depart_at > NOW()", [Number(raw.flight_id)]);
      if (!f) return { error: "มีเที่ยวบินในตะกร้าที่ไม่เปิดขายแล้ว" };
      lines.push({ type: "flight", id: f.id, desc: `${f.flight_no} ${f.origin} → ${f.destination} (${f.seat_class})`, start: f.depart_at.slice(0, 10), end: null, qty, unit: Number(f.price) });
    } else if (raw.type === "ticket") {
      const [t] = await query(
        "SELECT t.*, e.name AS event, e.start_date, e.end_date FROM event_tickets t JOIN events e ON e.id = t.event_id WHERE t.id = ? AND e.is_active = 1",
        [Number(raw.ticket_id)],
      );
      if (!t) return { error: "มีตั๋วในตะกร้าที่ไม่เปิดขายแล้ว" };
      const date = DATE_RE.test(raw.date) ? raw.date : null;
      if (!date || date < today || date < t.start_date || date > t.end_date) return { error: `วันที่เข้างาน ${t.event} ไม่ถูกต้อง` };
      lines.push({ type: "ticket", id: t.id, desc: `${t.event} — ${t.name}`, start: date, end: null, qty, unit: Number(t.price) });
    } else {
      return { error: "รายการในตะกร้าไม่ถูกต้อง" };
    }
  }
  const total = lines.reduce((s, l) => s + l.unit * l.qty, 0);

  let code;
  try {
    code = await transaction(async (q) => {
      let c;
      let bookingId;
      for (let attempt = 0; !bookingId; attempt++) {
        c = bookingCode();
        try {
          bookingId = (await q("INSERT INTO bookings (booking_code, user_id, status, total_amount) VALUES (?,?,?,?)", [c, user.id, "pending", total])).insertId;
        } catch (e) {
          if (e.code !== "ER_DUP_ENTRY" || attempt > 5) throw e;
        }
      }
      for (const l of lines) {
        await q(
          `INSERT INTO booking_items (booking_id, item_type, item_id, description, start_date, end_date, quantity, unit_price, subtotal)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [bookingId, l.type, l.id, l.desc, l.start, l.end, l.qty, l.unit, l.unit * l.qty],
        );
      }
      await moveStock(q, bookingId, +1); // holds seats / tickets / rooms — throws if sold out
      await q("INSERT INTO payments (booking_id, method, amount, status) VALUES (?,?,?,'pending')", [bookingId, method, total]);
      return c;
    });
  } catch (e) {
    if (e instanceof StockError) return { error: `จองไม่สำเร็จ — ${e.message}` };
    throw e;
  }
  revalidatePath("/bookings");
  redirect(withOk(`/bookings/${code}`, "จองสำเร็จ! กรุณาชำระเงินเพื่อยืนยันการจอง"));
}

async function myBooking(q, code, userId) {
  const [b] = await q("SELECT * FROM bookings WHERE booking_code = ? AND user_id = ? FOR UPDATE", [code, userId]);
  return b;
}

/** Simulated payment: marks the pending payment as paid and confirms the booking. No money moves. */
export async function payBooking(code) {
  const user = await getCustomer();
  if (!user) redirect(`/signin?next=/bookings/${encodeURIComponent(code)}`);
  const path = `/bookings/${code}`;
  let done = false;
  await transaction(async (q) => {
    const b = await myBooking(q, code, user.id);
    if (!b || b.status !== "pending") return;
    await q("UPDATE payments SET status = 'paid', paid_at = NOW() WHERE booking_id = ? AND status = 'pending'", [b.id]);
    await q("UPDATE bookings SET status = 'confirmed' WHERE id = ?", [b.id]);
    done = true;
  });
  revalidatePath(path);
  redirect(done ? withOk(path, "ชำระเงินสำเร็จ — การจองได้รับการยืนยันแล้ว") : withError(path, "การจองนี้ไม่อยู่ในสถานะรอชำระเงิน"));
}

/** Customers may cancel until the day before the trip starts. Paid bookings are marked refunded. */
export async function cancelMyBooking(code) {
  const user = await getCustomer();
  if (!user) redirect(`/signin?next=/bookings/${encodeURIComponent(code)}`);
  const path = `/bookings/${code}`;
  let message;
  await transaction(async (q) => {
    const b = await myBooking(q, code, user.id);
    if (!b || !["pending", "confirmed"].includes(b.status)) { message = "การจองนี้ยกเลิกไม่ได้"; return; }
    const [{ first }] = await q("SELECT MIN(start_date) AS first FROM booking_items WHERE booking_id = ?", [b.id]);
    if (first && first <= addDaysStr(todayStr(), 0)) { message = "ยกเลิกได้ถึงก่อนวันเดินทาง 1 วันเท่านั้น"; return; }
    await setBookingStatus(q, b, "cancelled");
    await q(
      "UPDATE payments SET status = IF(status = 'paid', 'refunded', 'failed') WHERE booking_id = ? AND status IN ('paid','pending')",
      [b.id],
    );
  });
  revalidatePath(path);
  redirect(message ? withError(path, message) : withOk(path, "ยกเลิกการจองแล้ว หากชำระเงินแล้วจะได้รับเงินคืน"));
}
