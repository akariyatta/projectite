import Link from "next/link";
import AddToCart from "@/components/site/AddToCart";
import { CITY_TH, normalizeCity, searchEvents, todayStr } from "@/lib/catalog";
import { baht, label } from "@/lib/format";

export const metadata = { title: "งานและสวนสนุก · Hotel Travel" };

const thaiDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", { day: "numeric", month: "short", year: "numeric" });

export default async function Events({ searchParams }) {
  const sp = await searchParams;
  const city = normalizeCity(sp.city);
  const [events, all] = await Promise.all([searchEvents({ city }), searchEvents({})]);
  const cities = [...new Set(all.map((e) => e.city))];
  const today = todayStr();

  return (
    <>
      <div className="st-pagehead">
        <div className="st-wrap">
          <div className="st-eyebrow">Experiences</div>
          <h1>{city ? `งานและสวนสนุกใน ${CITY_TH[city] ?? city}` : "งานและสวนสนุก"}</h1>
          <div>Disneyland, Universal Studios, คอนเสิร์ต และอีกมากมาย</div>
        </div>
      </div>

      <div className="st-wrap st-pull st-stack">
        <div className="st-card st-pills">
          <Link href="/events" className={`st-pill ${!city ? "active" : ""}`}>ทุกเมือง</Link>
          {cities.map((c) => (
            <Link key={c} href={`/events?city=${encodeURIComponent(c)}`} className={`st-pill ${city === c ? "active" : ""}`}>{CITY_TH[c] ?? c}</Link>
          ))}
        </div>

        {events.length === 0 && <div className="st-card st-empty">ยังไม่มีงานที่เปิดขายในเมืองนี้</div>}

        {events.map((e) => {
          const min = e.start_date > today ? e.start_date : today;
          return (
            <div key={e.id} id={`event-${e.id}`} className="st-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="st-result" style={{ border: 0, borderRadius: 0, boxShadow: "none" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {e.image_url ? <img src={e.image_url.replace(/([?&])w=\d+/, "$1w=600")} alt="" className="st-result-img" /> : <div className="st-result-img" />}
                <div className="st-result-body" style={{ paddingRight: 20 }}>
                  <span className="st-badge" style={{ justifySelf: "start" }}>{label(e.category)}</span>
                  <h3>{e.name}</h3>
                  <div className="st-muted" style={{ fontSize: 13 }}>📍 {e.venue ? `${e.venue}, ` : ""}{e.city} · 🗓 {thaiDate(e.start_date)} – {thaiDate(e.end_date)}</div>
                  {e.description && <p>{e.description}</p>}
                </div>
                <div />
              </div>
              <div style={{ padding: "0 24px 8px" }}>
                {e.tickets.map((t) => (
                  <div key={t.id} className="st-item" style={{ gridTemplateColumns: "1fr auto" }}>
                    <div>
                      <strong>🎟️ {t.name}</strong>
                      <div>
                        <span className="st-price" style={{ fontSize: 20 }}>{baht(t.price)}</span>
                        <span className="st-muted" style={{ fontSize: 12 }}> / ใบ · {t.left <= 20 ? <strong style={{ color: "var(--danger)" }}>เหลือ {t.left} ใบ</strong> : "มีตั๋ว"}</span>
                      </div>
                    </div>
                    <AddToCart
                      maxQty={Math.min(10, t.left)}
                      disabledText="ตั๋วหมด"
                      qtyLabel="ใบ"
                      dateRange={{ min, max: e.end_date }}
                      item={{ type: "ticket", ref: t.id, ticket_id: t.id, label: `${e.name} — ${t.name}`, sub: e.city, unitPrice: t.price, image: e.image_url }}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
