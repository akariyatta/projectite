import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCart from "@/components/site/AddToCart";
import { CITY_TH, getHotel, stayDates } from "@/lib/catalog";
import { baht } from "@/lib/format";

const thaiDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", { weekday: "short", day: "numeric", month: "short" });

export default async function HotelPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { checkIn, checkOut, nights } = stayDates(sp.check_in, sp.check_out);
  const guests = Math.max(1, Number(sp.guests) || 2);
  const hotel = await getHotel(id, { checkIn, checkOut });
  if (!hotel) notFound();

  return (
    <div className="st-wrap st-stack" style={{ paddingTop: 28 }}>
      <Link href={`/hotels?${new URLSearchParams({ city: hotel.city, check_in: checkIn, check_out: checkOut, guests })}`} className="st-link">
        ← ที่พักทั้งหมดใน {CITY_TH[hotel.city] ?? hotel.city}
      </Link>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      {hotel.image_url ? <img src={hotel.image_url} alt={hotel.name} className="st-hero-img" /> : <div className="st-hero-img" />}

      <div className="st-two">
        <div className="st-stack">
          <div>
            <span className="st-stars">{"★".repeat(hotel.star_rating)}</span>
            <h1 style={{ fontSize: 32 }}>{hotel.name}</h1>
            <div className="st-muted">📍 {hotel.address ? `${hotel.address}, ` : ""}{hotel.city}, {hotel.country}</div>
            {hotel.description && <p style={{ marginTop: 12 }}>{hotel.description}</p>}
          </div>

          <div className="st-card">
            <h2>เลือกห้องพัก</h2>
            <p className="st-muted" style={{ marginTop: -6, marginBottom: 8, fontSize: 13 }}>
              ราคารวม {nights} คืน ({thaiDate(checkIn)} – {thaiDate(checkOut)}) · ต่อ 1 ห้อง
            </p>
            {hotel.rooms.map((r) => {
              return (
                <div key={r.id} className="st-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.image_url ? <img src={r.image_url.replace(/([?&])w=\d+/, "$1w=300")} alt="" /> : <div className="st-thumb" />}
                  <div>
                    <h3 style={{ fontSize: 17 }}>{r.name}</h3>
                    <div className="st-muted" style={{ fontSize: 13 }}>
                      👥 พักได้ {r.capacity} คน · {r.free > 0 ? (r.free <= 3 ? <strong style={{ color: "var(--danger)" }}>เหลือ {r.free} ห้องสุดท้าย!</strong> : `ว่าง ${r.free} ห้อง`) : "เต็ม"}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span className="st-price" style={{ fontSize: 22 }}>{baht(r.price * nights)}</span>
                      <span className="st-muted" style={{ fontSize: 12 }}> · {baht(r.price)} / คืน</span>
                    </div>
                  </div>
                  <AddToCart
                    disabled={r.free < 1}
                    disabledText="เต็มในวันที่เลือก"
                    maxQty={r.free}
                    defaultQty={Math.ceil(guests / r.capacity)}
                    qtyLabel="ห้อง"
                    item={{
                      type: "room", ref: r.id, room_id: r.id, check_in: checkIn, check_out: checkOut,
                      label: `${hotel.name} — ${r.name}`, sub: `${thaiDate(checkIn)} – ${thaiDate(checkOut)} · ${nights} คืน`,
                      unitPrice: r.price * nights, image: r.image_url ?? hotel.image_url,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <aside className="st-card st-sticky">
          <h2>วันเข้าพัก</h2>
          <form action={`/hotels/${hotel.id}`} className="st-stack" style={{ display: "grid", gap: 12 }}>
            <label className="st-field"><span>เช็คอิน</span><input type="date" name="check_in" defaultValue={checkIn} className="st-input" /></label>
            <label className="st-field"><span>เช็คเอาท์</span><input type="date" name="check_out" defaultValue={checkOut} className="st-input" /></label>
            <label className="st-field"><span>ผู้เข้าพัก</span><input type="number" name="guests" min="1" max="20" defaultValue={guests} className="st-input" /></label>
            <button className="st-btn-navy">เช็กห้องว่าง</button>
          </form>
          <p className="st-muted" style={{ fontSize: 12.5, marginTop: 14 }}>
            ✓ ยกเลิกได้ถึง 1 วันก่อนเข้าพัก · ✓ ราคารวมภาษีแล้ว
          </p>
        </aside>
      </div>
    </div>
  );
}
