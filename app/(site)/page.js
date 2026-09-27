import Link from "next/link";
import HomeSearch from "@/components/site/HomeSearch";
import { popularCities, searchEvents } from "@/lib/catalog";
import { baht } from "@/lib/format";

export const metadata = { title: "Hotel Travel — ที่พัก เที่ยวบิน และตั๋วงาน" };

export default async function Home() {
  const [cities, events] = await Promise.all([popularCities(), searchEvents({})]);

  return (
    <>
      <HomeSearch cities={cities} destinations={cities} />

      {events.length > 0 && (
        <section className="st-wrap" style={{ marginTop: -16 }}>
          <div className="st-row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 20 }}>งานและสวนสนุกยอดนิยม</h2>
            <Link href="/events" className="st-link">ดูทั้งหมด →</Link>
          </div>
          <div className="st-results" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {events.slice(0, 3).map((e) => (
              <Link key={e.id} href={`/events?city=${encodeURIComponent(e.city)}#event-${e.id}`} className="st-card" style={{ padding: 0, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {e.image_url ? <img src={e.image_url} alt="" className="st-result-img" style={{ height: 160, minHeight: 0 }} /> : <div className="st-result-img" style={{ height: 160, minHeight: 0 }} />}
                <div style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 17 }}>{e.name}</h3>
                  <div className="st-muted" style={{ fontSize: 13 }}>📍 {e.city} · เริ่ม {baht(Math.min(...e.tickets.map((t) => t.price)))}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
