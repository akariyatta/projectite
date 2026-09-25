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
