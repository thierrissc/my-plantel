import pg from "pg";
const { Pool } = pg;

const DEFAULT_DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "postgresql://neondb_owner:npg_DNKibx1St8MQ@ep-flat-feather-b56k68hu-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

let pool = null;
let initialized = false;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: DEFAULT_DATABASE_URL,
      ssl: DEFAULT_DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function ensureTablesExist() {
  const p = getPool();
  if (!p || initialized) return;

  const client = await p.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS plantel_users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_plantel_users_email ON plantel_users(email);

      CREATE TABLE IF NOT EXISTS plantel_workspaces (
        user_id VARCHAR(64) PRIMARY KEY REFERENCES plantel_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        animais JSONB NOT NULL DEFAULT '[]',
        areas JSONB NOT NULL DEFAULT '["Todos"]',
        theme VARCHAR(32) DEFAULT 'light',
        version BIGINT DEFAULT 1,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    initialized = true;
  } finally {
    client.release();
  }
}

export async function query(sql, params = []) {
  const p = getPool();
  await ensureTablesExist();
  const client = await p.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}
