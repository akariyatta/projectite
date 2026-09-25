// Config for the generic CRUD pages at /admin/[resource].
// Only tables/columns listed here can be read or written by the admin UI.
//
// Field types: text | email | textarea | number | money | stars | date | datetime | select | checkbox | ref | password | image
//   select → options: [...]
//   ref    → foreign-key dropdown: ref: { table, label }
//   list: true → shown as a column in the list table
//   min / max / maxLength / minLength / pattern → checked in the browser AND on the server
//   hint / placeholder / suffix → UI helpers; upper: true → saved in UPPERCASE
//
// display(row) → name shown in titles/messages (default: name or title)
// validate(data) → { column: "ข้อความ error" } for rules that involve more than one column.

const AIRPORT = { minLength: 3, maxLength: 3, pattern: "[A-Za-z]{3}", upper: true, placeholder: "BKK", title: "รหัสสนามบิน 3 ตัวอักษร เช่น BKK" };

export const resources = {
  hotels: {
    table: "hotels",
    title: "โรงแรม",
    subtitle: "ที่พักทั้งหมดที่เปิดให้จองบนเว็บไซต์",
    search: ["name", "city", "country"],
    fields: [
      { name: "image_url", label: "รูปภาพ (URL)", type: "image", maxLength: 500, list: true },
      { name: "name", label: "ชื่อโรงแรม", type: "text", required: true, maxLength: 150, list: true },
      { name: "city", label: "เมือง", type: "text", required: true, maxLength: 100, list: true },
      { name: "country", label: "ประเทศ", type: "text", required: true, maxLength: 100, list: true },
      { name: "star_rating", label: "ระดับดาว", type: "stars", required: true, min: 1, max: 5, list: true },
      { name: "address", label: "ที่อยู่", type: "text", maxLength: 255 },
      { name: "description", label: "รายละเอียด", type: "textarea" },
      { name: "is_active", label: "เปิดให้จอง", type: "checkbox", list: true },
    ],
  },
  rooms: {
    table: "rooms",
    title: "ห้องพัก",
    subtitle: "ประเภทห้องและราคาต่อคืนของแต่ละโรงแรม",
    search: ["name"],
    fields: [
      { name: "image_url", label: "รูปภาพ (URL)", type: "image", maxLength: 500, list: true },
      { name: "hotel_id", label: "โรงแรม", type: "ref", ref: { table: "hotels", label: "name" }, required: true, list: true },
      { name: "name", label: "ประเภทห้อง", type: "text", required: true, maxLength: 100, placeholder: "เช่น Deluxe Double", list: true },
      { name: "capacity", label: "พักได้", type: "number", required: true, min: 1, max: 20, suffix: "คน", list: true },
      { name: "price_per_night", label: "ราคา / คืน", type: "money", required: true, min: 0, suffix: "บาท", list: true },
      { name: "total_rooms", label: "จำนวนห้อง", type: "number", required: true, min: 1, suffix: "ห้อง", list: true },
    ],
  },
  flights: {
    table: "flights",
    title: "เที่ยวบิน",
    subtitle: "ตารางบินและที่นั่งที่เปิดขาย",
    search: ["airline", "flight_no", "origin", "destination"],
    fields: [
      { name: "airline", label: "สายการบิน", type: "text", required: true, maxLength: 100, placeholder: "เช่น Thai Airways", list: true },
      { name: "flight_no", label: "เที่ยวบิน", type: "text", required: true, maxLength: 20, upper: true, placeholder: "เช่น TG640", list: true },
      { name: "origin", label: "ต้นทาง", type: "text", required: true, ...AIRPORT, list: true },
      { name: "destination", label: "ปลายทาง", type: "text", required: true, ...AIRPORT, placeholder: "NRT", list: true },
      { name: "depart_at", label: "ออกเดินทาง", type: "datetime", required: true, list: true },
      { name: "arrive_at", label: "ถึงปลายทาง", type: "datetime", required: true },
      { name: "seat_class", label: "ชั้นที่นั่ง", type: "select", options: ["economy", "business", "first"], required: true, list: true },
      { name: "price", label: "ราคา", type: "money", required: true, min: 0, suffix: "บาท", list: true },
      { name: "seats_total", label: "ที่นั่งทั้งหมด", type: "number", required: true, min: 1, suffix: "ที่" },
      { name: "seats_available", label: "ที่นั่งว่าง", type: "number", required: true, min: 0, suffix: "ที่", list: true },
      { name: "is_active", label: "เปิดขาย", type: "checkbox", list: true },
    ],
    display: (r) => `${r.flight_no} ${r.origin} → ${r.destination}`,
    validate: (d) => ({
      ...(d.arrive_at && d.depart_at && d.arrive_at <= d.depart_at && { arrive_at: "เวลาถึงต้องหลังเวลาออกเดินทาง" }),
      ...(d.seats_available > d.seats_total && { seats_available: "ที่นั่งว่างต้องไม่เกินที่นั่งทั้งหมด" }),
      ...(d.origin && d.origin === d.destination && { destination: "ปลายทางต้องไม่ซ้ำกับต้นทาง" }),
    }),
  },
  events: {
    table: "events",
    title: "งาน / สวนสนุก",
    subtitle: "Disneyland, Universal Studios, คอนเสิร์ต และงานอื่นๆ",
    search: ["name", "city", "country"],
    fields: [
      { name: "image_url", label: "รูปภาพ (URL)", type: "image", maxLength: 500, list: true },
      { name: "name", label: "ชื่องาน", type: "text", required: true, maxLength: 150, list: true },
      { name: "category", label: "หมวด", type: "select", options: ["theme_park", "concert", "exhibition", "sport", "other"], required: true, list: true },
      { name: "city", label: "เมือง", type: "text", required: true, maxLength: 100, list: true },
      { name: "country", label: "ประเทศ", type: "text", required: true, maxLength: 100 },
      { name: "venue", label: "สถานที่", type: "text", maxLength: 150 },
      { name: "start_date", label: "เริ่ม", type: "date", required: true, list: true },
      { name: "end_date", label: "สิ้นสุด", type: "date", required: true, list: true },
      { name: "description", label: "รายละเอียด", type: "textarea" },
      { name: "is_active", label: "เปิดขาย", type: "checkbox", list: true },
    ],
    validate: (d) => (d.start_date && d.end_date && d.end_date < d.start_date ? { end_date: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" } : {}),
  },
  event_tickets: {
    table: "event_tickets",
    title: "ประเภทตั๋ว",
    subtitle: "ราคาและจำนวนตั๋วของแต่ละงาน",
    search: ["name"],
    fields: [
      { name: "event_id", label: "งาน", type: "ref", ref: { table: "events", label: "name" }, required: true, list: true },
      { name: "name", label: "ชื่อตั๋ว", type: "text", required: true, maxLength: 100, placeholder: "เช่น ผู้ใหญ่ (18+)", list: true },
      { name: "price", label: "ราคา", type: "money", required: true, min: 0, suffix: "บาท", list: true },
      { name: "quantity_total", label: "จำนวนทั้งหมด", type: "number", required: true, min: 1, suffix: "ใบ", list: true },
      { name: "quantity_sold", label: "ขายแล้ว", type: "number", required: true, min: 0, suffix: "ใบ", list: true },
    ],
    validate: (d) => (d.quantity_sold > d.quantity_total ? { quantity_sold: "จำนวนที่ขายแล้วต้องไม่เกินจำนวนทั้งหมด" } : {}),
  },
  trip_plans: {
    table: "trip_plans",
    title: "แผนเที่ยว AI",
    subtitle: "แผนการเดินทางที่ AI สร้างให้ลูกค้า",
    search: ["title", "destination"],
    fields: [
      { name: "user_id", label: "ลูกค้า", type: "ref", ref: { table: "users", label: "email" }, required: true, list: true },
      { name: "title", label: "ชื่อแผน", type: "text", required: true, maxLength: 150, list: true },
      { name: "destination", label: "ปลายทาง", type: "text", required: true, maxLength: 150, list: true },
      { name: "start_date", label: "เริ่ม", type: "date", list: true },
      { name: "end_date", label: "สิ้นสุด", type: "date" },
      { name: "budget", label: "งบประมาณ", type: "money", min: 0, suffix: "บาท", list: true },
      { name: "prompt", label: "คำขอของลูกค้า", type: "textarea" },
      { name: "plan", label: "แผนจาก AI", type: "textarea" },
    ],
    validate: (d) => (d.start_date && d.end_date && d.end_date < d.start_date ? { end_date: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" } : {}),
  },
  customers: {
    table: "users",
    title: "ลูกค้า",
    subtitle: "บัญชีลูกค้าที่สมัครจากหน้าเว็บไซต์",
    search: ["name", "email", "phone"],
    fields: [
      { name: "name", label: "ชื่อ", type: "text", required: true, maxLength: 100, list: true },
      { name: "email", label: "อีเมล", type: "email", required: true, maxLength: 150, list: true },
      { name: "phone", label: "เบอร์โทร", type: "text", maxLength: 30, pattern: "[0-9+\\-\\s]{9,30}", title: "ตัวเลข 9–10 หลัก เช่น 0812345678", placeholder: "0812345678", list: true },
      { name: "status", label: "สถานะ", type: "select", options: ["active", "banned"], required: true, list: true },
      { name: "password_hash", label: "รหัสผ่าน", type: "password", minLength: 8 },
    ],
  },
  admins: {
    table: "admins",
    title: "ผู้ดูแลระบบ",
    subtitle: "ทีมงานที่เข้าระบบหลังบ้านได้ (แยกจากบัญชีลูกค้า)",
    search: ["name", "email"],
    fields: [
      { name: "name", label: "ชื่อ", type: "text", required: true, maxLength: 100, list: true },
      { name: "email", label: "อีเมล (ใช้ล็อกอิน)", type: "email", required: true, maxLength: 150, list: true },
      { name: "status", label: "สถานะ", type: "select", options: ["active", "banned"], required: true, list: true },
      { name: "password_hash", label: "รหัสผ่าน", type: "password", minLength: 8 },
    ],
  },
};

export function getResource(key) {
  return Object.hasOwn(resources, key) ? resources[key] : undefined;
}

/** Human-readable name of a row, for titles and messages. */
export const displayName = (res, row) => res.display?.(row) ?? row.name ?? row.title ?? `#${row.id}`;

/** Label without the "(…)" note, for use inside error messages. */
export const shortLabel = (f) => f.label.replace(/\s*\(.*\)$/, "");
