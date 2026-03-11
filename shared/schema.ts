import { pgTable, serial, varchar, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  hasPaid: boolean("has_paid").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const presets = pgTable("presets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  quizState: jsonb("quiz_state").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedResults = pgTable("saved_results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  roleKeywords: text("role_keywords"),
  jobCount: integer("job_count").notNull().default(0),
  jobs: jsonb("jobs").notNull(),
  resumeText: text("resume_text"),
  quizSnapshot: jsonb("quiz_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull().default("discount"),
  value: integer("value").notNull().default(0),
  maxUses: integer("max_uses").notNull().default(0),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  comment: text("comment"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminLogs = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 50 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  details: jsonb("details"),
  ip: varchar("ip", { length: 45 }),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Preset = typeof presets.$inferSelect;
export type InsertPreset = typeof presets.$inferInsert;
export type SavedResult = typeof savedResults.$inferSelect;
export type InsertSavedResult = typeof savedResults.$inferInsert;
export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = typeof promoCodes.$inferInsert;
export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertAdminLog = typeof adminLogs.$inferInsert;
export const visits = pgTable("visits", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  userId: integer("user_id"),
  ip: varchar("ip", { length: 45 }),
  userAgent: text("user_agent"),
  path: varchar("path", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type Visit = typeof visits.$inferSelect;
