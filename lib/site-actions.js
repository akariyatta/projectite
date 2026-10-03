"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp } from "./audit";
import { cancelBooking, confirmPayment, expireStaleBookings, HOLD_MINUTES, notify } from "./booking-flow";
import { nightsBetween, todayStr } from "./catalog";
import { createCustomerSession, destroyCustomerSession, getCustomer } from "./customer";
import { query, transaction } from "./db";
import { emails } from "./emails";
import { moveStock, StockError } from "./inventory";
import { appUrl, sendMail } from "./mail";
import { passwordProblem, safeNext } from "./passwords";
import { createCheckout, stripeEnabled } from "./payments";
import { cleanPlan, readTripRequest, writeTripPlan } from "./trips";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s]{9,30}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const sep = (path) => (path.includes("?") ? "&" : "?");
const withOk = (path, msg) => `${path}${sep(path)}ok=${encodeURIComponent(msg)}`;
const withError = (path, msg) => `${path}${sep(path)}error=${encodeURIComponent(msg)}`;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

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
  if (phone && !PHONE_RE.test(phone)) fieldErrors.phone = "เบอร์โทรไม่ถูกต้อง";
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
  await createCustomerSession(id, 1);
  const mail = emails.welcome({ name });
  await sendMail(email, mail.subject, mail.html);
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

  const [user] = await query("SELECT id, name, password_hash, session_version FROM users WHERE email = ? AND status = 'active'", [email]);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  await query("INSERT INTO customer_login_attempts (email, ip, success) VALUES (?,?,?)", [email, ip, ok ? 1 : 0]);
  if (!ok) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", values: { email } };

  await createCustomerSession(user.id, user.session_version);
  redirect(withOk(next, `ยินดีต้อนรับกลับ ${user.name}`));
}

export async function signoutCustomer() {
  await destroyCustomerSession();
  redirect("/");
}

const RESET_MINUTES = 30;

/**
 * "Forgot password": always answers the same way (so nobody can probe which emails have accounts),
 * and emails a one-time link valid for 30 minutes. Only a hash of the token is stored.
 */
export async function requestPasswordReset(_prev, formData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 150);
  if (!EMAIL_RE.test(email)) return { fieldErrors: { email: "รูปแบบอีเมลไม่ถูกต้อง" }, values: { email } };
  const done = { sent: true, values: { email } };

  const [user] = await query("SELECT id, name FROM users WHERE email = ? AND status = 'active'", [email]);
  if (!user) return done;
  const [{ recent }] = await query(
    "SELECT COUNT(*) AS recent FROM password_resets WHERE user_id = ? AND created_at > NOW() - INTERVAL 15 MINUTE",
    [user.id],
  );
  if (recent >= 3) return done; // quietly limit how many emails one address can trigger

  const token = randomBytes(32).toString("base64url");
  await query("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL ? MINUTE)", [
    user.id, sha256(token), RESET_MINUTES,
  ]);
  const mail = emails.passwordReset(user, `${appUrl()}/reset?token=${token}`, RESET_MINUTES);
  await sendMail(email, mail.subject, mail.html);
  return done;
}

async function validResetToken(token) {
  if (!token || token.length > 100) return null;
  const [row] = await query(
    "SELECT r.id, r.user_id, u.email, u.name FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > NOW() AND u.status = 'active'",
    [sha256(token)],
  );
  return row ?? null;
}

/** Used by the /reset page to show "link expired" before the form is filled in. */
export async function checkResetToken(token) {
  return Boolean(await validResetToken(token));
}

