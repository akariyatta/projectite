"use client";

import { useMemo, useState, useTransition } from "react";
import { baht } from "@/lib/format";
import { sized } from "@/lib/images";
import "./planner.css";

// Trip planner used by both the admin (/admin/trip_plans) and the customer site (/plan).
// Styling lives in planner.css (tp- classes) and only relies on the colour variables that
// both .adm-root and .st-root define, so it looks native in either place.

const TYPES = {
  flight: { icon: "✈️", label: "เที่ยวบิน" },
  hotel: { icon: "🏨", label: "ที่พัก" },
  event: { icon: "🎟️", label: "ตั๋วงาน" },
  activity: { icon: "📍", label: "กิจกรรม" },
  food: { icon: "🍜", label: "อาหาร" },
  transport: { icon: "🚆", label: "เดินทาง" },
};
const STYLE_TH = { budget: "ประหยัด", balanced: "สมดุล", premium: "พรีเมียม" };

function datesBetween(start, end) {
  const out = [];
  if (!start) return out;
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end || start}T00:00:00Z`);
  while (d <= last && out.length < 14) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
const blankDays = (meta) => datesBetween(meta.start_date, meta.end_date).map((date, i) => ({ day: i + 1, date, title: "", items: [] }));

/**
 * Props:
 *  id, initial            existing plan (or null for a new one)
 *  catalog, aiEnabled     from lib/planner.loadCatalog() / aiEnabled()
 *  suggestAction(meta)    server action → { options, engine, notice } | { error, fieldErrors }
 *  saveAction(id, data)   server action → redirects on success, or { error, fieldErrors }
 *  customers              admin only: shows the "customer" picker
 *  renderExtra(plan, meta, catalog)   optional extra buttons in the save bar (customer site: add to cart)
 *  saveLabel              text of the save button
 */
export default function TripPlanner({ id, initial, customers, catalog, aiEnabled, suggestAction, saveAction, renderExtra, saveLabel = "บันทึกแผน" }) {
  const [meta, setMeta] = useState({
    user_id: initial?.user_id ?? "",
    title: initial?.title ?? "",
    destination: initial?.destination ?? "",
    start_date: initial?.start_date ?? "",
    end_date: initial?.end_date ?? "",
    travelers: initial?.travelers ?? 2,
    budget: initial?.budget ?? "",
    prompt: initial?.prompt ?? "",
  });
  const [plan, setPlan] = useState(initial?.plan ?? null);
  const [source, setSource] = useState(initial?.source ?? "customer");
  const [style, setStyle] = useState(initial?.style ?? null);
  const [options, setOptions] = useState(null);
  const [engine, setEngine] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(null); // "suggest" | "save"

  const set = (k) => (e) => { setMeta((m) => ({ ...m, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const nights = Math.max(1, datesBetween(meta.start_date, meta.end_date).length - 1);
  const travelers = Math.max(1, Number(meta.travelers) || 1);
  const cities = useMemo(() => [...new Set([...catalog.cities, meta.destination].filter(Boolean))].sort(), [catalog.cities, meta.destination]);
  const inCity = useMemo(() => ({
    flight: catalog.flights.filter((f) => f.city === meta.destination),
    hotel: catalog.hotels.filter((h) => h.city === meta.destination),
    event: catalog.tickets.filter((t) => t.city === meta.destination),
  }), [catalog, meta.destination]);
  const total = plan ? plan.days.flatMap((d) => d.items).reduce((s, it) => s + (Number(it.cost) || 0), 0) : 0;
  const budget = Number(meta.budget) || 0;

  // Photo for a plan item: the catalog item's own photo, else a stock photo for its type
  const refOf = (it) => ({ flight: catalog.flights, hotel: catalog.hotels, event: catalog.tickets })[it.type]?.find((r) => r.id === it.ref_id);
  const imageOf = (it) => refOf(it)?.image ?? catalog.photos?.types[it.type] ?? catalog.photos?.types.activity;
  // Cover per option, varied so the 3 cards don't all show the same photo:
  // budget → the city, balanced → its main event, premium → its hotel
  const coverOf = (days, city, style) => {
    const items = days.flatMap((d) => d.items).filter((i) => i.ref_id != null);
    const first = (type) => items.find((i) => i.type === type);
    const pick = style === "premium" ? first("hotel") ?? first("event") : style === "balanced" ? first("event") ?? first("hotel") : null;
    return pick ? imageOf(pick) : catalog.photos?.cities[city] ?? imageOf(items[0] ?? { type: "activity" });
  };
  const cityCover = catalog.photos?.cities[meta.destination];

  const costOf = (type, ref) => (type === "hotel" ? ref.price * nights * Math.ceil(travelers / ref.capacity) : ref.price * travelers);

  function showErrors(res) {
    setErrors(res.fieldErrors ?? {});
    setMessage(res.error ? { type: "error", text: res.error } : null);
    if (res.fieldErrors && Object.keys(res.fieldErrors).length) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function suggest() {
    setBusy("suggest");
    setMessage(null);
    start(async () => {
      const res = await suggestAction(meta);
      setBusy(null);
      if (res.error) return showErrors(res);
      setErrors({});
      setOptions(res.options);
      setEngine(res.engine);
      if (res.notice) setMessage({ type: "error", text: res.notice });
      requestAnimationFrame(() => document.getElementById("tp-options")?.scrollIntoView({ behavior: "smooth" }));
    });
  }

  function choose(opt) {
    setPlan({ summary: opt.summary, days: opt.days });
    setSource("ai");
    setStyle(opt.style);
    if (!meta.title) setMeta((m) => ({ ...m, title: opt.title }));
    setOptions(null);
    requestAnimationFrame(() => document.getElementById("tp-editor")?.scrollIntoView({ behavior: "smooth" }));
  }

  function manual() {
    const days = blankDays(meta);
    if (!days.length) return showErrors({ error: "กรุณาเลือกวันเริ่มเดินทางก่อน", fieldErrors: { start_date: "กรุณาเลือกวันเริ่มเดินทาง" } });
    setPlan({ summary: "", days });
    setSource("customer");
    setStyle(null);
    setOptions(null);
    if (!meta.title && meta.destination) setMeta((m) => ({ ...m, title: `${m.destination} ${days.length} วัน` }));
  }

  function save() {
    setBusy("save");
    start(async () => {
      const res = await saveAction(id, { ...meta, plan, source, style });
      setBusy(null);
      if (res) showErrors(res);
    });
  }

  // ----- editor helpers -----
  const updateDay = (di, patch) => setPlan((p) => ({ ...p, days: p.days.map((d, i) => (i === di ? { ...d, ...patch } : d)) }));
  const updateItem = (di, ii, patch) => updateDay(di, { items: plan.days[di].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
  const removeItem = (di, ii) => updateDay(di, { items: plan.days[di].items.filter((_, j) => j !== ii) });
  const moveItem = (di, ii, dir) => {
    const items = [...plan.days[di].items];
    const j = ii + dir;
    if (j < 0 || j >= items.length) return;
    [items[ii], items[j]] = [items[j], items[ii]];
    updateDay(di, { items });
  };
  function addItem(di, value) {
    if (!value) return;
    const [type, refId] = value.split(":");
    let item = { time: "", type, ref_id: null, title: "", note: "", cost: 0 };
    if (refId) {
      const ref = inCity[type].find((r) => String(r.id) === refId);
      item = {
        ...item, ref_id: ref.id, title: ref.label, cost: costOf(type, ref),
        time: type === "flight" ? ref.depart_at.slice(11, 16) : type === "hotel" ? "15:00" : "09:00",
        note: type === "hotel" ? `${nights} คืน` : "",
      };
    }
    updateDay(di, { items: [...plan.days[di].items, item] });
  }
  const addDay = () => setPlan((p) => ({ ...p, days: [...p.days, { day: p.days.length + 1, date: "", title: "", items: [] }] }));
  const removeDay = (di) => setPlan((p) => ({ ...p, days: p.days.filter((_, i) => i !== di) }));

  const field = (name, label, input, wide) => (
    <label className={`tp-field ${wide ? "tp-wide" : ""} ${errors[name] ? "has-error" : ""}`}>
      <span>{label}</span>
      {input}
      {errors[name] && <small className="tp-error">{errors[name]}</small>}
    </label>
  );

  return (
    <div className="tp">
      {message && <div className={`tp-alert ${message.type === "error" ? "tp-alert-error" : ""}`}>{message.text}</div>}

      {/* 1. Trip details */}
      <section className="tp-card">
        {cityCover && (
          <div className="tp-banner" style={{ backgroundImage: `url(${sized(cityCover, 1200)})` }}>
            <span>📍 {meta.destination}</span>
          </div>
        )}
        <h2>ข้อมูลการเดินทาง</h2>
        <div className="tp-grid">
          {customers && field("user_id", "ลูกค้า *", (
            <select className="tp-input" value={meta.user_id} onChange={set("user_id")}>
              <option value="">— เลือกลูกค้า —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          ))}
          {field("destination", "ปลายทาง *", (
            <select className="tp-input" value={meta.destination} onChange={set("destination")}>
              <option value="">— เลือกเมือง —</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ))}
          {field("start_date", "วันเริ่มเดินทาง *", <input type="date" className="tp-input" value={meta.start_date} onChange={set("start_date")} />)}
          {field("end_date", "วันกลับ *", <input type="date" className="tp-input" value={meta.end_date} min={meta.start_date} onChange={set("end_date")} />)}
          {field("travelers", "จำนวนผู้เดินทาง", <input type="number" min="1" max="20" className="tp-input" value={meta.travelers} onChange={set("travelers")} />)}
          {field("budget", "งบประมาณรวม (บาท)", <input type="number" min="0" step="100" className="tp-input" value={meta.budget} onChange={set("budget")} placeholder="ไม่ระบุก็ได้" />)}
          {field("prompt", "อยากเที่ยวแบบไหน", (
            <textarea className="tp-input" rows={2} value={meta.prompt} onChange={set("prompt")} placeholder="เช่น อยากไป Disneyland, มีเด็กเล็ก, ชอบอาหารญี่ปุ่น" />
          ), true)}
        </div>
        <div className="tp-row">
          <button type="button" className="tp-btn tp-btn-gold" onClick={suggest} disabled={pending}>
            {busy === "suggest" ? (aiEnabled ? "AI กำลังวางแผน… (ประมาณ 30 วินาที)" : "กำลังจัดแผน…") : `✨ ${aiEnabled ? "ให้ AI" : "ให้ระบบ"}เสนอ 3 แผน`}
          </button>
          <button type="button" className="tp-btn tp-btn-ghost" onClick={manual} disabled={pending}>
            ✍️ {plan ? "เริ่มวางใหม่เอง" : "วางแผนเอง"}
          </button>
          {!aiEnabled && <span className="tp-muted" style={{ fontSize: 12.5 }}>จัดแผนจากเที่ยวบิน ที่พัก และตั๋วที่มีขายจริง</span>}
        </div>
      </section>

      {/* 2. Suggested options */}
      {options && (
        <section id="tp-options" className="tp">
          <div className="tp-row" style={{ justifyContent: "space-between" }}>
            <h2 className="tp-title">เลือก 1 แผน</h2>
            <span className="tp-badge tp-badge-ai">{engine === "ai" ? "🤖 เสนอโดย Claude" : "⚙️ จัดอัตโนมัติจากข้อมูลในระบบ"}</span>
          </div>
          <div className="tp-options">
            {options.map((opt) => (
              <div key={opt.style} className={`tp-card tp-option tp-option--${opt.style}`}>
                <div className="tp-option-cover" style={{ backgroundImage: `url(${sized(coverOf(opt.days, meta.destination, opt.style), 700)})` }}>
                  <span className="tp-option-tag">{STYLE_TH[opt.style]}</span>
                </div>
                <div className="tp-thumbs">
                  {opt.days.flatMap((d) => d.items).filter((i) => i.ref_id != null).slice(0, 4).map((i, k) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={k} src={sized(imageOf(i), 160)} alt="" title={i.title} />
                  ))}
                </div>
                <div className="tp-plan-title">{opt.title}</div>
                <p className="tp-summary">{opt.summary}</p>
                <ol className="tp-days">
                  {opt.days.map((d) => <li key={d.day}><span>วัน {d.day}</span> {d.title || `${d.items.length} รายการ`}</li>)}
                </ol>
                <div className="tp-option-foot">
                  <div>
                    <div className="tp-muted" style={{ fontSize: 12 }}>ประมาณการ</div>
                    <strong style={{ color: budget && opt.estimated_cost > budget ? "var(--danger)" : undefined }}>{baht(opt.estimated_cost)}</strong>
                  </div>
                  <button type="button" className="tp-btn tp-btn-navy" onClick={() => choose(opt)}>เลือกแผนนี้</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Day-by-day editor */}
      {plan && (
        <section id="tp-editor" className="tp">
          <div className="tp-card">
            <div className="tp-row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>แผนรายวัน</h2>
              <span className={`tp-badge ${source === "ai" ? "tp-badge-ai" : "tp-badge-own"}`}>
                {source === "ai" ? `🤖 AI เสนอ${style ? ` · ${STYLE_TH[style]}` : ""}` : "✍️ วางเอง"}
              </span>
            </div>
            <div className="tp-grid" style={{ marginTop: 14 }}>
              {field("title", "ชื่อแผน *", <input className="tp-input" value={meta.title} onChange={set("title")} maxLength={150} placeholder="เช่น โตเกียว 3 วัน 2 คืน" />, true)}
              <label className="tp-field tp-wide">
                <span>สรุปแผน</span>
                <textarea className="tp-input" rows={2} value={plan.summary} onChange={(e) => setPlan((p) => ({ ...p, summary: e.target.value }))} />
              </label>
            </div>
          </div>

          {plan.days.map((d, di) => (
            <div key={di} className="tp-card tp-day">
              <div className="tp-day-head">
                <div className="tp-day-num">วัน<br /><strong>{di + 1}</strong></div>
                <input className="tp-input" type="date" value={d.date ?? ""} onChange={(e) => updateDay(di, { date: e.target.value })} style={{ maxWidth: 170 }} />
                <input className="tp-input" value={d.title} onChange={(e) => updateDay(di, { title: e.target.value })} placeholder="หัวข้อของวัน เช่น Tokyo Disneyland ทั้งวัน" />
                <button type="button" className="tp-btn-text tp-danger" onClick={() => removeDay(di)} title="ลบวันนี้">ลบวัน</button>
              </div>

              <div className="tp-timeline">
                {d.items.length === 0 && <div className="tp-muted" style={{ padding: "8px 0" }}>ยังไม่มีรายการ — เพิ่มจากเมนูด้านล่าง</div>}
                {d.items.map((it, ii) => (
                  <div key={ii} className={`tp-item tp-item--${it.type}`}>
                    <span className="tp-item-photo" title={TYPES[it.type]?.label} style={{ backgroundImage: `url(${sized(imageOf(it), 160)})` }}>
                      <span>{TYPES[it.type]?.icon}</span>
                    </span>
                    <input className="tp-input tp-item-time" type="time" value={it.time} onChange={(e) => updateItem(di, ii, { time: e.target.value })} />
                    <div className="tp-item-body">
                      <input className="tp-input" value={it.title} readOnly={it.ref_id != null} onChange={(e) => updateItem(di, ii, { title: e.target.value })} placeholder="ชื่อกิจกรรม" />
                      <input className="tp-input tp-item-note" value={it.note} onChange={(e) => updateItem(di, ii, { note: e.target.value })} placeholder="หมายเหตุ" />
                    </div>
                    <div className="tp-item-cost">
                      {it.ref_id != null
                        ? <strong>{baht(it.cost)}</strong>
                        : <input className="tp-input" type="number" min="0" value={it.cost || ""} placeholder="0" onChange={(e) => updateItem(di, ii, { cost: Number(e.target.value) || 0 })} title="ค่าใช้จ่ายโดยประมาณ" />}
                    </div>
                    <div className="tp-item-actions">
                      <button type="button" className="tp-btn-text" onClick={() => moveItem(di, ii, -1)} aria-label="เลื่อนขึ้น">↑</button>
                      <button type="button" className="tp-btn-text" onClick={() => moveItem(di, ii, 1)} aria-label="เลื่อนลง">↓</button>
                      <button type="button" className="tp-btn-text tp-danger" onClick={() => removeItem(di, ii)} aria-label="ลบ">×</button>
                    </div>
                  </div>
                ))}
              </div>

              <select className="tp-input tp-add" value="" onChange={(e) => addItem(di, e.target.value)}>
                <option value="">+ เพิ่มรายการในวัน {di + 1}…</option>
                <optgroup label="กิจกรรมทั่วไป">
                  {["activity", "food", "transport"].map((t) => <option key={t} value={t}>{TYPES[t].icon} {TYPES[t].label} (พิมพ์เอง)</option>)}
                </optgroup>
                {["flight", "hotel", "event"].map((t) => (
                  <optgroup key={t} label={`${TYPES[t].label}ที่มีขายใน ${meta.destination || "—"}`}>
                    {inCity[t].length === 0 && <option disabled>ไม่มีใน {meta.destination || "เมืองนี้"}</option>}
                    {inCity[t].map((r) => (
                      <option key={r.id} value={`${t}:${r.id}`}>
                        {TYPES[t].icon} {r.label}{t === "flight" ? ` · ${r.depart_at.slice(0, 16)}` : ""} · {baht(r.price)}{t === "hotel" ? "/คืน" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ))}

          <button type="button" className="tp-btn tp-btn-ghost" onClick={addDay} style={{ justifySelf: "start" }}>+ เพิ่มวัน</button>

          <div className="tp-savebar">
            <div>
              <div className="tp-muted" style={{ fontSize: 12 }}>ค่าใช้จ่ายโดยประมาณ ({travelers} คน)</div>
              <strong className="tp-total" style={{ color: budget && total > budget ? "var(--danger)" : undefined }}>{baht(total)}</strong>
              {budget > 0 && (
                <span className="tp-muted" style={{ fontSize: 13 }}>
                  {" "}/ งบ {baht(budget)} {total > budget ? `· เกินงบ ${baht(total - budget)}` : `· เหลือ ${baht(budget - total)}`}
                </span>
              )}
            </div>
            <div className="tp-row">
              {renderExtra?.(plan, meta, catalog)}
              <button type="button" className="tp-btn tp-btn-navy" onClick={save} disabled={pending}>{busy === "save" ? "กำลังบันทึก…" : saveLabel}</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
