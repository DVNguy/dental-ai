import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertPracticeSchema, 
  insertRoomSchema, 
  insertStaffSchema, 
  insertSimulationSchema 
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/practices/:id", async (req, res) => {
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
  });

  app.post("/api/practices", async (req, res) => {
    try {
      const validated = insertPracticeSchema.parse(req.body);
      const practice = await storage.createPractice(validated);
      res.json(practice);
    } catch (error) {
      res.status(400).json({ error: "Invalid practice data" });
    }
  });

  app.put("/api/practices/:id/budget", async (req, res) => {
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
  });

  app.get("/api/practices/:id/rooms", async (req, res) => {
    try {
      const rooms = await storage.getRoomsByPracticeId(req.params.id);
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  app.post("/api/practices/:id/rooms", async (req, res) => {
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
  });

  app.put("/api/rooms/:id", async (req, res) => {
    try {
      const room = await storage.updateRoom(req.params.id, req.body);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      res.status(500).json({ error: "Failed to update room" });
    }
  });

  app.delete("/api/rooms/:id", async (req, res) => {
    try {
      await storage.deleteRoom(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete room" });
    }
  });

  app.get("/api/practices/:id/staff", async (req, res) => {
    try {
      const staff = await storage.getStaffByPracticeId(req.params.id);
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.post("/api/practices/:id/staff", async (req, res) => {
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
  });

  app.put("/api/staff/:id", async (req, res) => {
    try {
      const staffMember = await storage.updateStaff(req.params.id, req.body);
      if (!staffMember) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      res.json(staffMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to update staff" });
    }
  });

  app.delete("/api/staff/:id", async (req, res) => {
    try {
      await storage.deleteStaff(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete staff" });
    }
  });

  app.post("/api/simulations", async (req, res) => {
    try {
      const validated = insertSimulationSchema.parse(req.body);
      const simulation = await storage.createSimulation(validated);
      res.json(simulation);
    } catch (error) {
      res.status(400).json({ error: "Invalid simulation data" });
    }
  });

  app.get("/api/practices/:id/simulations", async (req, res) => {
    try {
      const simulations = await storage.getSimulationsByPracticeId(req.params.id);
      res.json(simulations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch simulations" });
    }
  });

  return httpServer;
}
