"use client";

import { useActionState } from "react";

/**
 * Small form driven by a server action that returns { error, fieldErrors, values, sent }.
 * fields: [{ name, label, type?, autoComplete?, required?, defaultValue?, hint? }]
 */
export default function ActionForm({ action, fields, submit, hidden = {}, sentMessage, title, className = "st-card" }) {
  const [state, formAction, pending] = useActionState(action, null);
  const err = state?.fieldErrors ?? {};
  const v = state?.values ?? {};

  if (state?.sent && sentMessage) return <div className={className}><div className="st-alert st-alert-info">{sentMessage}</div></div>;

  return (
    <form action={formAction} className={className} style={{ display: "grid", gap: 14 }}>
      {title && <h2 style={{ margin: 0 }}>{title}</h2>}
      {Object.entries(hidden).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      {state?.error && <div className="st-alert st-alert-error">{state.error}</div>}
      {fields.map((f) => (
        <label key={f.name} className={`st-field ${err[f.name] ? "has-error" : ""}`}>
          <span>{f.label}</span>
          <input
            name={f.name}
            type={f.type ?? "text"}
            className="st-input"
            required={f.required}
            autoComplete={f.autoComplete}
            defaultValue={f.type === "password" ? undefined : v[f.name] ?? f.defaultValue ?? ""}
            maxLength={f.maxLength}
            placeholder={f.placeholder}
          />
          {err[f.name] ? <small className="st-error">{err[f.name]}</small> : f.hint && <small className="st-muted">{f.hint}</small>}
        </label>
      ))}
      <button className="st-btn" style={{ padding: 13 }} disabled={pending}>{pending ? "กำลังดำเนินการ…" : submit}</button>
    </form>
  );
}
