import { label } from "@/lib/format";

export function Badge({ value }) {
  return <span className={`adm-badge adm-badge--${value}`}>{label(value)}</span>;
}

export function Alert({ error, ok }) {
  if (error) return <div className="adm-alert adm-alert-error">{error}</div>;
  if (ok) return <div className="adm-alert adm-alert-ok">{ok}</div>;
  return null;
}

export function PageHead({ eyebrow, title, subtitle, children }) {
  return (
    <div className="adm-head">
      <div>
        {eyebrow && <div className="adm-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        <div className="adm-rule" />
      </div>
      {children && <div className="adm-row">{children}</div>}
    </div>
  );
}

export function Thumb({ src, name }) {
  // Unsplash resizes on the fly — ask for a small version for the 64px thumbnail
  const small = src?.includes("images.unsplash.com") ? src.replace(/([?&])w=\d+/, "$1w=160") : src;
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={small} alt="" className="adm-thumb" loading="lazy" />;
  return <div className="adm-thumb">{String(name ?? "?").charAt(0)}</div>;
}

export function Stars({ n }) {
  return <span className="adm-stars">{"★".repeat(Number(n) || 0)}</span>;
}
