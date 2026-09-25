import { query } from "./db";

// Revenue = payments with status 'paid', counted in the month they were paid.
// Refunds = payments with status 'refunded'. Bookings are counted by the month they were created.

/** Years that have any booking or payment, newest first (always includes the current year). */
export async function reportYears() {
  const rows = await query(`
    SELECT YEAR(created_at) AS y FROM bookings
    UNION SELECT YEAR(paid_at) FROM payments WHERE paid_at IS NOT NULL`);
  const years = new Set([new Date().getFullYear(), ...rows.map((r) => Number(r.y))]);
  return [...years].sort((a, b) => b - a);
}

/** 12 rows (Jan–Dec) for the given year. */
export async function monthlyReport(year) {
  const [pay, book] = await Promise.all([
    query(
      `SELECT MONTH(paid_at) AS m,
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS revenue,
         SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
         SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END) AS refunded
       FROM payments WHERE paid_at IS NOT NULL AND YEAR(paid_at) = ? GROUP BY m`,
      [year],
    ),
    query(
      `SELECT MONTH(created_at) AS m, COUNT(*) AS bookings,
         SUM(status = 'cancelled') AS cancelled
       FROM bookings WHERE YEAR(created_at) = ? GROUP BY m`,
      [year],
    ),
  ]);

  return Array.from({ length: 12 }, (_, i) => {
    const p = pay.find((r) => r.m === i + 1) ?? {};
    const b = book.find((r) => r.m === i + 1) ?? {};
    return {
      month: i + 1,
      bookings: Number(b.bookings ?? 0),
      cancelled: Number(b.cancelled ?? 0),
      paidCount: Number(p.paid_count ?? 0),
      revenue: Number(p.revenue ?? 0),
      refunded: Number(p.refunded ?? 0),
    };
  });
}

/** Revenue by item type and top-selling items, from paid bookings in the year. */
export async function breakdown(year) {
  const paidBookings = `
    SELECT DISTINCT booking_id FROM payments
    WHERE status = 'paid' AND YEAR(paid_at) = ?`;
  const [byType, top] = await Promise.all([
    query(
      `SELECT item_type, SUM(subtotal) AS revenue, SUM(quantity) AS qty
       FROM booking_items WHERE booking_id IN (${paidBookings})
       GROUP BY item_type ORDER BY revenue DESC`,
      [year],
    ),
    query(
      `SELECT description, item_type, SUM(subtotal) AS revenue, SUM(quantity) AS qty
       FROM booking_items WHERE booking_id IN (${paidBookings})
       GROUP BY description, item_type ORDER BY revenue DESC LIMIT 5`,
      [year],
    ),
  ]);
  return { byType, top };
}

export const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);
