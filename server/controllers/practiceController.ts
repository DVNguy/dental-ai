import type { Request, Response } from "express";
import { storage } from "../storage";
import { insertPracticeSchema, insertRoomSchema, insertStaffSchema } from "@shared/schema";
import { calculateLayoutEfficiencyBreakdown } from "../simulation";
import { computeLayoutEfficiency, computeWorkflowMetrics } from "../ai/layoutEfficiency";
import { computeWorkflowAnalysis } from "../ai/advisor";

export async function handleGetUser(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const userId = user.id;
    const dbUser = await storage.getUser(userId);
    if (!dbUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const practices = await storage.getPracticesByOwnerId(userId);
    let practiceId = practices.length > 0 ? practices[0].id : null;

    if (!practiceId) {
      const practice = await storage.createPractice({
        name: `Praxis ${dbUser.firstName || dbUser.email || userId}`,
        budget: 50000,
        ownerId: userId,
      });
      practiceId = practice.id;
    }

    res.json({ user: dbUser, practiceId });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
}

export async function getDebugStatus(req: Request, res: Response) {
  const isDebugEnabled = process.env.DEBUG_STATUS === "true" || process.env.NODE_ENV !== "production";
  if (!isDebugEnabled) {
    return res.status(403).json({ error: "Debug endpoint disabled in production" });
  }
  try {
    const stats = await storage.getDebugStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    console.error("Debug stats error:", error);
    res.status(500).json({ error: "Failed to fetch debug stats" });
  }
}

export async function getPractice(req: Request, res: Response) {
  try {
    const practice = await storage.getPractice(req.params.id);
    if (!practice) {
      return res.status(404).json({ error: "Practice not found" });
    }
    const rooms = await storage.getRoomsByPracticeId(req.params.id);
    const staff = await storage.getStaffByPracticeId(req.params.id);
    res.json({ practice, rooms, staff });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch practice" });
  }
}

export async function createPractice(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const validated = insertPracticeSchema.parse(req.body);
    const practice = await storage.createPractice({
      ...validated,
      ownerId: user.id,
    });
    res.json(practice);
  } catch (error) {
    res.status(400).json({ error: "Invalid practice data" });
  }
}

export async function updateBudget(req: Request, res: Response) {
  try {
    const { budget } = req.body;
    if (typeof budget !== "number") {
      return res.status(400).json({ error: "Budget must be a number" });
    }
    const practice = await storage.updatePracticeBudget(req.params.id, budget);
    if (!practice) {
      return res.status(404).json({ error: "Practice not found" });
    }
    res.json(practice);
  } catch (error) {
    res.status(500).json({ error: "Failed to update budget" });
  }
}

export async function getLayoutEfficiencyBreakdown(req: Request, res: Response) {
  try {
    const rooms = await storage.getRoomsByPracticeId(req.params.id);
    const breakdown = await calculateLayoutEfficiencyBreakdown(rooms);
    res.json(breakdown);
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate layout efficiency" });
  }
}

export async function computeLayoutEfficiencyHandler(req: Request, res: Response) {
  try {
    const { practiceId } = req.body;
    if (!practiceId || typeof practiceId !== "string") {
      return res.status(400).json({ error: "practiceId is required" });
    }
    const rooms = await storage.getRoomsByPracticeId(practiceId);
    const result = computeLayoutEfficiency(rooms);

    const connections = await storage.getConnectionsByPracticeId(practiceId);
    const workflowAnalysis = computeWorkflowAnalysis(rooms, connections);
    let workflowMetrics = null;
    let workflowTips: string[] = [];

    if (connections.length > 0) {
      workflowMetrics = computeWorkflowMetrics(rooms, connections);

      if (workflowMetrics) {
        for (const conn of workflowMetrics.longestConnections) {
          if (conn.distanceMeters > 5 && workflowTips.length < 3) {
            workflowTips.push(
              `Diese Verbindung ist besonders lang: ${conn.fromName} → ${conn.toName} (${conn.distanceMeters}m) – Räume näher platzieren.`
            );
          }
        }

        if (workflowMetrics.crossingConnections.length > 0 && workflowTips.length < 3) {
          const crossing = workflowMetrics.crossingConnections[0];
          workflowTips.push(
            `Diese Verbindung kreuzt andere Flows (potenzielle Kollisionen): ${crossing.conn1} × ${crossing.conn2}`
          );
        }

        if (workflowMetrics.coreRoomDistanceIssue && workflowTips.length < 3) {
          workflowTips.push(
            `Empfang/Wartebereich/Behandlung sind zu weit auseinander (${workflowMetrics.coreRoomDistanceMeters}m gesamt, optimal <8m).`
          );
        }
      }
    }

    let finalScore = result.score;
    if (workflowMetrics) {
      const workflowWeight = 0.15;
      const workflowScore = 100 - workflowMetrics.motionWasteScore;
      finalScore = Math.round(result.score * (1 - workflowWeight) + workflowScore * workflowWeight);
    }

    res.json({
      ...result,
      score: finalScore,
      tips: [...result.tips, ...workflowTips].slice(0, 6),
      workflowMetrics: workflowMetrics || undefined,
      workflowAnalysis,
    });
  } catch (error) {
    console.error("Layout efficiency error:", error);
    res.status(500).json({ error: "Failed to compute layout efficiency" });
  }
}

export async function getRooms(req: Request, res: Response) {
  try {
    const rooms = await storage.getRoomsByPracticeId(req.params.id);
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
}

export async function createRoom(req: Request, res: Response) {
  try {
    const validated = insertRoomSchema.parse({
      ...req.body,
      practiceId: req.params.id,
    });
    const room = await storage.createRoom(validated);
    res.json(room);
  } catch (error) {
    res.status(400).json({ error: "Invalid room data" });
  }
}

export async function updateRoom(req: Request, res: Response) {
  try {
    const room = await storage.updateRoom(req.params.id, req.body);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: "Failed to update room" });
  }
}

export async function deleteRoom(req: Request, res: Response) {
  try {
    await storage.deleteRoom(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete room" });
  }
}

export async function getStaff(req: Request, res: Response) {
  try {
    const staff = await storage.getStaffByPracticeId(req.params.id);
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staff" });
  }
}

export async function createStaff(req: Request, res: Response) {
  try {
    const validated = insertStaffSchema.parse({
      ...req.body,
      practiceId: req.params.id,
    });
    const staffMember = await storage.createStaff(validated);
    res.json(staffMember);
  } catch (error) {
    res.status(400).json({ error: "Invalid staff data" });
  }
}

export async function updateStaff(req: Request, res: Response) {
  try {
    const staffMember = await storage.updateStaff(req.params.id, req.body);
    if (!staffMember) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    res.json(staffMember);
  } catch (error) {
    res.status(500).json({ error: "Failed to update staff" });
  }
}

export async function deleteStaff(req: Request, res: Response) {
  try {
    await storage.deleteStaff(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete staff" });
  }
}
