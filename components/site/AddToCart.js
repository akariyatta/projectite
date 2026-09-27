"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart";

/**
 * "Add to cart" with an optional quantity picker (and date picker for tickets).
 * item: { type, ref, label, sub, unitPrice, check_in?, check_out? }; maxQty limits the picker.
 */
export default function AddToCart({ item, maxQty = 10, defaultQty = 1, qtyLabel = "จำนวน", dateRange, disabled, disabledText = "เต็ม" }) {
  const cart = useCart();
  const [qty, setQty] = useState(Math.min(defaultQty, Math.max(1, maxQty)));
  const [date, setDate] = useState(dateRange?.min ?? "");
  const [added, setAdded] = useState(false);

  if (disabled || maxQty < 1) return <span className="st-badge st-badge--full">{disabledText}</span>;

  function add() {
    cart.add({ ...item, qty, ...(dateRange && { date }) });
    setAdded(true);
  }

  return (
    <div className="st-add">
      {dateRange && (
        <input type="date" className="st-input" value={date} min={dateRange.min} max={dateRange.max} onChange={(e) => setDate(e.target.value)} aria-label="วันที่เข้างาน" />
      )}
      <select className="st-input" value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label={qtyLabel}>
        {Array.from({ length: Math.min(10, maxQty) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{qtyLabel} {n}</option>
        ))}
      </select>
      <button type="button" className="st-btn" onClick={add} disabled={dateRange && !date}>เพิ่มลงตะกร้า</button>
      {added && <span className="st-added">✓ เพิ่มแล้ว · <Link href="/cart" className="st-link">ดูตะกร้า</Link></span>}
    </div>
  );
}
