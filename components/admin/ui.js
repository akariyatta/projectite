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
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className="adm-thumb" />;
  return <div className="adm-thumb">{String(name ?? "?").charAt(0)}</div>;
}

export function Stars({ n }) {
  return <span className="adm-stars">{"★".repeat(Number(n) || 0)}</span>;
}
