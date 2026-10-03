import { baht, label } from "./format";
import { appUrl } from "./mail";

// HTML email templates (inline styles only — email clients ignore <style> blocks).

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NAVY = "#14213d";
const GOLD = "#c9973b";

function layout(title, body) {
  return `<!doctype html><html lang="th"><body style="margin:0;background:#faf7f0;font-family:'Segoe UI',Tahoma,sans-serif;color:#1b2430">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e3dcc9;border-radius:10px;overflow:hidden">
<tr><td style="background:${NAVY};padding:20px 28px;color:#fff;font-family:Georgia,serif;font-size:20px"><span style="color:${GOLD}">✦</span> Hotel Travel</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 28px;background:#faf7f0;color:#a69b84;font-size:12px;text-align:center">Hotel Travel · อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href, text) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;background:${GOLD};color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">${esc(text)}</a></p>`;

function itemsTable(items, total) {
  const rows = items
    .map((it) => `<tr><td style="padding:8px 0;border-bottom:1px solid #ede7da">${esc(it.description)}<br><span style="color:#7a7266;font-size:12px">${esc(it.start_date ?? "")}${it.end_date ? ` – ${esc(it.end_date)}` : ""} · × ${it.quantity}</span></td><td style="padding:8px 0;border-bottom:1px solid #ede7da;text-align:right;white-space:nowrap">${baht(it.subtotal)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
<tr><td style="padding:12px 0;font-weight:700">ยอดรวม</td><td style="padding:12px 0;text-align:right;font-weight:700;font-size:18px;color:${NAVY}">${baht(total)}</td></tr></table>`;
}

const bookingLink = (code) => `${appUrl()}/bookings/${encodeURIComponent(code)}`;

export const emails = {
  welcome: (user) => ({
    subject: "ยินดีต้อนรับสู่ Hotel Travel",
    html: layout(`ยินดีต้อนรับ คุณ${user.name}`, `<p>บัญชีของคุณพร้อมใช้งานแล้ว เริ่มค้นหาที่พัก เที่ยวบิน ตั๋วงาน หรือให้ระบบช่วยวางแผนเที่ยวได้เลย</p>${button(`${appUrl()}/plans/new`, "เริ่มวางแผนเที่ยว")}`),
  }),

  bookingCreated: (user, booking, items, minutes) => ({
    subject: `รับการจอง ${booking.booking_code} แล้ว — กรุณาชำระเงินภายใน ${minutes} นาที`,
    html: layout("เราได้รับการจองของคุณแล้ว", `<p>สวัสดีคุณ${esc(user.name)} การจอง <strong>${esc(booking.booking_code)}</strong> จะถูกกันไว้ให้ <strong>${minutes} นาที</strong> หากยังไม่ชำระเงินภายในเวลานี้ ระบบจะยกเลิกให้อัตโนมัติ</p>
${itemsTable(items, booking.total_amount)}${button(bookingLink(booking.booking_code), "ชำระเงิน")}`),
  }),

  paymentConfirmed: (user, booking, items) => ({
    subject: `ยืนยันการจอง ${booking.booking_code} — ชำระเงินเรียบร้อย`,
    html: layout("การจองได้รับการยืนยันแล้ว ✓", `<p>สวัสดีคุณ${esc(user.name)} เราได้รับชำระเงินเรียบร้อยแล้ว กรุณาแสดงรหัส <strong>${esc(booking.booking_code)}</strong> ตอนเช็คอินหรือขึ้นเครื่อง</p>
${itemsTable(items, booking.total_amount)}${button(bookingLink(booking.booking_code), "ดูรายละเอียดการจอง")}`),
  }),

  bookingCancelled: (user, booking, refunded) => ({
    subject: `ยกเลิกการจอง ${booking.booking_code} แล้ว`,
    html: layout("ยกเลิกการจองเรียบร้อย", `<p>สวัสดีคุณ${esc(user.name)} การจอง <strong>${esc(booking.booking_code)}</strong> ถูกยกเลิกแล้ว${refunded ? ` และเราได้คืนเงิน <strong>${baht(booking.total_amount)}</strong> ให้คุณ (อาจใช้เวลา 5–10 วันทำการขึ้นอยู่กับธนาคาร)` : ""}</p>${button(bookingLink(booking.booking_code), "ดูการจอง")}`),
  }),

  bookingExpired: (user, booking) => ({
    subject: `การจอง ${booking.booking_code} หมดเวลาชำระเงิน`,
    html: layout("การจองหมดเวลาชำระเงิน", `<p>สวัสดีคุณ${esc(user.name)} การจอง <strong>${esc(booking.booking_code)}</strong> ถูกยกเลิกอัตโนมัติเพราะไม่ได้ชำระเงินภายในเวลาที่กำหนด ห้องพัก ที่นั่ง และตั๋วถูกปล่อยให้ผู้อื่นจองแล้ว</p><p>หากยังต้องการเดินทาง สามารถจองใหม่ได้ทุกเมื่อ</p>${button(`${appUrl()}/hotels`, "จองใหม่")}`),
  }),

  bookingStatusChanged: (user, booking, status) => ({
    subject: `อัปเดตการจอง ${booking.booking_code}: ${label(status)}`,
    html: layout("สถานะการจองมีการเปลี่ยนแปลง", `<p>สวัสดีคุณ${esc(user.name)} การจอง <strong>${esc(booking.booking_code)}</strong> เปลี่ยนสถานะเป็น <strong>${esc(label(status))}</strong></p>${button(bookingLink(booking.booking_code), "ดูการจอง")}`),
  }),

  passwordReset: (user, link, minutes) => ({
    subject: "ตั้งรหัสผ่านใหม่ — Hotel Travel",
    html: layout("ตั้งรหัสผ่านใหม่", `<p>สวัสดีคุณ${esc(user.name)} มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กดปุ่มด้านล่างภายใน <strong>${minutes} นาที</strong></p>${button(link, "ตั้งรหัสผ่านใหม่")}<p style="color:#7a7266;font-size:13px">ถ้าคุณไม่ได้ขอเอง ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>`),
  }),

  passwordChanged: (user) => ({
    subject: "รหัสผ่านของคุณถูกเปลี่ยนแล้ว",
    html: layout("รหัสผ่านถูกเปลี่ยนแล้ว", `<p>สวัสดีคุณ${esc(user.name)} รหัสผ่านบัญชี Hotel Travel ของคุณเพิ่งถูกเปลี่ยน และเครื่องอื่นที่ล็อกอินค้างไว้ถูกออกจากระบบแล้ว</p><p style="color:#7a7266;font-size:13px">ถ้าไม่ใช่คุณ กรุณากด “ลืมรหัสผ่าน” ที่หน้าเข้าสู่ระบบทันที</p>`),
  }),
};
