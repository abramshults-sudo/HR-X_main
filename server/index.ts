import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db.js";
import { authRouter } from "./auth.js";
import { apiRouter } from "./routes.js";
import { adminRouter } from "./admin.js";
import { vacancyRouter } from "./vacancyCache.js";
import { aiRouter } from "./ai.js";
import { db } from "./db.js";
import { sql } from "drizzle-orm";

const PgStore = connectPgSimple(session);

const app = express();
const PORT = parseInt(process.env.API_PORT || "3001", 10);
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET environment variable is required");
  process.exit(1);
}

app.use(express.json({ limit: "2mb" }));

app.use(
  session({
    store: new PgStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "hrx.sid",
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    },
  })
);

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/vacancies", vacancyRouter);
app.use("/api/ai", aiRouter);
app.use("/api", apiRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function initDb() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      has_paid BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS has_paid BOOLEAN NOT NULL DEFAULT false
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS presets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      quiz_state JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS saved_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      role_keywords TEXT,
      job_count INTEGER NOT NULL DEFAULT 0,
      jobs JSONB NOT NULL,
      resume_text TEXT,
      quiz_snapshot JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'discount',
      value INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 0,
      used_count INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true,
      comment TEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS comment TEXT
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id SERIAL PRIMARY KEY,
      category VARCHAR(50) NOT NULL,
      action VARCHAR(255) NOT NULL,
      details JSONB,
      ip VARCHAR(45),
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vacancy_cache (
      id SERIAL PRIMARY KEY,
      cache_key VARCHAR(64) UNIQUE NOT NULL,
      search_params JSONB NOT NULL,
      hh_items JSONB NOT NULL DEFAULT '[]',
      tv_items JSONB NOT NULL DEFAULT '[]',
      hh_count INTEGER NOT NULL DEFAULT 0,
      tv_count INTEGER NOT NULL DEFAULT 0,
      cached_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  console.log("Database tables initialized");
}

initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
