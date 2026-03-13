import { Router, Request, Response } from "express";
import crypto from "crypto";
import { db } from "./db.js";
import { promoCodes, adminLogs, appSettings, users, visits } from "../shared/schema.js";
import { eq, desc, sql, and, gt, gte } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
  }
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  if (!req.session.isAdmin) {
    res.status(403).json({ error: "Доступ запрещён" });
    return;
  }
  next();
}

export async function addLog(category: string, action: string, details?: any, ip?: string, userId?: number) {
  try {
    await db.insert(adminLogs).values({
      category,
      action,
      details: details || null,
      ip: ip || null,
      userId: userId || null,
    });
  } catch (err) {
    console.error("Failed to write admin log:", err);
  }
}

const adminRouter = Router();

adminRouter.post("/login", (req: Request, res: Response) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    res.status(500).json({ error: "Администрирование не настроено" });
    return;
  }

  if (!password || password !== adminPassword) {
    addLog("admin", "login_failed", { ip: req.ip });
    res.status(401).json({ error: "Неверный пароль" });
    return;
  }

  const userId = req.session.userId;
  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: "Ошибка сессии" });
      return;
    }
    req.session.isAdmin = true;
    if (userId) req.session.userId = userId;
    req.session.save(() => {
      addLog("admin", "login_success", { ip: req.ip });
      res.json({ ok: true });
    });
  });
});

adminRouter.post("/logout", requireAdmin, (req: Request, res: Response) => {
  req.session.isAdmin = false;
  req.session.save(() => {
    res.json({ ok: true });
  });
});

