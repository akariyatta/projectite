import { headers } from "next/headers";
import { query } from "./db";

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

/** Columns that changed between two rows → { column: [before, after] }. Secrets are masked. */
export function diff(before = {}, after = {}) {
  const out = {};
  for (const key of Object.keys(after)) {
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    if (String(a) === String(b)) continue;
    out[key] = key === "password_hash" ? ["••••", "(เปลี่ยนใหม่)"] : [a, b];
  }
  return out;
}

/** Write one audit entry. Never throws — logging must not break the action itself. */
export async function logAudit(admin, action, entity, entityId, summary, changes = null) {
  try {
    await query(
      "INSERT INTO audit_logs (admin_id, admin_name, action, entity, entity_id, summary, changes, ip) VALUES (?,?,?,?,?,?,?,?)",
      [
        admin?.id ?? null,
        admin?.name ?? "system",
        action,
        entity,
        entityId ?? null,
        String(summary).slice(0, 255),
        changes && Object.keys(changes).length ? JSON.stringify(changes) : null,
        await clientIp(),
      ],
    );
  } catch (e) {
    console.error("audit log failed:", e);
  }
}
