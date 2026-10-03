import Link from "next/link";
import { CITY_TH, normalizeCity, popularCities, searchFlights, searchHotels, stayDates } from "@/lib/catalog";
import { baht } from "@/lib/format";
import { CITY_PHOTOS, sized } from "@/lib/images";

export const metadata = { title: "ค้นหาที่พัก · Hotel Travel" };

const thaiDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", { day: "numeric", month: "short", year: "numeric" });

export default async function Hotels({ searchParams }) {
  const sp = await searchParams;
  const city = normalizeCity(sp.city);
  const { checkIn, checkOut, nights } = stayDates(sp.check_in, sp.check_out);
  const guests = Math.min(20, Math.max(1, Number(sp.guests) || 2));
  const rooms = Math.min(10, Math.max(1, Number(sp.rooms) || 1));
  const from = normalizeCity(sp.from);

  const [hotels, cities, flights] = await Promise.all([
    searchHotels({ city, checkIn, checkOut, guests, rooms, stars: sp.stars, sort: sp.sort }),
    popularCities(),
    from ? searchFlights({ from, to: city, date: checkIn, passengers: guests }) : [],
  ]);
  const stay = new URLSearchParams({ check_in: checkIn, check_out: checkOut, guests, rooms });
  const sortHref = (s) => `/hotels?${new URLSearchParams({ ...(city && { city }), ...(from && { from }), check_in: checkIn, check_out: checkOut, guests, rooms, ...(sp.stars && { stars: sp.stars }), sort: s })}`;

  return (
    <>
      <div className={`st-pagehead ${CITY_PHOTOS[city] ? "has-photo" : ""}`} style={CITY_PHOTOS[city] ? { "--photo": `url(${sized(CITY_PHOTOS[city], 1600)})` } : undefined}>
        <div className="st-wrap">
          <div className="st-eyebrow">Stay</div>
          <h1>{city ? `ที่พักใน ${CITY_TH[city] ?? city}` : "ที่พักทั้งหมด"}</h1>
          <div>{thaiDate(checkIn)} – {thaiDate(checkOut)} · {nights} คืน · {guests} คน · {rooms} ห้อง</div>
        </div>
      </div>

      <div className="st-wrap st-pull st-stack">
        <form className="st-card st-filter" action="/hotels">
          <label className="st-field">
            <span>จุดหมายปลายทาง</span>
            <input name="city" defaultValue={sp.city ?? ""} list="city-list" placeholder="เช่น Tokyo, กรุงเทพ" className="st-input" />
            <datalist id="city-list">{cities.map((c) => <option key={c.city} value={c.city}>{c.th}</option>)}</datalist>
          </label>
          <label className="st-field"><span>เช็คอิน</span><input type="date" name="check_in" defaultValue={checkIn} className="st-input" /></label>
          <label className="st-field"><span>เช็คเอาท์</span><input type="date" name="check_out" defaultValue={checkOut} className="st-input" /></label>
          <label className="st-field"><span>ผู้เข้าพัก</span><input type="number" name="guests" min="1" max="20" defaultValue={guests} className="st-input" /></label>
          <label className="st-field"><span>ห้อง</span><input type="number" name="rooms" min="1" max="10" defaultValue={rooms} className="st-input" /></label>
          {from && <input type="hidden" name="from" value={from} />}
          <button className="st-btn">ค้นหา</button>
        </form>

        {from && (
          <div className="st-card">
            <div className="st-row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>✈️ เที่ยวบิน {from} → {city || "ทุกเมือง"}</h2>
              <Link href={`/flights?${new URLSearchParams({ from, to: city, date: checkIn, passengers: guests })}`} className="st-link">ดูเที่ยวบินทั้งหมด →</Link>
            </div>
            {flights.length === 0 ? (
              <p className="st-muted" style={{ marginTop: 8 }}>ยังไม่มีเที่ยวบินช่วงวันที่เลือก</p>
            ) : (
              <p className="st-muted" style={{ marginTop: 8 }}>
                พบ {flights.length} เที่ยวบิน เริ่มต้น <strong style={{ color: "var(--navy)" }}>{baht(Math.min(...flights.map((f) => f.price)))}</strong> / คน —
                เลือกที่พักด้านล่าง แล้วเพิ่มเที่ยวบินในหน้า <Link href={`/flights?${new URLSearchParams({ from, to: city, date: checkIn, passengers: guests })}`} className="st-link">เที่ยวบิน</Link>
              </p>
            )}
          </div>
        )}

        <div className="st-row" style={{ justifyContent: "space-between" }}>
          <span className="st-muted">พบ {hotels.length} ที่พัก · ว่าง {hotels.filter((h) => h.available).length} แห่ง</span>
          <div className="st-pills">
            <Link href={sortHref("price")} className={`st-pill ${sp.sort !== "stars" ? "active" : ""}`}>ราคาต่ำสุด</Link>
            <Link href={sortHref("stars")} className={`st-pill ${sp.sort === "stars" ? "active" : ""}`}>ดาวสูงสุด</Link>
          </div>
        </div>

        {hotels.length === 0 && (
          <div className="st-card st-empty">
            ไม่พบที่พัก{city ? `ใน “${city}”` : ""} — ลองเมืองอื่น เช่น {cities.map((c) => c.city).join(", ")}
          </div>
        )}

        <div className="st-results">
          {hotels.map((h) => (
            <Link key={h.id} href={`/hotels/${h.id}?${stay}`} className={`st-result ${h.available ? "" : "is-off"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {h.image_url ? <img src={h.image_url.replace(/([?&])w=\d+/, "$1w=600")} alt="" className="st-result-img" /> : <div className="st-result-img" />}
              <div className="st-result-body">
                <span className="st-stars">{"★".repeat(h.star_rating)}</span>
                <h3>{h.name}</h3>
                <div className="st-muted" style={{ fontSize: 13 }}>📍 {h.city}, {h.country}{h.address ? ` · ${h.address}` : ""}</div>
                {h.description && <p>{h.description}</p>}
                <div className="st-muted" style={{ fontSize: 13 }}>{h.rooms.length} แบบห้อง · {h.rooms.map((r) => r.name).join(" · ")}</div>
              </div>
              <div className="st-result-side">
                {h.available ? (
                  <>
                    <span className="st-muted" style={{ fontSize: 12 }}>เริ่มต้น</span>
                    <span className="st-price">{baht(h.fromPrice)}<small> / คืน</small></span>
                    <span className="st-muted" style={{ fontSize: 12 }}>{nights} คืน ≈ {baht(h.fromPrice * nights * rooms)}</span>
                    <span className="st-btn" style={{ marginTop: 6 }}>ดูห้องพัก</span>
                  </>
                ) : (
                  <>
                    <span className="st-badge st-badge--full">ห้องเต็มในวันที่เลือก</span>
                    <span className="st-muted" style={{ fontSize: 12 }}>ลองเปลี่ยนวันที่หรือจำนวนห้อง</span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
