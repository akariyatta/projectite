import { Suspense } from "react";
import Toast from "@/components/admin/Toast";
import { adminFonts } from "@/components/admin/fonts";
import SiteHeader from "@/components/site/SiteHeader";
import { expireStaleBookings } from "@/lib/booking-flow";
import "@/components/site/site.css";

// Shared shell for every customer page: header (login state + cart), toast messages, footer.
export default async function SiteLayout({ children }) {
  // Release stock held by bookings that were never paid (throttled to once a minute)
  await expireStaleBookings().catch((e) => console.error("expire sweep:", e));
  return (
    <div className={`st-root ${adminFonts}`}>
      <SiteHeader />
      <main className="st-main">{children}</main>
      <footer className="st-footer">
        HOTEL TRAVEL · BOOK WITH CONFIDENCE · ระบบชำระเงินเป็นโหมดทดสอบ ไม่มีการตัดเงินจริง
      </footer>
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  );
}
