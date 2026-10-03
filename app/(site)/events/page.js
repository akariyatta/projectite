import Link from "next/link";
import AddToCart from "@/components/site/AddToCart";
import { CITY_TH, normalizeCity, searchEvents, todayStr } from "@/lib/catalog";
import { baht, label } from "@/lib/format";
import { cityPhoto, sized } from "@/lib/images";

export const metadata = { title: "ที่เที่ยวและกิจกรรม · Hotel Travel" };

const CATEGORIES = ["attraction", "theme_park", "concert", "exhibition", "sport"];

const thaiDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", { day: "numeric", month: "short", year: "numeric" });

export default async function Events({ searchParams }) {
  const sp = await searchParams;
  const city = normalizeCity(sp.city);
  const type = CATEGORIES.includes(sp.type) ? sp.type : "";
  const [events, all] = await Promise.all([searchEvents({ city, category: type }), searchEvents({})]);
  const cities = [...new Set(all.map((e) => e.city))];
  const types = CATEGORIES.filter((c) => all.some((e) => e.category === c && (!city || e.city === city)));
  const href = (q) => {
    const p = new URLSearchParams({ ...(city && { city }), ...(type && { type }), ...q });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/events${p.size ? `?${p}` : ""}`;
  };
  const today = todayStr();

  return (
    <>
      <div className={`st-pagehead ${city ? "has-photo" : ""}`} style={city ? { "--photo": `url(${sized(cityPhoto(city), 1600)})` } : undefined}>
        <div className="st-wrap">
          <div className="st-eyebrow">Things to do</div>
          <h1>{city ? `ที่เที่ยวและกิจกรรมใน ${CITY_TH[city] ?? city}` : "ที่เที่ยวและกิจกรรม"}</h1>
          <div>สถานที่ท่องเที่ยว ทัวร์ สวนสนุก Disneyland โชว์ และเทศกาล — จองตั๋วล่วงหน้าได้ทันที</div>
        </div>
      </div>

      <div className="st-wrap st-pull st-stack">
        <div className="st-card st-stack" style={{ padding: 20 }}>
          <div className="st-pills">
            <Link href={href({ city: "" })} className={`st-pill ${!city ? "active" : ""}`}>🌏 ทุกเมือง</Link>
            {cities.map((c) => (
              <Link key={c} href={href({ city: c })} className={`st-pill ${city === c ? "active" : ""}`}>{CITY_TH[c] ?? c}</Link>
            ))}
          </div>
          <div className="st-pills" style={{ marginTop: 12 }}>
            <Link href={href({ type: "" })} className={`st-pill ${!type ? "active" : ""}`}>ทุกหมวด</Link>
            {types.map((c) => (
              <Link key={c} href={href({ type: c })} className={`st-pill ${type === c ? "active" : ""}`}>{label(c)}</Link>
            ))}
          </div>
        </div>

        <span className="st-muted">พบ {events.length} รายการ</span>
        {events.length === 0 && <div className="st-card st-empty">ยังไม่มีรายการที่เปิดขายตามที่เลือก</div>}

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
