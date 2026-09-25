// Config for the generic CRUD pages at /admin/[resource].
// Only tables/columns listed here can be read or written by the admin UI.
//
// Field types: text | textarea | number | money | stars | date | datetime | select | checkbox | ref | password | image
//   select → options: [...]
//   ref    → foreign-key dropdown: ref: { table, label }
//   list: true → shown as a column in the list table

export const resources = {
  hotels: {
    table: "hotels",
    title: "โรงแรม",
    subtitle: "ที่พักทั้งหมดที่เปิดให้จองบนเว็บไซต์",
    search: ["name", "city", "country"],
    fields: [
      { name: "image_url", label: "รูปภาพ (URL)", type: "image", list: true },
      { name: "name", label: "ชื่อโรงแรม", type: "text", required: true, list: true },
      { name: "city", label: "เมือง", type: "text", required: true, list: true },
      { name: "country", label: "ประเทศ", type: "text", required: true, list: true },
      { name: "star_rating", label: "ระดับดาว", type: "stars", required: true, list: true },
      { name: "address", label: "ที่อยู่", type: "text" },
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
      { name: "image_url", label: "รูปภาพ (URL)", type: "image", list: true },
      { name: "hotel_id", label: "โรงแรม", type: "ref", ref: { table: "hotels", label: "name" }, required: true, list: true },
      { name: "name", label: "ประเภทห้อง", type: "text", required: true, list: true },
      { name: "capacity", label: "พักได้ (คน)", type: "number", required: true, list: true },
      { name: "price_per_night", label: "ราคา / คืน", type: "money", required: true, list: true },
      { name: "total_rooms", label: "จำนวนห้อง", type: "number", required: true, list: true },
    ],
  },
  flights: {
    table: "flights",
    title: "เที่ยวบิน",
    subtitle: "ตารางบินและที่นั่งที่เปิดขาย",
    search: ["airline", "flight_no", "origin", "destination"],
    fields: [
      { name: "airline", label: "สายการบิน", type: "text", required: true, list: true },
      { name: "flight_no", label: "เที่ยวบิน", type: "text", required: true, list: true },
      { name: "origin", label: "ต้นทาง", type: "text", required: true, list: true },
      { name: "destination", label: "ปลายทาง", type: "text", required: true, list: true },
      { name: "depart_at", label: "ออกเดินทาง", type: "datetime", required: true, list: true },
      { name: "arrive_at", label: "ถึงปลายทาง", type: "datetime", required: true },
      { name: "seat_class", label: "ชั้นที่นั่ง", type: "select", options: ["economy", "business", "first"], required: true, list: true },
      { name: "price", label: "ราคา", type: "money", required: true, list: true },
      { name: "seats_total", label: "ที่นั่งทั้งหมด", type: "number", required: true },
      { name: "seats_available", label: "ที่นั่งว่าง", type: "number", required: true, list: true },
      { name: "is_active", label: "เปิดขาย", type: "checkbox", list: true },
    ],
  },
  events: {
    table: "events",
    title: "งาน / สวนสนุก",
    subtitle: "Disneyland, Universal Studios, คอนเสิร์ต และงานอื่นๆ",
    search: ["name", "city", "country"],
    fields: [
      { name: "image_url", label: "รูปภาพ (URL)", type: "image", list: true },
      { name: "name", label: "ชื่องาน", type: "text", required: true, list: true },
      { name: "category", label: "หมวด", type: "select", options: ["theme_park", "concert", "exhibition", "sport", "other"], required: true, list: true },
      { name: "city", label: "เมือง", type: "text", required: true, list: true },
      { name: "country", label: "ประเทศ", type: "text", required: true },
      { name: "venue", label: "สถานที่", type: "text" },
      { name: "start_date", label: "เริ่ม", type: "date", required: true, list: true },
      { name: "end_date", label: "สิ้นสุด", type: "date", required: true, list: true },
      { name: "description", label: "รายละเอียด", type: "textarea" },
      { name: "is_active", label: "เปิดขาย", type: "checkbox", list: true },
    ],
  },
  event_tickets: {
    table: "event_tickets",
    title: "ประเภทตั๋ว",
    subtitle: "ราคาและจำนวนตั๋วของแต่ละงาน",
    search: ["name"],
    fields: [
      { name: "event_id", label: "งาน", type: "ref", ref: { table: "events", label: "name" }, required: true, list: true },
      { name: "name", label: "ชื่อตั๋ว", type: "text", required: true, list: true },
      { name: "price", label: "ราคา", type: "money", required: true, list: true },
      { name: "quantity_total", label: "จำนวนทั้งหมด", type: "number", required: true, list: true },
      { name: "quantity_sold", label: "ขายแล้ว", type: "number", required: true, list: true },
    ],
  },
  trip_plans: {
    table: "trip_plans",
    title: "แผนเที่ยว AI",
    subtitle: "แผนการเดินทางที่ AI สร้างให้ลูกค้า",
    search: ["title", "destination"],
    fields: [
      { name: "user_id", label: "ลูกค้า", type: "ref", ref: { table: "users", label: "email" }, required: true, list: true },
      { name: "title", label: "ชื่อแผน", type: "text", required: true, list: true },
      { name: "destination", label: "ปลายทาง", type: "text", required: true, list: true },
      { name: "start_date", label: "เริ่ม", type: "date", list: true },
      { name: "end_date", label: "สิ้นสุด", type: "date" },
      { name: "budget", label: "งบประมาณ", type: "money", list: true },
      { name: "prompt", label: "คำขอของลูกค้า", type: "textarea" },
      { name: "plan", label: "แผนจาก AI", type: "textarea" },
    ],
  },
  customers: {
    table: "users",
    title: "ลูกค้า",
    subtitle: "บัญชีลูกค้าที่สมัครจากหน้าเว็บไซต์",
    search: ["name", "email", "phone"],
    fields: [
      { name: "name", label: "ชื่อ", type: "text", required: true, list: true },
      { name: "email", label: "อีเมล", type: "text", required: true, list: true },
      { name: "phone", label: "เบอร์โทร", type: "text", list: true },
      { name: "status", label: "สถานะ", type: "select", options: ["active", "banned"], required: true, list: true },
      { name: "password_hash", label: "รหัสผ่าน (เว้นว่าง = ไม่เปลี่ยน)", type: "password" },
    ],
  },
  admins: {
    table: "admins",
    title: "ผู้ดูแลระบบ",
    subtitle: "ทีมงานที่เข้าระบบหลังบ้านได้ (แยกจากบัญชีลูกค้า)",
    search: ["name", "email"],
    fields: [
      { name: "name", label: "ชื่อ", type: "text", required: true, list: true },
      { name: "email", label: "อีเมล (ใช้ล็อกอิน)", type: "text", required: true, list: true },
      { name: "status", label: "สถานะ", type: "select", options: ["active", "banned"], required: true, list: true },
      { name: "password_hash", label: "รหัสผ่าน (เว้นว่าง = ไม่เปลี่ยน)", type: "password" },
    ],
  },
};

export function getResource(key) {
  return Object.hasOwn(resources, key) ? resources[key] : undefined;
}
