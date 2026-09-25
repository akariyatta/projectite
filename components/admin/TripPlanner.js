"use client";

import { useMemo, useState, useTransition } from "react";
import { saveTripPlan, suggestTripPlans } from "@/lib/actions";
import { baht } from "@/lib/format";

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

export default function TripPlanner({ id, initial, customers, catalog, aiEnabled }) {
  const [meta, setMeta] = useState({
    user_id: initial?.user_id ?? "",
    title: initial?.title ?? "",
    destination: initial?.destination ?? "",
    start_date: initial?.start_date ?? "",
    end_date: initial?.end_date ?? "",
    travelers: initial?.travelers ?? 1,
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

  function costOf(type, ref) {
    if (type === "hotel") return ref.price * nights * Math.ceil(travelers / ref.capacity);
    return ref.price * travelers;
  }

  function showErrors(res) {
    setErrors(res.fieldErrors ?? {});
    setMessage(res.error ? { type: "error", text: res.error } : null);
    if (res.fieldErrors && Object.keys(res.fieldErrors).length) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function suggest() {
    setBusy("suggest");
    setMessage(null);
    start(async () => {
      const res = await suggestTripPlans(meta);
      setBusy(null);
      if (res.error) return showErrors(res);
      setErrors({});
      setOptions(res.options);
      setEngine(res.engine);
      if (res.notice) setMessage({ type: "error", text: res.notice });
    });
  }

  function choose(opt) {
    setPlan({ summary: opt.summary, days: opt.days });
    setSource("ai");
    setStyle(opt.style);
    if (!meta.title) setMeta((m) => ({ ...m, title: opt.title }));
    setOptions(null);
    requestAnimationFrame(() => document.getElementById("plan-editor")?.scrollIntoView({ behavior: "smooth" }));
  }

  function manual() {
    const days = blankDays(meta);
    if (!days.length) return showErrors({ error: "กรุณาเลือกวันเริ่มเดินทางก่อน", fieldErrors: { start_date: "กรุณาเลือกวันเริ่มเดินทาง" } });
    setPlan({ summary: "", days });
    setSource("customer");
    setStyle(null);
    setOptions(null);
  }

  function save() {
    setBusy("save");
    start(async () => {
      const res = await saveTripPlan(id, { ...meta, plan, source, style });
      setBusy(null);
      if (res) showErrors(res);
    });
  }

  // ----- editor helpers -----
  const updateDay = (di, patch) => setPlan((p) => ({ ...p, days: p.days.map((d, i) => (i === di ? { ...d, ...patch } : d)) }));
  const updateItem = (di, ii, patch) =>
    updateDay(di, { items: plan.days[di].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
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
      item = { ...item, ref_id: ref.id, title: ref.label, cost: costOf(type, ref), time: type === "flight" ? ref.depart_at.slice(11, 16) : type === "hotel" ? "15:00" : "09:00", note: type === "hotel" ? `${nights} คืน` : "" };
    }
    updateDay(di, { items: [...plan.days[di].items, item] });
  }
  const addDay = () => setPlan((p) => ({ ...p, days: [...p.days, { day: p.days.length + 1, date: "", title: "", items: [] }] }));
  const removeDay = (di) => setPlan((p) => ({ ...p, days: p.days.filter((_, i) => i !== di) }));

  const field = (name, label, input, wide) => (
    <label className={`adm-field ${wide ? "adm-field-wide" : ""} ${errors[name] ? "has-error" : ""}`}>
      <span>{label}</span>
      {input}
      {errors[name] && <small className="adm-field-error">{errors[name]}</small>}
    </label>
  );

  return (
    <div className="adm-stack">
      {message && <div className={`adm-alert adm-alert-${message.type === "error" ? "error" : "ok"}`}>{message.text}</div>}

      {/* 1. Trip details */}
      <div className="adm-card adm-form">
        <h2 style={{ marginBottom: 0 }}>ข้อมูลการเดินทาง</h2>
        <div className="adm-form-grid">
          {field("user_id", "ลูกค้า *", (
            <select className="adm-input" value={meta.user_id} onChange={set("user_id")}>
              <option value="">— เลือกลูกค้า —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          ))}
          {field("destination", "ปลายทาง *", (
            <select className="adm-input" value={meta.destination} onChange={set("destination")}>
              <option value="">— เลือกเมือง —</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ))}
          {field("start_date", "วันเริ่มเดินทาง *", <input type="date" className="adm-input" value={meta.start_date} onChange={set("start_date")} />)}
          {field("end_date", "วันกลับ *", <input type="date" className="adm-input" value={meta.end_date} min={meta.start_date} onChange={set("end_date")} />)}
          {field("travelers", "จำนวนผู้เดินทาง", <input type="number" min="1" max="20" className="adm-input" value={meta.travelers} onChange={set("travelers")} />)}
          {field("budget", "งบประมาณรวม (บาท)", <input type="number" min="0" step="100" className="adm-input" value={meta.budget} onChange={set("budget")} placeholder="ไม่ระบุก็ได้" />)}
          {field("prompt", "คำขอพิเศษของลูกค้า", (
            <textarea className="adm-input" rows={2} value={meta.prompt} onChange={set("prompt")} placeholder="เช่น อยากไป Disneyland, มีเด็กเล็ก, ชอบอาหารญี่ปุ่น" />
          ), true)}
        </div>
        <div className="adm-row">
          <button type="button" className="adm-btn adm-btn-gold" onClick={suggest} disabled={pending}>
            {busy === "suggest" ? (aiEnabled ? "AI กำลังวางแผน… (ประมาณ 30 วินาที)" : "กำลังจัดแผน…") : `✨ ${aiEnabled ? "ให้ AI" : "ให้ระบบ"}เสนอ 3 แผน`}
          </button>
          <button type="button" className="adm-btn-ghost" onClick={manual} disabled={pending}>
            ✍️ {plan ? "เริ่มวางใหม่เอง" : "วางแผนเอง"}
          </button>
          {!aiEnabled && <span className="adm-muted" style={{ fontSize: 12.5 }}>ยังไม่ได้เชื่อม AI — ระบบจัดแผนจากเที่ยวบิน/โรงแรม/ตั๋วที่มีขาย</span>}
        </div>
      </div>

      {/* 2. Suggested options */}
      {options && (
        <div className="adm-stack">
          <div className="adm-row" style={{ justifyContent: "space-between" }}>
            <h2 className="adm-serif" style={{ fontSize: 22, color: "var(--navy)" }}>เลือก 1 แผน</h2>
            <span className="adm-badge adm-badge--confirmed">{engine === "ai" ? "🤖 เสนอโดย Claude" : "⚙️ จัดอัตโนมัติจากข้อมูลในระบบ"}</span>
          </div>
          <div className="adm-plan-grid">
            {options.map((opt) => (
              <div key={opt.style} className={`adm-card adm-option adm-option--${opt.style}`}>
                <span className="adm-option-tag">{STYLE_TH[opt.style]}</span>
                <div className="adm-plan-title">{opt.title}</div>
                <p className="adm-plan-summary">{opt.summary}</p>
                <ol className="adm-plan-days">
                  {opt.days.map((d) => <li key={d.day}><span>วัน {d.day}</span> {d.title || `${d.items.length} รายการ`}</li>)}
                </ol>
                <div className="adm-plan-foot">
                  <div>
                    <div className="adm-muted" style={{ fontSize: 12 }}>ประมาณการ</div>
                    <strong style={{ color: budget && opt.estimated_cost > budget ? "var(--danger)" : undefined }}>{baht(opt.estimated_cost)}</strong>
                  </div>
                  <button type="button" className="adm-btn" onClick={() => choose(opt)}>เลือกแผนนี้</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Day-by-day editor */}
      {plan && (
        <div id="plan-editor" className="adm-stack">
          <div className="adm-card adm-form">
            <div className="adm-row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ marginBottom: 0 }}>แผนรายวัน</h2>
              <span className={`adm-badge adm-badge--${source === "ai" ? "confirmed" : "pending"}`}>
                {source === "ai" ? `🤖 AI เสนอ${style ? ` · ${STYLE_TH[style]}` : ""}` : "✍️ วางเอง"}
              </span>
            </div>
            {field("title", "ชื่อแผน *", <input className="adm-input" value={meta.title} onChange={set("title")} maxLength={150} placeholder="เช่น โตเกียว 3 วัน 2 คืน" />, true)}
            <label className="adm-field">
              <span>สรุปแผน</span>
              <textarea className="adm-input" rows={2} value={plan.summary} onChange={(e) => setPlan((p) => ({ ...p, summary: e.target.value }))} />
            </label>
          </div>

          {plan.days.map((d, di) => (
            <div key={di} className="adm-card adm-day">
              <div className="adm-day-head">
                <div className="adm-day-num">วัน<br /><strong>{di + 1}</strong></div>
                <input className="adm-input" type="date" value={d.date ?? ""} onChange={(e) => updateDay(di, { date: e.target.value })} style={{ maxWidth: 170 }} />
                <input className="adm-input" value={d.title} onChange={(e) => updateDay(di, { title: e.target.value })} placeholder="หัวข้อของวัน เช่น Tokyo Disneyland ทั้งวัน" />
                <button type="button" className="adm-btn-text adm-btn-danger" onClick={() => removeDay(di)} title="ลบวันนี้">ลบวัน</button>
              </div>

              <div className="adm-timeline">
                {d.items.length === 0 && <div className="adm-muted" style={{ padding: "8px 0" }}>ยังไม่มีรายการ — เพิ่มจากเมนูด้านล่าง</div>}
                {d.items.map((it, ii) => (
                  <div key={ii} className={`adm-tl-item adm-tl--${it.type}`}>
                    <span className="adm-tl-icon" title={TYPES[it.type]?.label}>{TYPES[it.type]?.icon}</span>
                    <input className="adm-input adm-tl-time" type="time" value={it.time} onChange={(e) => updateItem(di, ii, { time: e.target.value })} />
                    <div className="adm-tl-body">
                      <input className="adm-input" value={it.title} readOnly={it.ref_id != null} onChange={(e) => updateItem(di, ii, { title: e.target.value })} placeholder="ชื่อกิจกรรม" />
                      <input className="adm-input adm-tl-note" value={it.note} onChange={(e) => updateItem(di, ii, { note: e.target.value })} placeholder="หมายเหตุ" />
                    </div>
                    <div className="adm-tl-cost">
                      {it.ref_id != null
                        ? <strong>{baht(it.cost)}</strong>
                        : <input className="adm-input" type="number" min="0" value={it.cost || ""} placeholder="0" onChange={(e) => updateItem(di, ii, { cost: Number(e.target.value) || 0 })} title="ค่าใช้จ่ายโดยประมาณ" />}
                    </div>
                    <div className="adm-tl-actions">
                      <button type="button" className="adm-btn-text" onClick={() => moveItem(di, ii, -1)} aria-label="เลื่อนขึ้น">↑</button>
                      <button type="button" className="adm-btn-text" onClick={() => moveItem(di, ii, 1)} aria-label="เลื่อนลง">↓</button>
                      <button type="button" className="adm-btn-text adm-btn-danger" onClick={() => removeItem(di, ii)} aria-label="ลบ">×</button>
                    </div>
                  </div>
                ))}
              </div>

              <select className="adm-input adm-add" value="" onChange={(e) => addItem(di, e.target.value)}>
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

          <button type="button" className="adm-btn-ghost" onClick={addDay} style={{ justifySelf: "start" }}>+ เพิ่มวัน</button>

          {/* Save bar */}
          <div className="adm-savebar">
            <div>
              <div className="adm-muted" style={{ fontSize: 12 }}>ค่าใช้จ่ายโดยประมาณ ({travelers} คน)</div>
              <strong className="adm-serif" style={{ fontSize: 22, color: budget && total > budget ? "var(--danger)" : "var(--navy)" }}>{baht(total)}</strong>
              {budget > 0 && (
                <span className="adm-muted" style={{ fontSize: 13 }}>
                  {" "}/ งบ {baht(budget)} {total > budget ? `· เกินงบ ${baht(total - budget)}` : `· เหลือ ${baht(budget - total)}`}
                </span>
              )}
            </div>
            <button type="button" className="adm-btn" onClick={save} disabled={pending}>{busy === "save" ? "กำลังบันทึก…" : "บันทึกแผน"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
