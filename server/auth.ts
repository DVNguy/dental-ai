import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

export async function requirePracticeAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user?.claims?.sub) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const userId = user.claims.sub;
  const practices = await storage.getPracticesByOwnerId(userId);
  
  if (practices.length === 0) {
    return res.status(403).json({ error: "No practice found for user" });
  }
  
  const sessionPracticeId = practices[0].id;
  const urlPracticeId = req.params.id || req.params.practiceId;
  
  if (urlPracticeId && urlPracticeId !== sessionPracticeId) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  const practice = await storage.getPractice(sessionPracticeId);
  if (!practice) {
    return res.status(404).json({ error: "Practice not found" });
  }
  if (practice.ownerId && practice.ownerId !== userId) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  if (req.body && typeof req.body === "object") {
    req.body.practiceId = sessionPracticeId;
  }
  
  (req as any).practiceId = sessionPracticeId;
  (req as any).userId = userId;

  next();
}

export async function requireRoomAccess(req: Request, res: Response, next: NextFunction) {
  const roomId = req.params.id;
  if (!roomId) {
    return next();
  }

  const user = req.user as any;
  if (!user?.claims?.sub) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const userId = user.claims.sub;
  const practices = await storage.getPracticesByOwnerId(userId);
  
  if (practices.length === 0) {
    return res.status(403).json({ error: "No practice in session" });
  }
  
  const sessionPracticeId = practices[0].id;

  const result = await storage.getRoomWithPractice(roomId);
  if (!result) {
    return res.status(404).json({ error: "Room not found" });
  }

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

  const user = req.user as any;
  if (!user?.claims?.sub) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const userId = user.claims.sub;
  const practices = await storage.getPracticesByOwnerId(userId);
  
  if (practices.length === 0) {
    return res.status(403).json({ error: "No practice in session" });
  }
  
  const sessionPracticeId = practices[0].id;

  const result = await storage.getStaffWithPractice(staffId);
  if (!result) {
    return res.status(404).json({ error: "Staff member not found" });
  }

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

  const user = req.user as any;
  if (!user?.claims?.sub) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const userId = user.claims.sub;
  const practices = await storage.getPracticesByOwnerId(userId);
  
  if (practices.length === 0) {
    return res.status(403).json({ error: "No practice in session" });
  }
  
  const sessionPracticeId = practices[0].id;

  const result = await storage.getWorkflowWithPractice(workflowId);
  if (!result) {
    return res.status(404).json({ error: "Workflow not found" });
  }

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

  const user = req.user as any;
  if (!user?.claims?.sub) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const userId = user.claims.sub;
  const practices = await storage.getPracticesByOwnerId(userId);
  
  if (practices.length === 0) {
    return res.status(403).json({ error: "No practice in session" });
  }
  
  const sessionPracticeId = practices[0].id;

  const result = await storage.getConnectionWithPractice(connectionId);
  if (!result) {
    return res.status(404).json({ error: "Connection not found" });
  }

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

  const user = req.user as any;
  if (!user?.claims?.sub) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const userId = user.claims.sub;
  const practices = await storage.getPracticesByOwnerId(userId);
  
  if (practices.length === 0) {
    return res.status(403).json({ error: "No practice in session" });
  }
  
  const sessionPracticeId = practices[0].id;

  const result = await storage.getStepWithPractice(stepId);
  if (!result) {
    return res.status(404).json({ error: "Step not found" });
  }

  if (result.practice.id !== sessionPracticeId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}
