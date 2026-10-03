import { query } from "./db";
import { roomsFree } from "./inventory";
import { airportCity } from "./airports";
import { CITY_TH } from "./format";
import { cityPhoto, CITY_PHOTOS, TYPE_PHOTOS } from "./images";

// Read-only queries for the public site. Only active items are shown.

// Thai / alternative names customers type → the city names stored in the database
const CITY_ALIASES = {
  กรุงเทพ: "Bangkok", กรุงเทพฯ: "Bangkok", กรุงเทพมหานคร: "Bangkok", bkk: "Bangkok",
  โตเกียว: "Tokyo", tyo: "Tokyo",
  โอซาก้า: "Osaka", osa: "Osaka",
  เชียงใหม่: "Chiang Mai", chiangmai: "Chiang Mai", ภูเก็ต: "Phuket", กระบี่: "Krabi", อ่าวนาง: "Krabi",
  พัทยา: "Pattaya", ชลบุรี: "Pattaya", เกียวโต: "Kyoto", โซล: "Seoul", เกาหลี: "Seoul",
  สิงคโปร์: "Singapore", ฮ่องกง: "Hong Kong", hongkong: "Hong Kong", hk: "Hong Kong", ไทเป: "Taipei", ไต้หวัน: "Taipei",
};
export { CITY_TH };

export function normalizeCity(text) {
  const t = String(text ?? "").trim();
  if (!t) return "";
  const alias = CITY_ALIASES[t] ?? CITY_ALIASES[t.toLowerCase()];
  if (alias) return alias;
  const code = t.toUpperCase();
  return airportCity(code) !== code ? airportCity(code) : t; // "NRT" → Tokyo; anything else as typed (SQL match is case-insensitive)
}

export const todayStr = () => new Date().toISOString().slice(0, 10);
export const addDaysStr = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Clean check-in/out from the URL: defaults to tomorrow → +1 night, max 30 nights. */
export function stayDates(checkIn, checkOut) {
  const tomorrow = addDaysStr(todayStr(), 1);
  const ci = DATE_RE.test(checkIn ?? "") && checkIn >= todayStr() ? checkIn : tomorrow;
  let co = DATE_RE.test(checkOut ?? "") && checkOut > ci ? checkOut : addDaysStr(ci, 1);
  if (nightsBetween(ci, co) > 30) co = addDaysStr(ci, 30);
  return { checkIn: ci, checkOut: co, nights: nightsBetween(ci, co) };
}

/** Cities that have something to book, with a cover photo and counts — for the home page. */
export async function popularCities() {
  const rows = await query(`
    SELECT city,
           MAX(image_url) AS image_url,
           SUM(kind = 'hotel') AS hotels,
           SUM(kind = 'event') AS events
    FROM (
      SELECT city, image_url, 'hotel' AS kind FROM hotels WHERE is_active = 1
      UNION ALL SELECT city, image_url, 'event' FROM events WHERE is_active = 1 AND end_date >= CURDATE()
    ) x GROUP BY city ORDER BY hotels DESC, city`);
  return rows.map((r) => ({
    ...r,
    image_url: CITY_PHOTOS[r.city] ?? r.image_url, // a real city photo beats a hotel photo for a destination card
    hotels: Number(r.hotels),
    events: Number(r.events),
    th: CITY_TH[r.city] ?? r.city,
  }));
}

/** Hotels for the home page: the best-rated ones with their cheapest room price. */
export async function featuredHotels(limit = 8) {
  const rows = await query(
    `SELECT h.id, h.name, h.city, h.country, h.star_rating, h.image_url, h.description, MIN(r.price_per_night) AS from_price
     FROM hotels h JOIN rooms r ON r.hotel_id = h.id
     WHERE h.is_active = 1 GROUP BY h.id ORDER BY h.star_rating DESC, h.id DESC LIMIT ?`,
    [limit],
  );
  return rows.map((h) => ({ ...h, from_price: Number(h.from_price), th: CITY_TH[h.city] ?? h.city }));
}

/** Hotels in a city (or everywhere) with the cheapest room that still has space for the stay. */
export async function searchHotels({ city, checkIn, checkOut, guests, rooms: roomCount, stars, sort }) {
  const where = ["h.is_active = 1"];
  const args = [];
  if (city) { where.push("(h.city = ? OR h.name LIKE ?)"); args.push(city, `%${city}%`); }
  if (stars) { where.push("h.star_rating >= ?"); args.push(Number(stars)); }
  const rows = await query(
    `SELECT h.id AS hotel_id, h.name AS hotel, h.city, h.country, h.address, h.description, h.star_rating, h.image_url AS hotel_image,
            r.id AS room_id, r.name AS room, r.capacity, r.price_per_night, r.total_rooms, r.image_url AS room_image
     FROM hotels h JOIN rooms r ON r.hotel_id = h.id WHERE ${where.join(" AND ")} ORDER BY h.id, r.price_per_night`,
    args,
  );
  const perRoomGuests = Math.ceil(guests / Math.max(1, roomCount));
  const hotels = new Map();
  for (const r of rows) {
    const h = hotels.get(r.hotel_id) ?? {
      id: r.hotel_id, name: r.hotel, city: r.city, country: r.country, address: r.address,
      description: r.description, star_rating: r.star_rating, image_url: r.hotel_image, rooms: [],
    };
    hotels.set(r.hotel_id, h);
    const free = await roomsFree(r.room_id, checkIn, checkOut);
    h.rooms.push({ id: r.room_id, name: r.room, capacity: r.capacity, price: Number(r.price_per_night), free, fits: r.capacity >= perRoomGuests && free >= roomCount });
  }
  const list = [...hotels.values()].map((h) => {
    const fitting = h.rooms.filter((r) => r.fits);
    return { ...h, fromPrice: fitting.length ? Math.min(...fitting.map((r) => r.price)) : null, available: fitting.length > 0 };
  });
  const sorters = {
    price: (a, b) => (a.fromPrice ?? Infinity) - (b.fromPrice ?? Infinity),
    stars: (a, b) => b.star_rating - a.star_rating,
  };
  return list.sort((a, b) => b.available - a.available || (sorters[sort] ?? sorters.price)(a, b));
}

