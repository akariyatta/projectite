"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import ConfirmDialog from "./ConfirmDialog";

const FormErrors = createContext({ errors: {}, clear: () => {} });

// Thai message for a browser validity failure (we turn off the browser's own English bubbles)
function messageFor(el, label) {
  const v = el.validity;
  if (v.valueMissing) {
    if (el.type === "date") return `กรุณาเลือกวันที่${label}`;
    if (el.type === "datetime-local") return `กรุณาเลือกวันและเวลา${label}`;
    return `กรุณา${el.tagName === "SELECT" ? "เลือก" : "กรอก"}${label}`;
  }
  if (v.badInput) return "กรุณากรอกเป็นตัวเลข";
  if (v.typeMismatch) return el.type === "email" ? "รูปแบบอีเมลไม่ถูกต้อง" : "กรุณาใส่ลิงก์ที่ขึ้นต้นด้วย https://";
  if (v.rangeUnderflow) return `ต้องไม่น้อยกว่า ${el.min}`;
  if (v.rangeOverflow) return `ต้องไม่เกิน ${el.max}`;
  if (v.stepMismatch) return "ทศนิยมได้ไม่เกิน 2 ตำแหน่ง";
  if (v.tooShort) return `ต้องมีอย่างน้อย ${el.minLength} ตัวอักษร`;
  if (v.tooLong) return `ยาวได้ไม่เกิน ${el.maxLength} ตัวอักษร`;
  if (v.patternMismatch) return el.title || "รูปแบบไม่ถูกต้อง";
  return "ข้อมูลไม่ถูกต้อง";
}

/**
 * Create/edit form. Validates in the browser with Thai messages, then calls the
 * server action directly (so typed values survive a server-side error).
 * `action(formData)` returns { error, fieldErrors } on failure or redirects on success.
 */
export default function AdminForm({ action, cancelHref, children }) {
  const [errors, setErrors] = useState({});
  const [summary, setSummary] = useState(null);
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const dirty = useRef(false);
  const form = useRef(null);
  const router = useRouter();

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    const warn = (e) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function focusFirst(names) {
    const el = form.current.querySelector(names.map((n) => `[name="${n}"]`).join(","));
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  }

  function show(fieldErrors, message) {
    const names = Object.keys(fieldErrors ?? {});
    setErrors(fieldErrors ?? {});
    setSummary(message ?? (names.length ? `กรุณากรอกข้อมูลให้ครบถ้วน (${names.length} ช่อง)` : null));
    if (names.length) focusFirst(names);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onSubmit(e) {
    e.preventDefault();
    const found = {};
    for (const el of form.current.elements) {
      if (!el.name || el.type === "hidden") continue;
      // Browsers only enforce minlength on user-typed values, so check it ourselves too
      const short = el.minLength > 0 && el.value && el.value.length < el.minLength;
      if (el.validity.valid && !short) continue;
      found[el.name] ??= el.validity.valid
        ? `ต้องมีอย่างน้อย ${el.minLength} ตัวอักษร`
        : messageFor(el, el.closest("[data-label]")?.dataset.label ?? "");
    }
    if (Object.keys(found).length) return show(found);

    const data = new FormData(form.current);
    startTransition(async () => {
      const res = await action(data);
      if (res) show(res.fieldErrors, res.error);
      else dirty.current = false;
    });
  }

  function clear(name) {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      if (!Object.keys(next).length) setSummary(null);
      return next;
    });
  }

  return (
    <FormErrors.Provider value={{ errors, clear }}>
      <form ref={form} noValidate onSubmit={onSubmit} onInput={() => (dirty.current = true)} className="adm-card adm-form">
        {summary && (
          <div className="adm-alert adm-alert-error" role="alert">
            <strong>⚠ {summary}</strong>
            {Object.keys(errors).length > 0 && <span> — ช่องที่ต้องแก้ไขมีกรอบสีแดง</span>}
          </div>
        )}
        {children}
        <div className="adm-row">
          <button className="adm-btn" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</button>
          <Link
            href={cancelHref}
            className="adm-btn-ghost"
            onClick={(e) => { if (dirty.current) { e.preventDefault(); setLeaving(true); } }}
          >
            ยกเลิก
          </Link>
        </div>
      </form>
      <ConfirmDialog
        open={leaving}
        title="ออกโดยไม่บันทึก?"
        message="ข้อมูลที่แก้ไขไว้จะหายไป"
        confirmLabel="ออกจากหน้านี้"
        danger
        onCancel={() => setLeaving(false)}
        onConfirm={() => { dirty.current = false; router.push(cancelHref); }}
      />
    </FormErrors.Provider>
  );
}

/** One labelled input. Shows the field's error (from AdminForm) or its hint. */
export function Field({ name, label, required, hint, suffix, wide, children }) {
  const { errors, clear } = useContext(FormErrors);
  const error = errors[name];
  return (
    <label
      className={`adm-field ${wide ? "adm-field-wide" : ""} ${error ? "has-error" : ""}`}
      data-label={label.replace(/\s*\(.*\)$/, "")}
      onInput={() => clear(name)}
      onChange={() => clear(name)}
    >
      <span>{label} {required && <span className="adm-req">*</span>}</span>
      {suffix ? (
        <div className="adm-input-wrap">
          {children}
          <span className="adm-suffix">{suffix}</span>
        </div>
      ) : children}
      {error ? <small className="adm-field-error">{error}</small> : hint && <small className="adm-hint">{hint}</small>}
    </label>
  );
}
