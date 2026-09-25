"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Shows ?ok=… (green) or ?error=… (red) as a toast, then removes the param
 * from the URL so a refresh doesn't show it again. Server actions set these via redirect.
 */
export default function Toast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [toast, setToast] = useState(null);

  const ok = params.get("ok");
  const error = params.get("error");

  // Pick up a new message from the URL
  if ((ok || error) && toast?.text !== (ok ?? error)) {
    setToast({ type: ok ? "ok" : "error", text: ok ?? error });
  }

  useEffect(() => {
    if (!ok && !error) return;
    const rest = new URLSearchParams(params);
    rest.delete("ok");
    rest.delete("error");
    router.replace(pathname + (rest.size ? `?${rest}` : ""), { scroll: false });
  }, [ok, error, params, pathname, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.type === "ok" ? 3500 : 7000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className={`adm-toast adm-toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
      <span className="adm-toast-icon">{toast.type === "ok" ? "✓" : "!"}</span>
      <span className="adm-toast-text">{toast.text}</span>
      <button type="button" className="adm-toast-close" onClick={() => setToast(null)} aria-label="ปิด">×</button>
    </div>
  );
}
