"use client";

export default function ConfirmButton({ message = "ยืนยันการลบ?", className, children }) {
  return (
    <button className={className} onClick={(e) => !confirm(message) && e.preventDefault()}>
      {children}
    </button>
  );
}
