import { Suspense } from "react";
import Toast from "@/components/admin/Toast";
import { adminFonts } from "@/components/admin/fonts";
import SiteHeader from "@/components/site/SiteHeader";
import Link from "next/link";
import { expireStaleBookings } from "@/lib/booking-flow";
import { CITY_TH } from "@/lib/catalog";
import "@/components/site/site.css";

const FOOTER_CITIES = ["Bangkok", "Chiang Mai", "Phuket", "Tokyo", "Seoul", "Singapore"];

// Shared shell for every customer page: header (login state + cart), toast messages, footer.
export default async function SiteLayout({ children }) {
  // Release stock held by bookings that were never paid (throttled to once a minute)
  await expireStaleBookings().catch((e) => console.error("expire sweep:", e));
  return (
    <div className={`st-root ${adminFonts}`}>
      <SiteHeader />
      <main className="st-main">{children}</main>
      <footer className="st-footer">
        <div className="st-footer-grid">
          <div>
            <Link href="/" className="st-brand"><span>✦</span> Hotel Travel</Link>
            <p>ที่พัก เที่ยวบิน ตั๋วสวนสนุก และที่เที่ยวทั่วเอเชีย จองครบในที่เดียว พร้อมผู้ช่วยวางแผนเที่ยวอัจฉริยะ</p>
          </div>
          <div>
            <h4>บริการ</h4>
            <ul>
              <li><Link href="/hotels">ที่พัก</Link></li>
              <li><Link href="/flights">เที่ยวบิน</Link></li>
              <li><Link href="/events">ที่เที่ยว & กิจกรรม</Link></li>
              <li><Link href="/plans/new">วางแผนเที่ยวด้วย AI</Link></li>
            </ul>
          </div>
          <div>
            <h4>จุดหมายยอดนิยม</h4>
            <ul>
              {FOOTER_CITIES.map((c) => (
                <li key={c}><Link href={`/hotels?city=${encodeURIComponent(c)}`}>{CITY_TH[c]}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4>บัญชีของฉัน</h4>
            <ul>
              <li><Link href="/bookings">การจองของฉัน</Link></li>
              <li><Link href="/plans">แผนเที่ยวของฉัน</Link></li>
              <li><Link href="/profile">ข้อมูลส่วนตัว</Link></li>
              <li><Link href="/cart">ตะกร้า</Link></li>
            </ul>
          </div>
        </div>
        <div className="st-footer-bottom">
          © {new Date().getFullYear()} HOTEL TRAVEL · BOOK WITH CONFIDENCE · ระบบชำระเงินเป็นโหมดทดสอบ ไม่มีการตัดเงินจริง
        </div>
      </footer>
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  );
}
