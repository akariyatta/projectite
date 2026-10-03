import Link from "next/link";
import HomeSearch from "@/components/site/HomeSearch";
import { CITY_TH, featuredHotels, popularCities, searchEvents } from "@/lib/catalog";
import { baht, label } from "@/lib/format";
import { cityPhoto, sized } from "@/lib/images";

export const metadata = { title: "Hotel Travel — ที่พัก เที่ยวบิน และตั๋วงาน" };

/** Round-robin over groups (city, category…) so the home page shows a mix instead of one group's list. */
function spread(list, n, key) {
  const groups = new Map();
  for (const x of list) groups.set(x[key], [...(groups.get(x[key]) ?? []), x]);
  const out = [];
  for (let i = 0; out.length < n && out.length < list.length; i++) {
    for (const items of groups.values()) if (items[i] && out.length < n) out.push(items[i]);
  }
  return out;
}

const features = (cityCount) => [
  ["🛡️", "จองปลอดภัย", "ชำระผ่านระบบมาตรฐาน ยืนยันการจองทันทีทางอีเมล"],
  ["✨", "AI วางแผนให้", "บอกงบและสไตล์ ระบบจัดทริปพร้อมที่พักและที่เที่ยวให้"],
  ["🔄", "ยกเลิกได้", "ยกเลิกการจองได้เองจากหน้า “การจองของฉัน”"],
  ["🌏", `${cityCount} จุดหมาย`, "ไทย ญี่ปุ่น เกาหลี สิงคโปร์ ฮ่องกง ไต้หวัน ครบในที่เดียว"],
];

export default async function Home() {
  const [cities, events, hotels] = await Promise.all([popularCities(), searchEvents({}), featuredHotels(8)]);
  const picks = spread(spread(events, events.length, "city"), 8, "category"); // mixed categories, then mixed cities

  return (
    <>
      <HomeSearch cities={cities} destinations={cities} />

      <section className="st-wrap st-section">
        <div className="st-features">
          {features(cities.length).map(([icon, title, text]) => (
            <div key={title} className="st-feature">
              <span className="st-feature-icon">{icon}</span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {picks.length > 0 && (
        <section className="st-wrap st-section">
          <div className="st-section-head">
            <div>
              <div className="st-eyebrow">Things to do</div>
              <h2>ที่เที่ยวและกิจกรรมห้ามพลาด</h2>
            </div>
            <Link href="/events" className="st-link">ดูทั้งหมด {events.length} รายการ →</Link>
          </div>
          <div className="st-tiles">
            {picks.map((e) => (
              <Link key={e.id} href={`/events?city=${encodeURIComponent(e.city)}#event-${e.id}`} className="st-tile">
                <div className="st-tile-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sized(e.image_url ?? cityPhoto(e.city), 600)} alt="" loading="lazy" />
                  <span className="st-tile-tag">{label(e.category)}</span>
                </div>
                <div className="st-tile-body">
                  <span className="st-tile-city">📍 {CITY_TH[e.city] ?? e.city}</span>
                  <h3>{e.name}</h3>
                  <span className="st-tile-price">เริ่ม <strong>{baht(Math.min(...e.tickets.map((t) => t.price)))}</strong></span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="st-wrap st-section">
        <Link href="/plans/new" className="st-banner" style={{ backgroundImage: `url(${sized(cityPhoto("Kyoto"), 1600)})` }}>
          <div>
            <div className="st-eyebrow">AI Trip Planner</div>
            <h2>ไม่รู้จะเที่ยวไหนดี? ให้เราจัดทริปให้</h2>
            <p>บอกเมือง วันเดินทาง งบประมาณ และสไตล์ที่ชอบ — ได้ 3 แผนพร้อมเที่ยวบิน ที่พัก และที่เที่ยว เลือกแล้วจองได้ทันที</p>
          </div>
          <span className="st-btn">✨ เริ่มวางแผนเที่ยว</span>
        </Link>
      </section>

      {hotels.length > 0 && (
        <section className="st-wrap st-section">
          <div className="st-section-head">
            <div>
              <div className="st-eyebrow">Where to stay</div>
              <h2>ที่พักแนะนำ</h2>
            </div>
            <Link href="/hotels" className="st-link">ดูที่พักทั้งหมด →</Link>
          </div>
          <div className="st-tiles">
            {hotels.map((h) => (
              <Link key={h.id} href={`/hotels/${h.id}`} className="st-tile">
                <div className="st-tile-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sized(h.image_url ?? cityPhoto(h.city), 600)} alt="" loading="lazy" />
                  <span className="st-tile-tag st-stars">{"★".repeat(h.star_rating)}</span>
                </div>
                <div className="st-tile-body">
                  <span className="st-tile-city">📍 {h.th}</span>
                  <h3>{h.name}</h3>
                  <span className="st-tile-price">เริ่ม <strong>{baht(h.from_price)}</strong> / คืน</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
