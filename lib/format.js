export const baht = (n) =>
  "฿" + Number(n ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

export const LABEL_TH = {
  pending: "รอดำเนินการ",
  confirmed: "ยืนยันแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  paid: "ชำระแล้ว",
  failed: "ล้มเหลว",
  refunded: "คืนเงินแล้ว",
  active: "ใช้งาน",
  banned: "ระงับ",
  admin: "แอดมิน",
  customer: "ลูกค้า",
  room: "ห้องพัก",
  flight: "เที่ยวบิน",
  ticket: "ตั๋วงาน",
  theme_park: "สวนสนุก",
  concert: "คอนเสิร์ต",
  exhibition: "นิทรรศการ",
  sport: "กีฬา",
  other: "อื่นๆ",
  economy: "Economy",
  business: "Business",
  first: "First",
  credit_card: "บัตรเครดิต",
  promptpay: "PromptPay",
  bank_transfer: "โอนเงิน",
  paypal: "PayPal",
};

export const label = (v) => LABEL_TH[v] ?? v;

export const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const THAI_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
