"use client";

import { useFormStatus } from "react-dom";

/** Submit button for plain server-action forms: disables itself while saving. */
export default function SubmitButton({ className = "adm-btn", pendingText = "กำลังบันทึก…", style, children }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} style={style} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
