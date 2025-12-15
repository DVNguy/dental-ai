import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

type ResourceFetcher<T> = (id: string) => Promise<T | null>;
type PracticeIdExtractor<T> = (resource: T) => string;

interface ResourceGuardConfig<T> {
  fetcher: ResourceFetcher<T>;
  resourceName: string;
  extractPracticeId: PracticeIdExtractor<T>;
}

function createResourceGuard<T>(config: ResourceGuardConfig<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resourceId = req.params.id;
    if (!resourceId) {
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

    const result = await config.fetcher(resourceId);
    if (!result) {
      return res.status(404).json({ error: `${config.resourceName} not found` });
    }

    const resourcePracticeId = config.extractPracticeId(result);
    if (resourcePracticeId !== sessionPracticeId) {
      return res.status(403).json({ error: "Access denied" });
    }

    next();
  };
}

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

export const requireRoomAccess = createResourceGuard({
  fetcher: async (id: string) => {
    const result = await storage.getRoomWithPractice(id);
    return result?.room ?? null;
  },
  resourceName: "Room",
  extractPracticeId: (room) => room.practiceId,
});

export const requireStaffAccess = createResourceGuard({
  fetcher: async (id: string) => {
    const result = await storage.getStaffWithPractice(id);
    return result?.staff ?? null;
  },
  resourceName: "Staff member",
  extractPracticeId: (staff) => staff.practiceId,
});

export const requireWorkflowAccess = createResourceGuard({
  fetcher: async (id: string) => {
    const result = await storage.getWorkflowWithPractice(id);
    return result?.workflow ?? null;
  },
  resourceName: "Workflow",
  extractPracticeId: (workflow) => workflow.practiceId,
});

export const requireConnectionAccess = createResourceGuard({
  fetcher: async (id: string) => {
    const result = await storage.getConnectionWithPractice(id);
    return result?.connection ?? null;
  },
  resourceName: "Connection",
  extractPracticeId: (connection) => connection.practiceId,
});

export const requireStepAccess = createResourceGuard({
  fetcher: async (id: string) => {
    const result = await storage.getStepWithPractice(id);
    return result ? { practiceId: result.practice.id } : null;
  },
  resourceName: "Step",
  extractPracticeId: (result) => result.practiceId,
});
