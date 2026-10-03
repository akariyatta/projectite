import Link from "next/link";
import { getCustomer } from "@/lib/customer";
import { signoutCustomer } from "@/lib/site-actions";
import CartBadge from "./CartBadge";

export default async function SiteHeader() {
  const user = await getCustomer();
  return (
    <header className="st-header">
      <div className="st-header-inner">
        <Link href="/" className="st-brand"><span>✦</span> Hotel Travel</Link>
        <nav className="st-nav">
          <Link href="/hotels">ที่พัก</Link>
          <Link href="/flights">เที่ยวบิน</Link>
          <Link href="/events">ที่เที่ยว & กิจกรรม</Link>
          <Link href="/plans/new">✨ วางแผนเที่ยว</Link>
        </nav>
        <div className="st-actions">
          <CartBadge />
          {user ? (
            <div className="st-user">
              <Link href="/plans" className="st-hide-sm">แผนของฉัน</Link>
              <Link href="/bookings">การจองของฉัน</Link>
              <Link href="/profile" className="st-hide-sm" style={{ color: "#c9c2ac" }} title="บัญชีของฉัน">👤 {user.name}</Link>
              <form action={signoutCustomer}>
                <button className="st-login" style={{ padding: "5px 10px" }}>ออก</button>
              </form>
            </div>
          ) : (
            <Link href="/signin" className="st-login">เข้าสู่ระบบ</Link>
          )}
        </div>
      </div>
    </header>
  );
}
