import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sign(value) {
  return createHmac("sha256", process.env.SESSION_SECRET).update(value).digest("hex");
}

export async function createSession(userId) {
  const value = `${userId}.${Date.now() + MAX_AGE * 1000}`;
  (await cookies()).set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Returns the logged-in admin ({ id, name, email }) or null. */
export async function getAdmin() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  const expected = Buffer.from(sign(`${id}.${exp}`));
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), expected)) return null;
  if (Number(exp) < Date.now()) return null;
  const [user] = await query(
    "SELECT id, name, email FROM admins WHERE id = ? AND status = 'active'",
    [Number(id)],
  );
  return user ?? null;
}

/** Call at the top of every admin page and server action. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return admin;
}
