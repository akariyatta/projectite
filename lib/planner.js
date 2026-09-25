import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { query } from "./db";

// Trip planner: suggests 3 plans (budget / balanced / premium) built ONLY from what we sell.
// Uses Claude when ANTHROPIC_API_KEY is set; otherwise a rule-based planner, so the page always works.

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Flights store airport codes; map them to the cities used by hotels/events.
const AIRPORT_CITY = {
  BKK: "Bangkok", DMK: "Bangkok", CNX: "Chiang Mai", HKT: "Phuket",
  NRT: "Tokyo", HND: "Tokyo", KIX: "Osaka", ITM: "Osaka",
  ICN: "Seoul", GMP: "Seoul", SIN: "Singapore", HKG: "Hong Kong", TPE: "Taipei",
};
export const airportCity = (code) => AIRPORT_CITY[code] ?? code;

const STYLES = [
  { style: "budget", title: "แผนประหยัด" },
  { style: "balanced", title: "แผนสมดุล" },
  { style: "premium", title: "แผนพรีเมียม" },
];

/** Everything bookable, grouped for the planner and the editor's pickers. */
export async function loadCatalog() {
  const [rooms, flights, tickets] = await Promise.all([
    query(`SELECT r.id, r.name, r.capacity, r.price_per_night AS price, h.name AS hotel, h.city, h.star_rating
           FROM rooms r JOIN hotels h ON h.id = r.hotel_id WHERE h.is_active = 1 ORDER BY h.city, r.price_per_night`),
    query(`SELECT id, airline, flight_no, origin, destination, depart_at, arrive_at, seat_class, price, seats_available
           FROM flights WHERE is_active = 1 AND seats_available > 0 ORDER BY depart_at`),
    query(`SELECT t.id, t.name, t.price, t.quantity_total - t.quantity_sold AS left_qty,
                  e.name AS event, e.city, e.start_date, e.end_date, e.category
           FROM event_tickets t JOIN events e ON e.id = t.event_id
           WHERE e.is_active = 1 AND t.quantity_total > t.quantity_sold ORDER BY e.city, t.price`),
  ]);
  const num = (r) => ({ ...r, price: Number(r.price) });
  return {
    hotels: rooms.map((r) => ({ ...num(r), label: `${r.hotel} — ${r.name}` })),
    flights: flights.map((f) => ({
      ...num(f),
      city: airportCity(f.destination),
      label: `${f.flight_no} ${f.origin} → ${f.destination} (${f.seat_class})`,
    })),
    tickets: tickets.map((t) => ({ ...num(t), label: `${t.event} — ${t.name}` })),
    cities: [...new Set([...rooms.map((r) => r.city), ...tickets.map((t) => t.city)])].sort(),
  };
}