export async function getHotel(id, { checkIn, checkOut }) {
  const [hotel] = await query("SELECT * FROM hotels WHERE id = ? AND is_active = 1", [Number(id)]);
  if (!hotel) return null;
  const rooms = await query("SELECT * FROM rooms WHERE hotel_id = ? ORDER BY price_per_night", [hotel.id]);
  for (const r of rooms) {
    r.price = Number(r.price_per_night);
    r.free = await roomsFree(r.id, checkIn, checkOut);
  }
  return { ...hotel, rooms };
}

/** Flights into `to` (city or airport), optionally from `from`, around `date` (±3 days). */
export async function searchFlights({ from, to, date, passengers }) {
  const all = await query(
    `SELECT * FROM flights WHERE is_active = 1 AND depart_at > NOW() AND seats_available >= ? ORDER BY depart_at`,
    [passengers],
  );
  const matches = (code, want) => !want || code === want.toUpperCase() || airportCity(code).toLowerCase() === want.toLowerCase();
  return all
    .filter((f) => matches(f.destination, to) && matches(f.origin, from))
    .map((f) => ({
      ...f,
      price: Number(f.price),
      fromCity: airportCity(f.origin),
      toCity: airportCity(f.destination),
      daysOff: date ? Math.round((new Date(f.depart_at.slice(0, 10)) - new Date(date)) / 864e5) : 0,
    }))
    .filter((f) => !date || Math.abs(f.daysOff) <= 3)
    .sort((a, b) => Math.abs(a.daysOff) - Math.abs(b.daysOff) || a.price - b.price);
}

/**
 * Photo for each booking item → Map keyed by "type:item_id".
 * Rooms: room photo or hotel photo · tickets: event photo · flights: destination city photo.
 */
export async function itemImages(items) {
  const ids = (type) => [...new Set(items.filter((i) => i.item_type === type).map((i) => i.item_id))];
  const [rooms, tickets, flights] = await Promise.all([
    ids("room").length ? query("SELECT r.id, COALESCE(r.image_url, h.image_url) AS img FROM rooms r JOIN hotels h ON h.id = r.hotel_id WHERE r.id IN (?)", [ids("room")]) : [],
    ids("ticket").length ? query("SELECT t.id, e.image_url AS img FROM event_tickets t JOIN events e ON e.id = t.event_id WHERE t.id IN (?)", [ids("ticket")]) : [],
    ids("flight").length ? query("SELECT id, destination FROM flights WHERE id IN (?)", [ids("flight")]) : [],
  ]);
  const map = new Map();
  for (const r of rooms) map.set(`room:${r.id}`, r.img ?? TYPE_PHOTOS.hotel);
  for (const t of tickets) map.set(`ticket:${t.id}`, t.img ?? TYPE_PHOTOS.event);
  for (const f of flights) map.set(`flight:${f.id}`, cityPhoto(airportCity(f.destination)));
  return map;
}

/** Events (with their ticket types) in a city / category, still running on/after `date`. */
export async function searchEvents({ city, category, date }) {
  const args = [date ?? todayStr()];
  let where = "e.is_active = 1 AND e.end_date >= ?";
  if (city) { where += " AND e.city = ?"; args.push(city); }
  if (category) { where += " AND e.category = ?"; args.push(category); }
  const rows = await query(
    `SELECT e.*, t.id AS ticket_id, t.name AS ticket, t.price, t.quantity_total - t.quantity_sold AS left_qty
     FROM events e JOIN event_tickets t ON t.event_id = e.id WHERE ${where} ORDER BY e.start_date, t.price`,
    args,
  );
  const events = new Map();
  for (const r of rows) {
    const e = events.get(r.id) ?? { id: r.id, name: r.name, category: r.category, city: r.city, country: r.country, venue: r.venue, description: r.description, image_url: r.image_url, start_date: r.start_date, end_date: r.end_date, tickets: [] };
    events.set(r.id, e);
    e.tickets.push({ id: r.ticket_id, name: r.ticket, price: Number(r.price), left: Number(r.left_qty) });
  }
  return [...events.values()];
}
