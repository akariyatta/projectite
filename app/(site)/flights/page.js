import AddToCart from "@/components/site/AddToCart";
import { addDaysStr, normalizeCity, popularCities, searchFlights, todayStr } from "@/lib/catalog";
import { baht } from "@/lib/format";
import { cityPhoto, sized } from "@/lib/images";

export const metadata = { title: "ค้นหาเที่ยวบิน · Hotel Travel" };

const CLASS_TH = { economy: "ชั้นประหยัด", business: "ชั้นธุรกิจ", first: "ชั้นหนึ่ง" };
const thaiDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
function duration(a, b) {
  const m = Math.round((new Date(b.replace(" ", "T")) - new Date(a.replace(" ", "T"))) / 60000);
  return `${Math.floor(m / 60)} ชม. ${m % 60 ? `${m % 60} นาที` : ""}`;
}

export default async function Flights({ searchParams }) {
  const sp = await searchParams;
  const from = normalizeCity(sp.from);
  const to = normalizeCity(sp.to);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") && sp.date >= todayStr() ? sp.date : "";
  const passengers = Math.min(10, Math.max(1, Number(sp.passengers) || 1));
  const [flights, cities] = await Promise.all([searchFlights({ from, to, date, passengers }), popularCities()]);

  return (
    <>
      <div className="st-pagehead">
        <div className="st-wrap">
          <div className="st-eyebrow">Flights</div>
          <h1>{from || to ? `เที่ยวบิน ${from || "ทุกที่"} → ${to || "ทุกที่"}` : "เที่ยวบินทั้งหมด"}</h1>
          <div>{date ? `${thaiDate(date)} (±3 วัน)` : "ทุกวันที่เปิดขาย"} · ผู้โดยสาร {passengers} คน</div>
        </div>
      </div>

      <div className="st-wrap st-pull st-stack">
        <form className="st-card st-filter" action="/flights" style={{ gridTemplateColumns: "1fr 1fr 1fr 120px auto" }}>
          <label className="st-field"><span>ต้นทาง</span><input name="from" defaultValue={sp.from ?? ""} list="city-list" placeholder="เช่น Bangkok / BKK" className="st-input" /></label>
          <label className="st-field"><span>ปลายทาง</span><input name="to" defaultValue={sp.to ?? ""} list="city-list" placeholder="เช่น Tokyo" className="st-input" /></label>
          <datalist id="city-list">{cities.map((c) => <option key={c.city} value={c.city}>{c.th}</option>)}</datalist>
          <label className="st-field"><span>วันเดินทาง</span><input type="date" name="date" min={todayStr()} defaultValue={date || addDaysStr(todayStr(), 7)} className="st-input" /></label>
          <label className="st-field"><span>ผู้โดยสาร</span><input type="number" name="passengers" min="1" max="10" defaultValue={passengers} className="st-input" /></label>
          <button className="st-btn">ค้นหา</button>
        </form>

        <span className="st-muted">พบ {flights.length} เที่ยวบิน{date ? " ใกล้วันที่เลือก" : ""}</span>
        {flights.length === 0 && (
          <div className="st-card st-empty">
            ไม่พบเที่ยวบิน{date ? "ในช่วง ±3 วันจากวันที่เลือก" : ""} — ลองเปลี่ยนวันที่ หรือเว้นว่างต้นทาง/ปลายทาง
          </div>
        )}

        <div className="st-results">
          {flights.map((f) => (
            <div key={f.id} className="st-result st-flight">
              <div className="st-flight-img" style={{ backgroundImage: `url(${sized(cityPhoto(f.toCity), 500)})` }}>
                <span>{f.toCity}</span>
              </div>
              <div className="st-result-body" style={{ gap: 12 }}>
                <div className="st-row" style={{ justifyContent: "space-between" }}>
                  <strong>{f.airline} · {f.flight_no}</strong>
                  <span className="st-row" style={{ gap: 6 }}>
                    <span className="st-badge">{CLASS_TH[f.seat_class]}</span>
                    {f.daysOff !== 0 && <span className="st-badge st-badge--pending">{f.daysOff > 0 ? `ช้ากว่า ${f.daysOff} วัน` : `เร็วกว่า ${-f.daysOff} วัน`}</span>}
                  </span>
                </div>
                <div className="st-route">
                  <div><strong>{f.depart_at.slice(11, 16)}</strong><div className="st-muted">{f.origin} · {f.fromCity}</div></div>
                  <div><div className="st-route-line" /><div className="st-route-mid" style={{ marginTop: 14 }}>{duration(f.depart_at, f.arrive_at)} · บินตรง</div></div>
                  <div style={{ textAlign: "right" }}><strong>{f.arrive_at.slice(11, 16)}</strong><div className="st-muted">{f.destination} · {f.toCity}</div></div>
                </div>
                <div className="st-muted" style={{ fontSize: 13 }}>🗓 {thaiDate(f.depart_at.slice(0, 10))} · ที่นั่งว่าง {f.seats_available}</div>
              </div>
              <div className="st-result-side">
                <span className="st-price">{baht(f.price)}<small> / คน</small></span>
                <span className="st-muted" style={{ fontSize: 12 }}>{passengers} คน ≈ {baht(f.price * passengers)}</span>
                <AddToCart
                  maxQty={Math.min(10, f.seats_available)}
                  defaultQty={passengers}
                  qtyLabel="ที่นั่ง"
                  item={{
                    type: "flight", ref: f.id, flight_id: f.id,
                    label: `${f.airline} ${f.flight_no} ${f.origin} → ${f.destination}`,
                    sub: `${thaiDate(f.depart_at.slice(0, 10))} ${f.depart_at.slice(11, 16)} · ${CLASS_TH[f.seat_class]}`,
                    unitPrice: f.price, image: cityPhoto(f.toCity),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