function tripDates(start, end) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end || start}T00:00:00Z`);
  while (d <= last && out.length < 14) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// From a list sorted by price: cheapest / middle (rounded up) / most expensive
const pick = (list, style) =>
  !list.length ? null : style === "budget" ? list[0] : style === "premium" ? list.at(-1) : list[Math.ceil((list.length - 1) / 2)];

/** Rule-based planner — no AI needed. */
function rulePlans(req, cat) {
  const dates = tripDates(req.start_date, req.end_date);
  const nights = Math.max(1, dates.length - 1);
  const n = req.travelers;

  return STYLES.map(({ style, title }) => {
    // Flights to the destination leaving within a day of the trip start (else the nearest date)
    const daysOff = (f) => Math.abs(new Date(f.depart_at.slice(0, 10)) - new Date(req.start_date)) / 864e5;
    const toCity = cat.flights.filter((f) => f.city === req.destination && f.seats_available >= n);
    const near = toCity.filter((f) => daysOff(f) <= 1);
    const pool = (near.length ? near : toCity).sort((a, b) => daysOff(a) - daysOff(b) || a.price - b.price);
    const economy = pool.filter((f) => f.seat_class === "economy").sort((a, b) => a.price - b.price);
    const flight = {
      budget: economy[0],                                               // cheapest seat
      balanced: economy.at(-1),                                         // best-timed full-service economy
      premium: pool.find((f) => f.seat_class !== "economy") ?? economy.at(-1),
    }[style] ?? pool[0];

    const rooms = cat.hotels.filter((h) => h.city === req.destination).sort((a, b) => a.price - b.price);
    const room = pick(rooms, style);
    const roomsNeeded = room ? Math.ceil(n / room.capacity) : 0;

    const events = cat.tickets
      .filter((t) => t.city === req.destination && t.left_qty >= n)
      .filter((t) => dates.some((d) => d >= t.start_date && d <= t.end_date));
    // one ticket type per event (cheapest), then limit by style
    const perEvent = [...new Map(events.map((t) => [t.event, t])).values()];
    const eventLimit = { budget: 1, balanced: 2, premium: 99 }[style];
    const chosen = perEvent.slice(0, eventLimit);

    const days = dates.map((date, i) => ({ day: i + 1, date, title: "", items: [] }));
    const first = days[0];
    first.title = `เดินทางถึง ${req.destination}`;
    if (flight) {
      first.items.push({
        time: flight.depart_at.slice(11, 16), type: "flight", ref_id: flight.id, title: flight.label,
        note: flight.depart_at.slice(0, 10) !== req.start_date ? `บินวันที่ ${flight.depart_at.slice(0, 10)}` : `ถึง ${flight.arrive_at.slice(11, 16)}`,
        cost: flight.price * n,
      });
    } else {
      first.items.push({ time: "", type: "transport", ref_id: null, title: `ยังไม่มีเที่ยวบินไป ${req.destination} ในระบบ`, note: "", cost: 0 });
    }
    if (room) {
      first.items.push({
        time: "15:00", type: "hotel", ref_id: room.id, title: room.label,
        note: `${nights} คืน · ${roomsNeeded} ห้อง`, cost: room.price * nights * roomsNeeded,
      });
    }

    const middle = days.slice(1, Math.max(1, days.length - 1));
    chosen.forEach((t, i) => {
      const day = middle[i] ?? days.at(-1);
      day.title ||= t.event;
      day.items.push({ time: "09:00", type: "event", ref_id: t.id, title: t.label, note: "", cost: t.price * n });
    });
    for (const day of days.slice(1, -1)) {
      if (!day.items.length) {
        day.title ||= "เที่ยวอิสระในเมือง";
        day.items.push({ time: "10:00", type: "activity", ref_id: null, title: `เดินเล่นย่านใจกลาง ${req.destination}`, note: "", cost: 0 });
        day.items.push({ time: "18:30", type: "food", ref_id: null, title: "มื้อเย็นร้านอาหารท้องถิ่น", note: "", cost: 0 });
      }
    }
    if (days.length > 1) {
      const last = days.at(-1);
      last.title ||= "ช้อปปิ้งและเดินทางกลับ";
      if (!last.items.length) last.items.push({ time: "09:00", type: "food", ref_id: null, title: "อาหารเช้าและซื้อของฝาก", note: "", cost: 0 });
      last.items.push({ time: "11:00", type: "hotel", ref_id: null, title: "เช็คเอาท์และเดินทางกลับ", note: "", cost: 0 });
    }

    const estimated_cost = days.flatMap((d) => d.items).reduce((s, it) => s + it.cost, 0);
    const over = req.budget && estimated_cost > req.budget;
    return {
      style,
      title: `${title} · ${req.destination} ${dates.length} วัน`,
      summary: [
        flight ? `บิน ${flight.airline}` : "ยังไม่มีเที่ยวบิน",
        room ? `พัก ${room.hotel}` : "ยังไม่มีโรงแรมในเมืองนี้",
        chosen.length ? `เที่ยว ${chosen.map((t) => t.event).join(", ")}` : null,
        over ? `⚠ เกินงบ ${Math.round(estimated_cost - req.budget).toLocaleString()} บาท` : null,
      ].filter(Boolean).join(" · "),
      estimated_cost,
      days,
    };
  });
}

// ---------- Claude ----------

const ItemSchema = z.object({
  time: z.string().describe("HH:MM หรือว่าง"),
  type: z.enum(["flight", "hotel", "event", "activity", "food", "transport"]),
  ref_id: z.number().int().nullable().describe("id จาก catalog เมื่อ type เป็น flight/hotel/event, นอกนั้น null"),
  title: z.string(),
  note: z.string(),
});
const PlansSchema = z.object({
  options: z.array(
    z.object({
      style: z.enum(["budget", "balanced", "premium"]),
      title: z.string(),
      summary: z.string(),
      days: z.array(z.object({ day: z.number().int(), date: z.string(), title: z.string(), items: z.array(ItemSchema) })),
    }),
  ),
});

const SYSTEM = `คุณคือผู้ช่วยวางแผนเที่ยวของเว็บจองโรงแรม Hotel Travel
ตอบเป็นภาษาไทย เสนอ 3 แผน: budget (ประหยัด), balanced (สมดุล), premium (พรีเมียม) อย่างละ 1 แผน
กฎ:
- เที่ยวบิน (type "flight"), ห้องพัก (type "hotel") และตั๋วงาน (type "event") ต้องเลือกจาก catalog ที่ให้เท่านั้น และใส่ ref_id ให้ตรง id ใน catalog
- ถ้า catalog ไม่มีสิ่งที่ต้องการ ให้ใส่เป็น activity/food/transport แบบ ref_id = null แทน ห้ามแต่งเที่ยวบินหรือโรงแรมขึ้นเอง
- ห้องพักใส่ครั้งเดียวในวันแรก (ระบบคำนวณราคาทุกคืนให้เอง) และใส่เช็คเอาท์ในวันสุดท้าย
- พยายามให้ไม่เกินงบของลูกค้า และทำตามคำขอพิเศษของลูกค้า
- ไม่ต้องใส่ราคา ระบบคำนวณจาก catalog เอง`;

async function aiPlans(req, cat) {
  const catalog = {
    flights_to_destination: cat.flights.filter((f) => f.city === req.destination)
      .map(({ id, label, depart_at, arrive_at, price, seats_available }) => ({ id, label, depart_at, arrive_at, price, seats_available })),
    rooms: cat.hotels.filter((h) => h.city === req.destination)
      .map(({ id, label, capacity, price, star_rating }) => ({ id, label, capacity, price_per_night: price, star_rating })),
    event_tickets: cat.tickets.filter((t) => t.city === req.destination)
      .map(({ id, label, price, start_date, end_date, left_qty }) => ({ id, label, price, start_date, end_date, left_qty })),
  };

  const client = new Anthropic({ timeout: 120_000 });
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(PlansSchema) },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `คำขอของลูกค้า:
${JSON.stringify({ ...req, dates: tripDates(req.start_date, req.end_date) }, null, 2)}

