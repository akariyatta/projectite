import { query } from "./db";

// Stock rules
// - A booking "holds" stock while it is pending / confirmed / completed; a cancelled one does not.
// - Flights:  flights.seats_available goes down when held, back up when released.
// - Tickets:  event_tickets.quantity_sold goes up when held, back down when released.
// - Rooms:    no counter — availability is computed from overlapping held bookings per night.

export const HOLDING = ["pending", "confirmed", "completed"];
export const holds = (status) => HOLDING.includes(status);

export class StockError extends Error {}

/**
 * Rooms of type `roomId` still free for EVERY night in [checkIn, checkOut).
 * Pass `q` (a transaction query) to read inside a transaction; `excludeBookingId` to ignore one booking.
 */
export async function roomsFree(roomId, checkIn, checkOut, { q = query, excludeBookingId = 0 } = {}) {
  const [room] = await q("SELECT total_rooms FROM rooms WHERE id = ?", [roomId]);
  if (!room) return 0;
  const busy = await q(
    `SELECT bi.start_date, bi.end_date, bi.quantity FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
     WHERE bi.item_type = 'room' AND bi.item_id = ? AND b.status IN (?) AND b.id <> ?
       AND bi.start_date < ? AND COALESCE(bi.end_date, DATE_ADD(bi.start_date, INTERVAL 1 DAY)) > ?`,
    [roomId, HOLDING, excludeBookingId, checkOut, checkIn],
  );
  let minFree = Number(room.total_rooms);
  for (let d = new Date(`${checkIn}T00:00:00Z`); d < new Date(`${checkOut}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const night = d.toISOString().slice(0, 10);
    const used = busy
      .filter((b) => b.start_date <= night && (b.end_date ?? b.start_date) > night)
      .reduce((s, b) => s + Number(b.quantity), 0);
    minFree = Math.min(minFree, room.total_rooms - used);
  }
  return minFree;
}

/**
 * Take (+1) or give back (-1) the stock of every item in a booking. Must run inside transaction(q).
 * Throws StockError (Thai message) when taking and something is sold out.
 */
export async function moveStock(q, bookingId, direction) {
  const items = await q("SELECT * FROM booking_items WHERE booking_id = ?", [bookingId]);
  for (const it of items) {
    const n = Number(it.quantity);
    if (it.item_type === "flight") {
      if (direction > 0) {
        const res = await q("UPDATE flights SET seats_available = seats_available - ? WHERE id = ? AND seats_available >= ?", [n, it.item_id, n]);
        if (!res.affectedRows) throw new StockError(`ที่นั่งไม่พอ: ${it.description}`);
      } else {
        await q("UPDATE flights SET seats_available = LEAST(seats_total, seats_available + ?) WHERE id = ?", [n, it.item_id]);
      }
    } else if (it.item_type === "ticket") {
      if (direction > 0) {
        const res = await q("UPDATE event_tickets SET quantity_sold = quantity_sold + ? WHERE id = ? AND quantity_total - quantity_sold >= ?", [n, it.item_id, n]);
        if (!res.affectedRows) throw new StockError(`ตั๋วหมด: ${it.description}`);
      } else {
        await q("UPDATE event_tickets SET quantity_sold = GREATEST(0, quantity_sold - ?) WHERE id = ?", [n, it.item_id]);
      }
    } else if (it.item_type === "room" && direction > 0 && it.start_date) {
      const end = it.end_date ?? it.start_date;
      const free = await roomsFree(it.item_id, it.start_date, end > it.start_date ? end : nextDay(it.start_date), { q, excludeBookingId: bookingId });
      if (free < n) throw new StockError(`ห้องเต็มในวันที่เลือก: ${it.description}`);
    }
  }
}

const nextDay = (d) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};

/** Occupancy grid for the availability page: rooms × nights → { total, used }. */
export async function occupancy(from, days) {
  const to = new Date(`${from}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + days);
  const toStr = to.toISOString().slice(0, 10);
  const [rooms, busy] = await Promise.all([
    query(`SELECT r.id, r.name, r.total_rooms, h.name AS hotel, h.city FROM rooms r JOIN hotels h ON h.id = r.hotel_id ORDER BY h.city, h.name, r.name`),
    query(
      `SELECT bi.item_id, bi.start_date, bi.end_date, bi.quantity FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
       WHERE bi.item_type = 'room' AND b.status IN (?) AND bi.start_date < ? AND COALESCE(bi.end_date, bi.start_date) >= ?`,
      [HOLDING, toStr, from],
    ),
  ]);
  const nights = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  return {
    nights,
    rooms: rooms.map((r) => ({
      ...r,
      cells: nights.map((night) => ({
        night,
        total: Number(r.total_rooms),
        used: busy
          .filter((b) => b.item_id === r.id && b.start_date <= night && (b.end_date ?? b.start_date) > night)
          .reduce((s, b) => s + Number(b.quantity), 0),
      })),
    })),
  };
}
