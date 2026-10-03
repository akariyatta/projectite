"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { baht } from "@/lib/format";
import { sized, TYPE_PHOTOS } from "@/lib/images";
import { placeOrder } from "@/lib/site-actions";
import { cartKey, useCart } from "./cart";

const ICON = { room: "🏨", flight: "✈️", ticket: "🎟️" };
const UNIT = { room: "ห้อง", flight: "ที่นั่ง", ticket: "ใบ" };

export default function CartView({ signedIn }) {
  const cart = useCart();
  const router = useRouter();
  const [method, setMethod] = useState("promptpay");
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();

  function checkout() {
    if (!signedIn) return router.push("/signin?next=/cart");
    setError(null);
    // The booking page clears the cart once this flag is set and the order succeeded
    sessionStorage.setItem("ht_ordering", "1");
    start(async () => {
      const res = await placeOrder(
        cart.items.map(({ type, room_id, flight_id, ticket_id, check_in, check_out, date, qty }) => ({ type, room_id, flight_id, ticket_id, check_in, check_out, date, qty })),
        method,
      );
      // Only reached on failure — success redirects to the new booking
      sessionStorage.removeItem("ht_ordering");
      if (res?.needLogin) return router.push("/signin?next=/cart");
      if (res?.error) setError(res.error);
    });
  }

  if (!cart.items.length) {
    return (
      <div className="st-card st-empty">
        <div style={{ fontSize: 40 }}>🧳</div>
        <p>ตะกร้ายังว่างอยู่</p>
        <div className="st-row" style={{ justifyContent: "center", marginTop: 12 }}>
          <Link href="/hotels" className="st-btn">หาที่พัก</Link>
          <Link href="/flights" className="st-btn-ghost">หาเที่ยวบิน</Link>
          <Link href="/events" className="st-btn-ghost">ที่เที่ยว & กิจกรรม</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="st-two">
      <div className="st-card">
        <h2>รายการในตะกร้า ({cart.items.length})</h2>
        {cart.items.map((it) => {
          const key = cartKey(it);
          return (
            <div key={key} className="st-line">
              <div className="st-line-main">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sized(it.image ?? TYPE_PHOTOS[it.type === "room" ? "hotel" : it.type === "ticket" ? "event" : "flight"], 200)} alt="" className="st-line-img" />
                <div style={{ minWidth: 0 }}>
                <strong>{ICON[it.type]} {it.label}</strong>
                <div className="st-muted" style={{ fontSize: 13 }}>
                  {it.sub}{it.date ? ` · วันที่ ${new Date(`${it.date}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </div>
                <div className="st-muted" style={{ fontSize: 13 }}>{baht(it.unitPrice)} / {UNIT[it.type]}</div>
                </div>
              </div>
              <select className="st-input" style={{ width: "auto" }} value={it.qty} onChange={(e) => cart.setQty(key, Number(e.target.value))} aria-label="จำนวน">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {UNIT[it.type]}</option>)}
              </select>
              <div style={{ textAlign: "right" }}>
                <strong>{baht(it.unitPrice * it.qty)}</strong>
                <div><button type="button" onClick={() => cart.remove(key)} className="st-link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 13, color: "var(--danger)" }}>ลบ</button></div>
              </div>
            </div>
          );
        })}
      </div>

      <aside className="st-card st-sticky st-stack" style={{ display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0 }}>สรุปการจอง</h2>
        <div className="st-total">
          <span>ยอดรวม</span>
          <strong className="st-price">{baht(cart.total)}</strong>
        </div>
        <p className="st-muted" style={{ fontSize: 12 }}>ราคาและที่ว่างจะถูกตรวจสอบอีกครั้งตอนยืนยันการจอง</p>

        <div className="st-methods" role="radiogroup" aria-label="วิธีชำระเงิน">
          <label className="st-method">
            <input type="radio" name="method" checked={method === "promptpay"} onChange={() => setMethod("promptpay")} />
            <span><strong>PromptPay QR</strong><br /><small className="st-muted">สแกนจ่ายผ่านแอปธนาคาร</small></span>
          </label>
          <label className="st-method">
            <input type="radio" name="method" checked={method === "credit_card"} onChange={() => setMethod("credit_card")} />
            <span><strong>บัตรเครดิต / เดบิต</strong><br /><small className="st-muted">Visa, Mastercard, JCB</small></span>
          </label>
        </div>

        {error && <div className="st-alert st-alert-error">{error}</div>}
        <button type="button" className="st-btn" onClick={checkout} disabled={pending} style={{ padding: 14 }}>
          {pending ? "กำลังจอง…" : signedIn ? "ยืนยันการจอง" : "เข้าสู่ระบบเพื่อจอง"}
        </button>
        <p className="st-test-note">🔒 โหมดทดสอบ — ยังไม่มีการตัดเงินจริง</p>
      </aside>
    </div>
  );
}