catalog (สิ่งที่มีขายจริงในระบบ):
${JSON.stringify(catalog, null, 2)}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("AI ไม่ได้ส่งแผนกลับมา");

  // Never trust ids or prices from the model: keep only real catalog items and price them ourselves.
  const nights = Math.max(1, tripDates(req.start_date, req.end_date).length - 1);
  const byType = {
    flight: new Map(catalog.flights_to_destination.map((f) => [f.id, f])),
    hotel: new Map(catalog.rooms.map((r) => [r.id, r])),
    event: new Map(catalog.event_tickets.map((t) => [t.id, t])),
  };
  return response.parsed_output.options.slice(0, 3).map((opt) => {
    const days = opt.days.map((d) => ({
      ...d,
      items: d.items.map((it) => {
        const ref = byType[it.type]?.get(it.ref_id);
        if (!ref) return { ...it, ref_id: null, cost: 0, type: byType[it.type] ? "activity" : it.type };
        const cost = it.type === "hotel"
          ? ref.price_per_night * nights * Math.ceil(req.travelers / ref.capacity)
          : ref.price * req.travelers;
        return { ...it, title: ref.label, cost };
      }),
    }));
    return { ...opt, days, estimated_cost: days.flatMap((d) => d.items).reduce((s, it) => s + it.cost, 0) };
  });
}

/** Returns { engine: "ai" | "rules", notice?, options: [3 plans] } */
export async function suggestPlans(req) {
  const cat = await loadCatalog();
  if (aiEnabled()) {
    try {
      return { engine: "ai", options: await aiPlans(req, cat) };
    } catch (e) {
      console.error("AI planner failed, using rules:", e);
      return { engine: "rules", notice: "AI ไม่พร้อมใช้งานตอนนี้ จึงใช้การจัดแผนอัตโนมัติแทน", options: rulePlans(req, cat) };
    }
  }
  return { engine: "rules", options: rulePlans(req, cat) };
}
