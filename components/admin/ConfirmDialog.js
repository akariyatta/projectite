"use client";

import { useEffect, useRef } from "react";

/** Themed replacement for window.confirm(). Esc or backdrop click cancels. */
export default function ConfirmDialog({ open, title, message, confirmLabel = "ยืนยัน", danger, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dlg = ref.current;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="adm-dialog"
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      onClick={(e) => e.target === ref.current && onCancel()}
    >
      <div className="adm-dialog-body">
        <div className={`adm-dialog-icon ${danger ? "is-danger" : ""}`}>{danger ? "!" : "?"}</div>
        <h3>{title}</h3>
        {message && <p>{message}</p>}
        <div className="adm-dialog-actions">
          <button type="button" className="adm-btn-ghost" onClick={onCancel} autoFocus>ยกเลิก</button>
          <button type="button" className={danger ? "adm-btn adm-btn-red" : "adm-btn"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
