"use client";

import { useRouter } from "next/navigation";
import TripPlanner from "@/components/planner/TripPlanner";
import { saveMyTrip, suggestMyTrip } from "@/lib/site-actions";
import { useCart } from "./cart";

const nextDay = (d) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};
const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

/** Turn the plan's bookable items (flight / hotel / event with a catalog id) into cart items. */
function planToCart(plan, meta, catalog) {
  const travelers = Math.max(1, Number(meta.travelers) || 1);
  const items = [];
  for (const day of plan.days) {
    const date = day.date || meta.start_date;
    for (const it of day.items) {
      if (it.ref_id == null) continue;
      if (it.type === "flight") {
        const f = catalog.flights.find((x) => x.id === it.ref_id);
        if (f) items.push({ type: "flight", ref: f.id, flight_id: f.id, label: f.label, sub: f.depart_at.slice(0, 16), unitPrice: f.price, qty: travelers, image: catalog.photos?.cities[f.city] ?? f.image });
      } else if (it.type === "hotel") {
        const r = catalog.hotels.find((x) => x.id === it.ref_id);
        if (!r) continue;
        const checkOut = meta.end_date > date ? meta.end_date : nextDay(date);
        const nights = nightsBetween(date, checkOut);
        items.push({
          type: "room", ref: r.id, room_id: r.id, check_in: date, check_out: checkOut,
          label: r.label, sub: `${date} – ${checkOut} · ${nights} คืน`, unitPrice: r.price * nights, qty: Math.ceil(travelers / r.capacity), image: r.image,
        });
      } else if (it.type === "event") {
        const t = catalog.tickets.find((x) => x.id === it.ref_id);
        if (!t) continue;
        const d = date < t.start_date ? t.start_date : date > t.end_date ? t.end_date : date;
        items.push({ type: "ticket", ref: t.id, ticket_id: t.id, date: d, label: t.label, sub: t.city, unitPrice: t.price, qty: travelers, image: t.image });
      }
    }
  }
  return items;
}

export default function PlanClient({ id, initial, catalog, aiEnabled }) {
  const router = useRouter();
  const cart = useCart();

  return (
    <TripPlanner
      id={id}
      initial={initial}
      catalog={catalog}
      aiEnabled={aiEnabled}
      suggestAction={suggestMyTrip}
      saveAction={saveMyTrip}
      saveLabel="บันทึกแผน"
      renderExtra={(plan, meta) => {
        const items = planToCart(plan, meta, catalog);
        return (
          <button
            type="button"
            className="tp-btn tp-btn-gold"
            disabled={!items.length}
            title={items.length ? "" : "เพิ่มเที่ยวบิน ที่พัก หรือตั๋วงานในแผนก่อน"}
            onClick={() => {
              items.forEach((item) => cart.add(item));
              router.push("/cart");
            }}
          >
            🧳 เพิ่มทั้งแผนลงตะกร้า ({items.length})
          </button>
        );
      }}
    />
  );
}
