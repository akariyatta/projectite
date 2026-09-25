"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  { title: "ภาพรวม", links: [{ href: "/admin", icon: "◆", label: "แดชบอร์ด" }, { href: "/admin/bookings", icon: "🧾", label: "การจอง" }, { href: "/admin/reports", icon: "📈", label: "รายงานยอดขาย" }] },
  {
    title: "ที่พัก",
    links: [
      { href: "/admin/hotels", icon: "🏨", label: "โรงแรม" },
      { href: "/admin/rooms", icon: "🛏️", label: "ห้องพัก" },
    ],
  },
  {
    title: "การเดินทาง",
    links: [
      { href: "/admin/flights", icon: "✈️", label: "เที่ยวบิน" },
      { href: "/admin/events", icon: "🎢", label: "งาน / สวนสนุก" },
      { href: "/admin/event_tickets", icon: "🎟️", label: "ประเภทตั๋ว" },
      { href: "/admin/trip_plans", icon: "🤖", label: "แผนเที่ยว AI" },
    ],
  },
  { title: "ลูกค้า", links: [{ href: "/admin/customers", icon: "👥", label: "ลูกค้า" }] },
  { title: "ระบบ", links: [{ href: "/admin/admins", icon: "🔐", label: "ผู้ดูแลระบบ" }] },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="adm-nav">
      {GROUPS.map((g) => (
        <div key={g.title} style={{ display: "contents" }}>
          <div className="adm-nav-group">{g.title}</div>
          {g.links.map((l) => {
            const active = l.href === "/admin" ? path === l.href : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={active ? "active" : undefined}>
                <span className="adm-nav-icon">{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
