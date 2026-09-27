"use client";

import Link from "next/link";
import { useCart } from "./cart";

export default function CartBadge() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="st-cart" aria-label={`ตะกร้า ${count} รายการ`}>
      🧳 ตะกร้า {count > 0 && <span className="st-cart-count">{count}</span>}
    </Link>
  );
}
