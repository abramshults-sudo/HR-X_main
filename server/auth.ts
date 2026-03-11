import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { storage } from "./storage.js";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    trackingInit?: boolean;
  }
}

export function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Необходима авторизация" });
    return;
  }
  next();
}

const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Email и пароль обязательны" });
      return;
    }

    const emailTrimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed) || emailTrimmed.length > 255) {
      res.status(400).json({ error: "Некорректный формат email" });
      return;
    }

    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: "Пароль должен содержать от 6 до 128 символов" });
      return;
    }

    const existing = await storage.getUserByEmail(emailTrimmed);
    if (existing) {
      res.status(409).json({ error: "Пользователь с таким email уже существует" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ email: emailTrimmed, passwordHash });

    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: "Ошибка сервера" });
        return;
      }
      req.session.userId = user.id;
      req.session.save(() => {
        res.json({ id: user.id, email: user.email, hasPaid: user.hasPaid });
      });
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email и пароль обязательны" });
      return;
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Неверный email или пароль" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Неверный email или пароль" });
      return;
    }

    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: "Ошибка сервера" });
        return;
      }
      req.session.userId = user.id;
      req.session.save(() => {
        res.json({ id: user.id, email: user.email, hasPaid: user.hasPaid });
      });
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

authRouter.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Ошибка при выходе" });
      return;
    }
    res.clearCookie("hrx.sid");
    res.json({ ok: true });
  });
});

authRouter.get("/me", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    res.json(null);
    return;
  }
  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      res.json(null);
      return;
    }
    res.json({ id: user.id, email: user.email, hasPaid: user.hasPaid });
  } catch (err) {
    console.error("Me error:", err);
    res.json(null);
  }
});

export { authRouter };
