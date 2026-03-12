import { Router, Request, Response } from "express";
import { requireAuth } from "./auth.js";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { promoCodes, users } from "../shared/schema.js";
import { eq, and, gt, sql } from "drizzle-orm";
import { addLog } from "./admin.js";

const apiRouter = Router();

apiRouter.get("/presets", requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await storage.getPresets(req.session.userId!);
    res.json(list);
  } catch (err) {
    console.error("Get presets error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

apiRouter.post("/presets", requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, quizState, filters } = req.body;
    if (!name || typeof name !== "string" || !quizState || typeof quizState !== "object") {
      res.status(400).json({ error: "Название и данные квиза обязательны" });
      return;
    }
    if (name.trim().length === 0 || name.length > 255) {
      res.status(400).json({ error: "Название должно быть от 1 до 255 символов" });
      return;
    }
    const presetData: any = {
      userId: req.session.userId!,
      name,
      quizState,
    };
    if (filters && typeof filters === "object") {
      presetData.quizState = { ...quizState, _filters: filters };
    }
    const preset = await storage.createPreset(presetData);
    res.json(preset);
  } catch (err) {
    console.error("Create preset error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

apiRouter.delete("/presets/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Некорректный ID" });
      return;
    }
    const deleted = await storage.deletePreset(id, req.session.userId!);
    if (!deleted) {
      res.status(404).json({ error: "Пресет не найден" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete preset error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

apiRouter.get("/results", requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await storage.getSavedResults(req.session.userId!);
    res.json(list);
  } catch (err) {
    console.error("Get results error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

apiRouter.post("/results", requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, roleKeywords, jobCount, jobs, resumeText, quizSnapshot } = req.body;
    if (!name || typeof name !== "string" || !jobs || !Array.isArray(jobs)) {
      res.status(400).json({ error: "Название и вакансии обязательны" });
      return;
    }
    if (name.trim().length === 0 || name.length > 255) {
      res.status(400).json({ error: "Название должно быть от 1 до 255 символов" });
      return;
    }
    if (jobs.length > 5000) {
      res.status(400).json({ error: "Слишком много вакансий (макс. 5000)" });
      return;
    }
    const result = await storage.createSavedResult({
      userId: req.session.userId!,
      name,
      roleKeywords: roleKeywords || null,
      jobCount: jobCount || 0,
      jobs,
      resumeText: resumeText || null,
      quizSnapshot: quizSnapshot || null,
    });
    res.json(result);
  } catch (err) {
    console.error("Create result error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

apiRouter.delete("/results/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Некорректный ID" });
      return;
    }
    const deleted = await storage.deleteSavedResult(id, req.session.userId!);
    if (!deleted) {
      res.status(404).json({ error: "Результат не найден" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete result error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

apiRouter.post("/promo/validate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      res.status(400).json({ error: "Введите промокод" });
      return;
    }

    const normalized = code.toUpperCase().trim();

    const result = await db.execute(sql`
      UPDATE promo_codes
      SET used_count = used_count + 1
      WHERE code = ${normalized}
        AND active = true
        AND (max_uses = 0 OR used_count < max_uses)
        AND (expires_at IS NULL OR expires_at > NOW())
      RETURNING id, code, type, value
    `);

    if (!result.rows || result.rows.length === 0) {
      const [existing] = await db.select().from(promoCodes).where(eq(promoCodes.code, normalized));
      if (!existing) {
        res.status(404).json({ error: "Промокод не найден" });
        return;
      }
      if (!existing.active) {
        res.status(410).json({ error: "Промокод неактивен" });
        return;
      }
      if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
        res.status(410).json({ error: "Промокод истёк" });
        return;
      }
      res.status(410).json({ error: "Промокод исчерпан" });
      return;
    }

    const promo = result.rows[0] as { id: number; code: string; type: string; value: number };

    if (promo.type === "free_access" && req.session.userId) {
      await db.update(users).set({ hasPaid: true }).where(eq(users.id, req.session.userId));
    }

    addLog("promo", "redeemed", { code: promo.code, userId: req.session.userId, type: promo.type, value: promo.value }, req.ip, req.session.userId);

    res.json({ type: promo.type, value: promo.value, code: promo.code });
  } catch (err) {
    console.error("Promo validate error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export { apiRouter };