export async function resetPassword(_prev, formData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const row = await validResetToken(token);
  if (!row) return { error: "ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว — กรุณาขอลิงก์ใหม่" };
  const pw = passwordProblem(password, row.email);
  if (pw) return { fieldErrors: { password: pw } };
  if (password !== confirm) return { fieldErrors: { confirm: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" } };

  const version = await transaction(async (q) => {
    await q("UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [row.user_id]);
    await q("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?", [await bcrypt.hash(password, 10), row.user_id]);
    return (await q("SELECT session_version FROM users WHERE id = ?", [row.user_id]))[0].session_version;
  });
  await createCustomerSession(row.user_id, version);
  const mail = emails.passwordChanged(row);
  await sendMail(row.email, mail.subject, mail.html);
  redirect(withOk("/profile", "ตั้งรหัสผ่านใหม่เรียบร้อย — เข้าสู่ระบบให้แล้ว"));
}

export async function updateProfile(_prev, formData) {
  const user = await getCustomer();
  if (!user) redirect("/signin?next=/profile");
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30);
  const fieldErrors = {};
  if (!name) fieldErrors.name = "กรุณากรอกชื่อ";
  if (phone && !PHONE_RE.test(phone)) fieldErrors.phone = "เบอร์โทรไม่ถูกต้อง";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: { name, phone } };
  await query("UPDATE users SET name = ?, phone = ? WHERE id = ?", [name, phone || null, user.id]);
  revalidatePath("/", "layout");
  redirect(withOk("/profile", "บันทึกข้อมูลส่วนตัวแล้ว"));
}

export async function changeMyPassword(_prev, formData) {
  const user = await getCustomer();
  if (!user) redirect("/signin?next=/profile");
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const [row] = await query("SELECT password_hash FROM users WHERE id = ?", [user.id]);
  if (!(await bcrypt.compare(current, row.password_hash))) return { fieldErrors: { current: "รหัสผ่านปัจจุบันไม่ถูกต้อง" } };
  const pw = passwordProblem(password, user.email);
  if (pw) return { fieldErrors: { password: pw } };
  if (await bcrypt.compare(password, row.password_hash)) return { fieldErrors: { password: "รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม" } };
  if (password !== confirm) return { fieldErrors: { confirm: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" } };

  await query("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?", [await bcrypt.hash(password, 10), user.id]);
  await createCustomerSession(user.id, user.session_version + 1); // stay signed in here, other devices are logged out
  const mail = emails.passwordChanged(user);
  await sendMail(user.email, mail.subject, mail.html);
  redirect(withOk("/profile", "เปลี่ยนรหัสผ่านแล้ว — เครื่องอื่นถูกออกจากระบบ"));
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
 * The booking holds its stock for HOLD_MINUTES; unpaid after that it's cancelled automatically.
 * Returns { error } / { needLogin } or redirects to the new booking.
 */
export async function placeOrder(cart, method) {
  const user = await getCustomer();
  if (!user) return { needLogin: true };
  if (!["credit_card", "promptpay"].includes(method)) return { error: "กรุณาเลือกวิธีชำระเงิน" };
  if (!Array.isArray(cart) || !cart.length) return { error: "ตะกร้าว่าง" };
  if (cart.length > 20) return { error: "ตะกร้ามีรายการมากเกินไป" };
  await expireStaleBookings(); // free stock held by abandoned bookings before checking availability

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
  const minutes = HOLD_MINUTES();

  let booking;
  try {
    booking = await transaction(async (q) => {
      let code;
      let bookingId;
      for (let attempt = 0; !bookingId; attempt++) {
        code = bookingCode();
        try {
          bookingId = (await q(
            "INSERT INTO bookings (booking_code, user_id, status, total_amount, expires_at) VALUES (?,?,?,?, NOW() + INTERVAL ? MINUTE)",
            [code, user.id, "pending", total, minutes],
          )).insertId;
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
      await q("INSERT INTO payments (booking_id, method, provider, amount, status) VALUES (?,?,?,?,'pending')", [
        bookingId, method, stripeEnabled() ? "stripe" : "simulated", total,
      ]);
      return { id: bookingId, code };
    });
  } catch (e) {
    if (e instanceof StockError) return { error: `จองไม่สำเร็จ — ${e.message}` };
    throw e;
  }
  await notify(booking.id, "bookingCreated", minutes);
  revalidatePath("/bookings");
  redirect(withOk(`/bookings/${booking.code}`, `จองสำเร็จ! กรุณาชำระเงินภายใน ${minutes} นาที`));
}

async function myBooking(code, userId) {
  const [b] = await query("SELECT * FROM bookings WHERE booking_code = ? AND user_id = ?", [code, userId]);
  return b;
}

/**
 * "Pay" button. With Stripe configured: sends the customer to Stripe Checkout (card / PromptPay).
 * Without it: simulated payment — marks the booking paid immediately (test mode, no money moves).
 */
export async function payBooking(code) {
  const user = await getCustomer();
  if (!user) redirect(`/signin?next=/bookings/${encodeURIComponent(code)}`);
  const path = `/bookings/${code}`;
  await expireStaleBookings({ force: true });
  const b = await myBooking(code, user.id);
  if (!b || b.status !== "pending") redirect(withError(path, "การจองนี้ไม่อยู่ในสถานะรอชำระเงิน (อาจหมดเวลาแล้ว)"));
  const [payment] = await query("SELECT * FROM payments WHERE booking_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1", [b.id]);
  if (!payment) redirect(withError(path, "ไม่พบรายการชำระเงิน"));

  if (payment.provider === "stripe") {
    if (!stripeEnabled()) redirect(withError(path, "ระบบชำระเงินออนไลน์ยังไม่พร้อม กรุณาติดต่อเจ้าหน้าที่"));
    let url;
    try {
      const items = await query("SELECT * FROM booking_items WHERE booking_id = ?", [b.id]);
      const checkout = await createCheckout({ booking: b, payment, user, items });
      await query("UPDATE payments SET provider_ref = ? WHERE id = ?", [checkout.id, payment.id]);
      url = checkout.url;
    } catch (e) {
      console.error("Stripe checkout failed:", e);
      redirect(withError(path, "เปิดหน้าชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    }
    redirect(url); // → Stripe; comes back via /api/payments/stripe/return
  }

  await confirmPayment(b.id);
  revalidatePath(path);
  redirect(withOk(path, "ชำระเงินสำเร็จ — การจองได้รับการยืนยันแล้ว"));
}

/** Customers may cancel until the day before the trip starts. Paid bookings are refunded. */
export async function cancelMyBooking(code) {
  const user = await getCustomer();
  if (!user) redirect(`/signin?next=/bookings/${encodeURIComponent(code)}`);
  const path = `/bookings/${code}`;
  const b = await myBooking(code, user.id);
  if (!b || !["pending", "confirmed"].includes(b.status)) redirect(withError(path, "การจองนี้ยกเลิกไม่ได้"));
  const [{ first }] = await query("SELECT MIN(start_date) AS first FROM booking_items WHERE booking_id = ?", [b.id]);
  if (first && first <= todayStr()) redirect(withError(path, "ยกเลิกได้ถึงก่อนวันเดินทาง 1 วันเท่านั้น"));

  try {
    await cancelBooking(b.id);
  } catch (e) {
    console.error("cancel/refund failed:", e);
    redirect(withError(path, `ยกเลิกไม่สำเร็จ — ${e.message}`));
  }
  revalidatePath(path);
  redirect(withOk(path, "ยกเลิกการจองแล้ว — ส่งอีเมลยืนยันให้แล้ว"));
}
