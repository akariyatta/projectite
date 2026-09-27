"use client";

import { useEffect } from "react";
import { useCart } from "./cart";

/** Rendered on the booking page: empties the cart once, right after a successful checkout. */
export default function ClearCartAfterOrder() {
  const { clear } = useCart();
  useEffect(() => {
    if (sessionStorage.getItem("ht_ordering")) {
      sessionStorage.removeItem("ht_ordering");
      clear();
    }
  }, [clear]);
  return null;
}
