import { getAdmin } from "@/lib/auth";
import { THAI_MONTHS_FULL } from "@/lib/format";
import { monthlyReport, sum } from "@/lib/reports";

// GET /admin/reports/export?year=2026 → monthly report as CSV (opens in Excel with Thai text)
export async function GET(request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });

  const year = Number(new URL(request.url).searchParams.get("year")) || new Date().getFullYear();
  const months = await monthlyReport(year);

  const rows = [
    ["เดือน", "การจอง", "ยกเลิก", "จำนวนการชำระเงิน", "รายได้ (บาท)", "คืนเงิน (บาท)"],
    ...months.map((m) => [THAI_MONTHS_FULL[m.month - 1], m.bookings, m.cancelled, m.paidCount, m.revenue, m.refunded]),
    ["รวม", sum(months, "bookings"), sum(months, "cancelled"), sum(months, "paidCount"), sum(months, "revenue"), sum(months, "refunded")],
  ];
  // BOM so Excel reads UTF-8 (Thai) correctly
  const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-report-${year}.csv"`,
    },
  });
}
