import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";

export const authRouter = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, password } = registerSchema.parse(req.body);

    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ username, password: hashedPassword });

    const practice = await storage.createPractice({
      name: `Praxis ${username}`,
      budget: 50000,
      ownerId: user.id,
    });

    req.session.userId = user.id;
    req.session.practiceId = practice.id;

    res.json({ id: user.id, username: user.username, practiceId: practice.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid registration data" });
    }
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const practices = await storage.getPracticesByOwnerId(user.id);
    const practiceId = practices.length > 0 ? practices[0].id : null;

    req.session.userId = user.id;
    req.session.practiceId = practiceId || undefined;

    res.json({ id: user.id, username: user.username, practiceId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid login data" });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

authRouter.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

authRouter.get("/me", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  let practiceId = req.session.practiceId;
  if (!practiceId) {
    const practices = await storage.getPracticesByOwnerId(user.id);
    if (practices.length > 0) {
      practiceId = practices[0].id;
      req.session.practiceId = practiceId;
    }
  }

  res.json({ id: user.id, username: user.username, practiceId: practiceId || null });
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export async function requirePracticeAccess(req: Request, res: Response, next: NextFunction) {
  const practiceId = req.params.id || req.params.practiceId || req.body?.practiceId;
  if (!practiceId) {
    return next();
  }

  const practice = await storage.getPractice(practiceId);
  if (!practice) {
    return res.status(404).json({ error: "Practice not found" });
  }

  if (practice.ownerId && practice.ownerId !== req.session.userId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

export async function requireRoomAccess(req: Request, res: Response, next: NextFunction) {
  const roomId = req.params.id;
  if (!roomId) {
    return next();
  }

  const result = await storage.getRoomWithPractice(roomId);
  if (!result) {
    return res.status(404).json({ error: "Room not found" });
  }

  if (result.practice.ownerId && result.practice.ownerId !== req.session.userId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

export async function requireStaffAccess(req: Request, res: Response, next: NextFunction) {
  const staffId = req.params.id;
  if (!staffId) {
    return next();
  }

  const result = await storage.getStaffWithPractice(staffId);
  if (!result) {
    return res.status(404).json({ error: "Staff member not found" });
  }

  if (result.practice.ownerId && result.practice.ownerId !== req.session.userId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

export async function requireWorkflowAccess(req: Request, res: Response, next: NextFunction) {
  const workflowId = req.params.id;
  if (!workflowId) {
    return next();
  }

  const result = await storage.getWorkflowWithPractice(workflowId);
  if (!result) {
    return res.status(404).json({ error: "Workflow not found" });
  }

  if (result.practice.ownerId && result.practice.ownerId !== req.session.userId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

export async function requireConnectionAccess(req: Request, res: Response, next: NextFunction) {
  const connectionId = req.params.id;
  if (!connectionId) {
    return next();
  }

  const result = await storage.getConnectionWithPractice(connectionId);
  if (!result) {
    return res.status(404).json({ error: "Connection not found" });
  }

  if (result.practice.ownerId && result.practice.ownerId !== req.session.userId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

export async function requireStepAccess(req: Request, res: Response, next: NextFunction) {
  const stepId = req.params.id;
  if (!stepId) {
    return next();
  }

  const result = await storage.getStepWithPractice(stepId);
  if (!result) {
    return res.status(404).json({ error: "Step not found" });
  }

  if (result.practice.ownerId && result.practice.ownerId !== req.session.userId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}