adminRouter.get("/check", (req: Request, res: Response) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

adminRouter.get("/logs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    let query = db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(limit).offset(offset);

    if (category) {
      query = db.select().from(adminLogs).where(eq(adminLogs.category, category)).orderBy(desc(adminLogs.createdAt)).limit(limit).offset(offset);
    }

    const logs = await query;
    res.json(logs);
  } catch (err) {
    console.error("Get logs error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

adminRouter.get("/user-count-public", async (req: Request, res: Response) => {
  try {
    const settings = await db.select().from(appSettings);
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    const mode = map["USER_COUNTER_MODE"] || "real";
    const demoValue = parseInt(map["USER_COUNTER_DEMO_VALUE"] || "0", 10);

    if (mode === "demo" && demoValue > 0) {
      res.json({ count: demoValue, mode: "demo" });
      return;
    }

    const [registeredUsers] = await db.select({ count: sql<number>`count(*)` }).from(users);
    let uniqueVisitors = 0;
    try {
      const visitResult = await db.execute(sql`SELECT count(DISTINCT session_id) as cnt FROM visits WHERE path = '/results' AND session_id IS NOT NULL`);
      uniqueVisitors = Number((visitResult as any).rows?.[0]?.cnt || (visitResult as any)[0]?.cnt || 0);
    } catch {}
    const totalUsers = Math.max(Number(registeredUsers.count), uniqueVisitors);
    res.json({ count: totalUsers, mode: "real" });
  } catch (err) {
    console.error("User count error:", err);
    res.json({ count: 0, mode: "real" });
  }
});

adminRouter.get("/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      [userCount], [promoCount], [logCount], [paidCount], paymentLogs,
      trafficAgg, [newUsersToday], [newUsersWeek], [newUsersMonth]
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(promoCodes).where(eq(promoCodes.active, true)),
      db.select({ count: sql<number>`count(*)` }).from(adminLogs),
      db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.hasPaid, true)),
      db.select({ count: sql<number>`count(*)` }).from(adminLogs).where(eq(adminLogs.category, "payment")),
      db.execute(sql`
        SELECT
          count(*) as total_views,
          count(*) FILTER (WHERE created_at >= ${today}) as today_views,
          count(*) FILTER (WHERE created_at >= ${weekAgo}) as week_views,
          count(*) FILTER (WHERE created_at >= ${monthAgo}) as month_views,
          count(DISTINCT session_id) as total_unique,
          count(DISTINCT session_id) FILTER (WHERE created_at >= ${today}) as today_unique,
          count(DISTINCT session_id) FILTER (WHERE created_at >= ${weekAgo}) as week_unique,
          count(DISTINCT session_id) FILTER (WHERE created_at >= ${monthAgo}) as month_unique,
          count(DISTINCT session_id) FILTER (WHERE created_at >= ${today} AND user_id > 0) as today_auth,
          count(DISTINCT session_id) FILTER (WHERE created_at >= ${weekAgo} AND user_id > 0) as week_auth,
          count(DISTINCT session_id) FILTER (WHERE created_at >= ${monthAgo} AND user_id > 0) as month_auth
        FROM visits
      `),
      db.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.createdAt, today)),
      db.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.createdAt, weekAgo)),
      db.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.createdAt, monthAgo)),
    ]);

    const t = (trafficAgg as any).rows?.[0] || trafficAgg[0] || {};

    res.json({
      users: Number(userCount.count),
      paidUsers: Number(paidCount.count),
      activePromos: Number(promoCount.count),
      totalLogs: Number(logCount.count),
      paymentEvents: Number(paymentLogs[0].count),
      traffic: {
        today: { views: Number(t.today_views || 0), unique: Number(t.today_unique || 0), auth: Number(t.today_auth || 0), guests: Number(t.today_unique || 0) - Number(t.today_auth || 0) },
        week: { views: Number(t.week_views || 0), unique: Number(t.week_unique || 0), auth: Number(t.week_auth || 0), guests: Number(t.week_unique || 0) - Number(t.week_auth || 0) },
        month: { views: Number(t.month_views || 0), unique: Number(t.month_unique || 0), auth: Number(t.month_auth || 0), guests: Number(t.month_unique || 0) - Number(t.month_auth || 0) },
        total: { views: Number(t.total_views || 0), unique: Number(t.total_unique || 0) },
      },
      newUsers: {
        today: Number(newUsersToday.count),
        week: Number(newUsersWeek.count),
        month: Number(newUsersMonth.count),
      },
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

adminRouter.get("/promos", requireAdmin, async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
    res.json(list);
  } catch (err) {
    console.error("Get promos error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

adminRouter.post("/promos", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { code, type, value, maxUses, expiresAt, comment } = req.body;

    const promoCode = code || crypto.randomBytes(4).toString("hex").toUpperCase();

    if (typeof promoCode !== "string" || promoCode.length > 50) {
      res.status(400).json({ error: "Некорректный код" });
      return;
    }

    const promoType = type || "discount";
    if (!["discount", "free_access", "bonus"].includes(promoType)) {
      res.status(400).json({ error: "Некорректный тип промокода" });
      return;
    }

    const [promo] = await db.insert(promoCodes).values({
      code: promoCode.toUpperCase(),
      type: promoType,
      value: parseInt(value) || 0,
      maxUses: parseInt(maxUses) || 0,
      active: true,
      comment: comment && typeof comment === "string" ? comment.trim().slice(0, 500) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();

    addLog("promo", "created", { code: promo.code, type: promoType, value: promo.value });
    res.json(promo);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Промокод с таким кодом уже существует" });
      return;
    }
    console.error("Create promo error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

adminRouter.patch("/promos/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Некорректный ID" });
      return;
    }

    const { active } = req.body;
    const [updated] = await db.update(promoCodes).set({ active: !!active }).where(eq(promoCodes.id, id)).returning();

    if (!updated) {
      res.status(404).json({ error: "Промокод не найден" });
      return;
    }

    addLog("promo", active ? "activated" : "deactivated", { code: updated.code });
    res.json(updated);
  } catch (err) {
    console.error("Update promo error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

adminRouter.delete("/promos/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Некорректный ID" });
      return;
    }

    const [deleted] = await db.delete(promoCodes).where(eq(promoCodes.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Промокод не найден" });
      return;
    }

    addLog("promo", "deleted", { code: deleted.code });
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete promo error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

adminRouter.get("/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await db.select().from(appSettings);
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    const keys = ["OPENAI_API_KEY", "YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY", "YANDEX_METRIKA_ID", "GOOGLE_ANALYTICS_ID", "USER_COUNTER_MODE", "USER_COUNTER_DEMO_VALUE"];
    const result: Record<string, string> = {};
    const plainKeys = ["YANDEX_METRIKA_ID", "GOOGLE_ANALYTICS_ID", "USER_COUNTER_MODE", "USER_COUNTER_DEMO_VALUE"];
    for (const k of keys) {
      const stored = map[k];
      const env = process.env[k];
      const val = stored || env || "";
      result[k] = val ? (plainKeys.includes(k) ? val : maskKey(val)) : "";
    }

    res.json(result);
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

adminRouter.put("/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    const allowedKeys = ["OPENAI_API_KEY", "YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY", "YANDEX_METRIKA_ID", "GOOGLE_ANALYTICS_ID", "USER_COUNTER_MODE", "USER_COUNTER_DEMO_VALUE"];

    if (!key || !allowedKeys.includes(key)) {
      res.status(400).json({ error: "Некорректный ключ настройки" });
      return;
    }

    if (typeof value !== "string" || value.length > 500) {
      res.status(400).json({ error: "Некорректное значение" });
      return;
    }

    if (key === "USER_COUNTER_MODE" && !["real", "demo"].includes(value)) {
      res.status(400).json({ error: "Допустимые значения: real, demo" });
      return;
    }
    if (key === "USER_COUNTER_DEMO_VALUE" && (isNaN(Number(value)) || Number(value) < 0)) {
      res.status(400).json({ error: "Значение должно быть числом ≥ 0" });
      return;
    }

    await db
      .insert(appSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });

    process.env[key] = value;

    addLog("settings", "key_updated", { key, masked: maskKey(value) });
    res.json({ ok: true });
  } catch (err) {
    console.error("Update setting error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export { adminRouter };
