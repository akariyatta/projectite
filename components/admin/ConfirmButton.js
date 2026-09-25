"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import ConfirmDialog from "./ConfirmDialog";

/** Delete button: asks in a themed dialog, then submits the surrounding <form>. */
export default function ConfirmButton({ title = "ยืนยันการลบ?", message = "ข้อมูลที่ลบแล้วจะกู้คืนไม่ได้", className, children }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const { pending } = useFormStatus();

  return (
    <>
      <button ref={btn} type="button" className={className} disabled={pending} onClick={() => setOpen(true)}>
        {pending ? "กำลังลบ…" : children}
      </button>
      <ConfirmDialog
        open={open}
        danger
        title={title}
        message={message}
        confirmLabel="ลบ"
        onCancel={() => setOpen(false)}
        onConfirm={() => { setOpen(false); btn.current.form.requestSubmit(); }}
      />
    </>
  );
}
