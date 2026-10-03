import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";

// Customer sessions for the public site — separate cookie and signing prefix from the admin session,
// so a customer cookie can never be replayed as an admin one.
// Cookie = "<userId>.<sessionVersion>.<expiresAt>.<hmac>"; bumping users.session_version
// (password change / reset) logs that customer out on every other device.
const COOKIE = "customer_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const sign = (value) => createHmac("sha256", process.env.SESSION_SECRET).update(`customer:${value}`).digest("hex");

export async function createCustomerSession(userId, version = 1) {
  const value = `${userId}.${version}.${Date.now() + MAX_AGE * 1000}`;
  (await cookies()).set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function destroyCustomerSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in customer ({ id, name, email, phone, session_version }) or null. */
export async function getCustomer() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, version, exp, sig] = raw.split(".");
  const expected = Buffer.from(sign(`${id}.${version}.${exp}`));
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), expected)) return null;
  if (Number(exp) < Date.now()) return null;
  const [user] = await query(
    "SELECT id, name, email, phone, session_version FROM users WHERE id = ? AND status = 'active'",
    [Number(id)],
  );
  if (!user || user.session_version !== Number(version)) return null;
  return user;
}

/** For pages that need a signed-in customer; sends others to /signin and back afterwards. */
export async function requireCustomer(next = "/bookings") {
  const user = await getCustomer();
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return user;
}
