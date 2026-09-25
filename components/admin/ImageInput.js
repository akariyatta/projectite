"use client";

import { useRef, useState } from "react";

/**
 * Image field: upload from the computer (click or drag & drop) or paste a URL.
 * The chosen image's URL is what gets submitted under `name`.
 */
export default function ImageInput({ name, defaultValue = "", maxLength }) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [over, setOver] = useState(false);
  const [broken, setBroken] = useState(false);
  const picker = useRef(null);
  const field = useRef(null);

  // Let AdminForm know the value changed (marks the form dirty, clears this field's error)
  function commit(next) {
    setUrl(next);
    setBroken(false);
    requestAnimationFrame(() => field.current?.dispatchEvent(new Event("input", { bubbles: true })));
  }

  async function upload(file) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("กรุณาเลือกไฟล์รูปภาพ");
    if (file.size > 5 * 1024 * 1024) return setError("ไฟล์ใหญ่เกิน 5 MB");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/admin/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      commit(data.url);
    } catch (e) {
      setError(e.message || "อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
      picker.current.value = "";
    }
  }

  return (
    <div className="adm-image">
      <div
        className={`adm-drop ${over ? "is-over" : ""} ${url && !broken ? "has-image" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => picker.current.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), picker.current.click())}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files[0]); }}
      >
        {url && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" onError={() => setBroken(true)} />
        ) : (
          <div className="adm-drop-empty">
            <div className="adm-drop-icon">🖼️</div>
            <strong>{broken ? "เปิดรูปจากลิงก์นี้ไม่ได้" : "คลิกหรือลากรูปมาวางที่นี่"}</strong>
            <span>JPG, PNG, WebP หรือ GIF · ไม่เกิน 5 MB</span>
          </div>
        )}
        {busy && <div className="adm-drop-busy">กำลังอัปโหลด…</div>}
      </div>

      <input
        ref={picker}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => upload(e.target.files[0])}
      />

      <div className="adm-row" style={{ flexWrap: "nowrap" }}>
        <input
          ref={field}
          name={name}
          value={url}
          maxLength={maxLength}
          onChange={(e) => { setUrl(e.target.value.trim()); setBroken(false); }}
          placeholder="หรือวางลิงก์รูป https://…"
          className="adm-input"
          autoComplete="off"
        />
        <button type="button" className="adm-btn-ghost" onClick={() => picker.current.click()} disabled={busy}>
          เลือกไฟล์
        </button>
        {url && (
          <button type="button" className="adm-btn-text adm-btn-danger" onClick={() => commit("")}>
            ลบรูป
          </button>
        )}
      </div>
      {error && <small className="adm-field-error">{error}</small>}
    </div>
  );
}
