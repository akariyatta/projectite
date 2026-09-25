import mysql from "mysql2/promise";

// Reuse one pool across hot reloads in dev
const pool = (globalThis.mysqlPool ??= mysql.createPool({
  uri: process.env.DATABASE_URL,
  dateStrings: true, // DATE/DATETIME come back as "YYYY-MM-DD HH:mm:ss"
  connectionLimit: 5,
}));

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Run several queries atomically: fn(q) gets a query function bound to one connection.
 * Throwing inside fn rolls everything back.
 */
export async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(async (sql, params = []) => (await conn.query(sql, params))[0]);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
