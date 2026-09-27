"use client";

import { useSyncExternalStore } from "react";

// The cart lives in the browser (localStorage) until checkout. Each item keeps only what the
// server needs (type, id, dates, qty) plus a display label/price; the server re-prices everything.
const KEY = "ht_cart";
const EVENT = "ht-cart-change";
const EMPTY = "[]";

const read = () => {
  try {
    return localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
};
const write = (items) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
};
const subscribe = (cb) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // other tabs
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export const cartKey = (it) => `${it.type}:${it.ref}:${it.check_in ?? it.date ?? ""}:${it.check_out ?? ""}`;

export function useCart() {
  const raw = useSyncExternalStore(subscribe, read, () => EMPTY);
  let items = [];
  try { items = JSON.parse(raw); } catch {}
  return {
    items,
    count: items.length,
    total: items.reduce((s, it) => s + it.unitPrice * it.qty, 0),
    add(item) {
      const cur = JSON.parse(read());
      const i = cur.findIndex((x) => cartKey(x) === cartKey(item));
      if (i >= 0) cur[i] = { ...cur[i], qty: Math.min(10, cur[i].qty + item.qty) };
      else cur.push(item);
      write(cur);
    },
    setQty(key, qty) {
      write(JSON.parse(read()).map((x) => (cartKey(x) === key ? { ...x, qty: Math.min(10, Math.max(1, qty)) } : x)));
    },
    remove(key) {
      write(JSON.parse(read()).filter((x) => cartKey(x) !== key));
    },
    clear() {
      write([]);
    },
  };
}
