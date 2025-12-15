import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import rateLimit from "express-rate-limit";

export const authRouter = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(6).max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many password reset requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);

    const existingUsername = await storage.getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ username, email, password: hashedPassword });

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
      const passwordMismatch = error.errors.find(e => e.path.includes("confirmPassword"));
      if (passwordMismatch) {
        return res.status(400).json({ error: "Passwords do not match" });
      }
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

authRouter.post("/request-password-reset", passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = requestPasswordResetSchema.parse(req.body);

    const user = await storage.getUserByEmail(email);
    
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.createPasswordResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;
      console.log(`[PASSWORD RESET] Reset link for ${email}: ${resetUrl}`);
    }

    res.json({ 
      message: "If an account exists with this email, a password reset link has been sent." 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    console.error("Password reset request error:", error);
    res.status(500).json({ error: "Password reset request failed" });
  }
});

authRouter.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetToken = await storage.getValidPasswordResetToken(tokenHash);

    if (!resetToken) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await storage.updateUserPassword(resetToken.userId, hashedPassword);
    await storage.markPasswordResetTokenUsed(resetToken.id);

    await storage.deleteExpiredPasswordResetTokens();

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const passwordMismatch = error.errors.find(e => e.path.includes("confirmPassword"));
      if (passwordMismatch) {
        return res.status(400).json({ error: "Passwords do not match" });
      }
      return res.status(400).json({ error: "Invalid reset data" });
    }
    console.error("Password reset error:", error);
    res.status(500).json({ error: "Password reset failed" });
  }
});

authRouter.get("/verify-reset-token", async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token || token.length < 32) {
      return res.status(400).json({ valid: false, error: "Invalid token" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetToken = await storage.getValidPasswordResetToken(tokenHash);

    if (!resetToken) {
      return res.status(400).json({ valid: false, error: "Invalid or expired token" });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({ valid: false, error: "Verification failed" });
  }
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export async function requirePracticeAccess(req: Request, res: Response, next: NextFunction) {
  const sessionPracticeId = req.session.practiceId;
  const urlPracticeId = req.params.id || req.params.practiceId;
  
  // Session must have a practiceId for any practice-scoped route
  if (!sessionPracticeId) {
    return res.status(403).json({ error: "No practice in session" });
  }
  
  // If URL has practiceId, it MUST match session practiceId
  if (urlPracticeId && urlPracticeId !== sessionPracticeId) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  // Verify the session practice exists and is owned by the current user
  const practice = await storage.getPractice(sessionPracticeId);
  if (!practice) {
    return res.status(404).json({ error: "Practice not found" });
  }
  if (practice.ownerId && practice.ownerId !== req.session.userId) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  // Always override body practiceId with session value (never trust client)
  if (req.body && typeof req.body === "object") {
    req.body.practiceId = sessionPracticeId;
  }
  
  // Attach sessionPracticeId to request for downstream use
  (req as any).practiceId = sessionPracticeId;

  next();
}

export async function requireRoomAccess(req: Request, res: Response, next: NextFunction) {
  const roomId = req.params.id;
  if (!roomId) {
    return next();
  }

  const sessionPracticeId = req.session.practiceId;
  if (!sessionPracticeId) {
    return res.status(403).json({ error: "No practice in session" });
  }

  const result = await storage.getRoomWithPractice(roomId);
  if (!result) {
    return res.status(404).json({ error: "Room not found" });
  }

  // Room must belong to session practice
  if (result.room.practiceId !== sessionPracticeId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

export async function requireStaffAccess(req: Request, res: Response, next: NextFunction) {
  const staffId = req.params.id;
  if (!staffId) {
    return next();
  }

  const sessionPracticeId = req.session.practiceId;
  if (!sessionPracticeId) {
    return res.status(403).json({ error: "No practice in session" });
  }

  const result = await storage.getStaffWithPractice(staffId);
  if (!result) {
    return res.status(404).json({ error: "Staff member not found" });
  }

  // Staff must belong to session practice
  if (result.staff.practiceId !== sessionPracticeId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

export async function requireWorkflowAccess(req: Request, res: Response, next: NextFunction) {
  const workflowId = req.params.id;
  if (!workflowId) {
    return next();
  }

  const sessionPracticeId = req.session.practiceId;
  if (!sessionPracticeId) {
    return res.status(403).json({ error: "No practice in session" });
  }

  const result = await storage.getWorkflowWithPractice(workflowId);
  if (!result) {
    return res.status(404).json({ error: "Workflow not found" });
  }

  // Workflow must belong to session practice
  if (result.workflow.practiceId !== sessionPracticeId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

export async function requireConnectionAccess(req: Request, res: Response, next: NextFunction) {
  const connectionId = req.params.id;
  if (!connectionId) {
    return next();
  }

  const sessionPracticeId = req.session.practiceId;
  if (!sessionPracticeId) {
    return res.status(403).json({ error: "No practice in session" });
  }

  const result = await storage.getConnectionWithPractice(connectionId);
  if (!result) {
    return res.status(404).json({ error: "Connection not found" });
  }

  // Connection must belong to session practice
  if (result.connection.practiceId !== sessionPracticeId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

export async function requireStepAccess(req: Request, res: Response, next: NextFunction) {
  const stepId = req.params.id;
  if (!stepId) {
    return next();
  }

  const sessionPracticeId = req.session.practiceId;
  if (!sessionPracticeId) {
    return res.status(403).json({ error: "No practice in session" });
  }

  const result = await storage.getStepWithPractice(stepId);
  if (!result) {
    return res.status(404).json({ error: "Step not found" });
  }

  // Step's workflow must belong to session practice
  if (result.workflow.practiceId !== sessionPracticeId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}
