"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** "เหลือเวลาชำระเงิน 29:41" — refreshes the page when time is up so the expired status shows. */
export default function Countdown({ until }) {
  const router = useRouter();
  const end = new Date(until.replace(" ", "T")).getTime();
  const [left, setLeft] = useState(() => end - Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const ms = end - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(t);
        setTimeout(() => router.refresh(), 1500); // give the server a moment, then show the expired booking
      }
    }, 1000);
    return () => clearInterval(t);
  }, [end, router]);

  if (left <= 0) return <div className="st-alert st-alert-error">หมดเวลาชำระเงินแล้ว — กำลังอัปเดต…</div>;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <div className={`st-countdown ${left < 5 * 60000 ? "is-urgent" : ""}`} role="timer">
      ⏳ เหลือเวลาชำระเงิน <strong>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</strong>
      <small>หากไม่ชำระภายในเวลานี้ ระบบจะยกเลิกการจองให้อัตโนมัติ</small>
    </div>
  );
}
