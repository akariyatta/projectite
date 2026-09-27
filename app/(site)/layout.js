import { Suspense } from "react";
import Toast from "@/components/admin/Toast";
import { adminFonts } from "@/components/admin/fonts";
import SiteHeader from "@/components/site/SiteHeader";
import "@/components/site/site.css";

// Shared shell for every customer page: header (login state + cart), toast messages, footer.
export default function SiteLayout({ children }) {
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
