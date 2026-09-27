import { query } from "./db";

// Trip-plan helpers shared by the admin (lib/actions.js) and the customer site (lib/site-actions.js).

const ITEM_TYPES = ["flight", "hotel", "event", "activity", "food", "transport"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Checks the trip form. Pass needUser: false when the user comes from the session. Returns { req, fieldErrors }. */
export function readTripRequest(input, { needUser = true } = {}) {
  const req = {
    user_id: Number(input.user_id) || null,
    title: String(input.title ?? "").trim().slice(0, 150),
    destination: String(input.destination ?? "").trim().slice(0, 150),
    start_date: String(input.start_date ?? ""),
    end_date: String(input.end_date ?? "") || String(input.start_date ?? ""),
    travelers: Math.min(20, Math.max(1, Number(input.travelers) || 1)),
    budget: input.budget === "" || input.budget == null ? null : Number(input.budget),
    prompt: String(input.prompt ?? "").trim().slice(0, 2000),
  };
  const fieldErrors = {};
  if (needUser && !req.user_id) fieldErrors.user_id = "กรุณาเลือกลูกค้า";
  if (!req.destination) fieldErrors.destination = "กรุณาเลือกปลายทาง";
  if (!DATE_RE.test(req.start_date)) fieldErrors.start_date = "กรุณาเลือกวันเริ่มเดินทาง";
  if (!DATE_RE.test(req.end_date) || req.end_date < req.start_date) fieldErrors.end_date = "วันกลับต้องไม่ก่อนวันเริ่ม";
  else if ((new Date(req.end_date) - new Date(req.start_date)) / 864e5 > 13) fieldErrors.end_date = "วางแผนได้สูงสุด 14 วัน";
  if (req.budget !== null && !(req.budget >= 0)) fieldErrors.budget = "งบต้องเป็นตัวเลขไม่ติดลบ";
  return { req, fieldErrors };
}

/** Clean the day-by-day plan coming from the browser (limits sizes, whitelists types). */
export function cleanPlan(input) {
  const days = (Array.isArray(input.plan?.days) ? input.plan.days : []).slice(0, 14).map((d, i) => ({
    day: i + 1,
    date: DATE_RE.test(d.date) ? d.date : null,
    title: String(d.title ?? "").slice(0, 150),
    items: (Array.isArray(d.items) ? d.items : []).slice(0, 30).map((it) => ({
      time: /^\d{2}:\d{2}$/.test(it.time) ? it.time : "",
      type: ITEM_TYPES.includes(it.type) ? it.type : "activity",
      ref_id: Number.isInteger(it.ref_id) ? it.ref_id : null,
      title: String(it.title ?? "").slice(0, 200),
      note: String(it.note ?? "").slice(0, 300),
      cost: Math.max(0, Number(it.cost) || 0),
    })),
  }));
  return {
    plan: {
      summary: String(input.plan?.summary ?? "").slice(0, 1000),
      estimated_cost: days.flatMap((d) => d.items).reduce((s, it) => s + it.cost, 0),
      days,
    },
    source: input.source === "ai" ? "ai" : "customer",
    style: ["budget", "balanced", "premium"].includes(input.style) ? input.style : null,
  };
}

/** Insert (id = null) or update a plan. Returns the plan id. */
export async function writeTripPlan(id, userId, req, { plan, source, style }) {
  const values = [userId, req.title, req.destination, req.start_date, req.end_date, req.travelers, req.budget, source, style, req.prompt || null, JSON.stringify(plan)];
  if (id) {
    await query(
      `UPDATE trip_plans SET user_id=?, title=?, destination=?, start_date=?, end_date=?, travelers=?, budget=?, source=?, style=?, prompt=?, plan=? WHERE id=?`,
      [...values, id],
    );
    return id;
  }
  const res = await query(
    `INSERT INTO trip_plans (user_id, title, destination, start_date, end_date, travelers, budget, source, style, prompt, plan)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    values,
  );
  return res.insertId;
}

/** A trip_plans row → the shape TripPlanner expects (also upgrades old plans whose items were plain strings). */
export function planForEditor(row) {
  let parsed = { summary: "", days: [] };
  try { parsed = { ...parsed, ...JSON.parse(row.plan ?? "{}") }; } catch {}
  parsed.days = (parsed.days ?? []).map((d, i) => ({
    day: i + 1,
    date: d.date ?? "",
    title: d.title ?? "",
    items: (d.items ?? []).map((it) => (typeof it === "string" ? { time: "", type: "activity", ref_id: null, title: it, note: "", cost: 0 } : it)),
  }));
  return {
    ...row,
    start_date: row.start_date?.slice(0, 10) ?? "",
    end_date: row.end_date?.slice(0, 10) ?? "",
    budget: row.budget === null ? "" : Number(row.budget),
    plan: parsed,
  };
}
