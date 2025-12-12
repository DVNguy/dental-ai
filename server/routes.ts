import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertPracticeSchema, 
  insertRoomSchema, 
  insertStaffSchema, 
  insertSimulationSchema 
} from "@shared/schema";
import { runSimulation, type SimulationParameters } from "./simulation";
import { analyzeLayout, getQuickRecommendation } from "./ai/advisor";
import { searchKnowledge } from "./ai/knowledgeProcessor";
import { generateCoachResponse } from "./ai/coachChat";
import { queryRAG, retrieveKnowledgeChunks } from "./ai/ragQuery";
import { z } from "zod";

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

  const runSimulationSchema = z.object({
    practiceId: z.string(),
    patientVolume: z.number().min(1).max(1000),
    operatingHours: z.number().min(1).max(24),
  });

  app.post("/api/simulations/run", async (req, res) => {
    try {
      const { practiceId, patientVolume, operatingHours } = runSimulationSchema.parse(req.body);
      
      const practice = await storage.getPractice(practiceId);
      if (!practice) {
        return res.status(404).json({ error: "Practice not found" });
      }

      const rooms = await storage.getRoomsByPracticeId(practiceId);
      const staff = await storage.getStaffByPracticeId(practiceId);

      const parameters: SimulationParameters = { patientVolume, operatingHours };
      const result = runSimulation(rooms, staff, parameters);

      const simulation = await storage.createSimulation({
        practiceId,
        efficiencyScore: result.efficiencyScore,
        harmonyScore: result.harmonyScore,
        waitTime: result.waitTime,
        patientCapacity: result.patientCapacity,
        parameters: result.parameters,
      });

      res.json(simulation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid simulation parameters" });
      }
      res.status(500).json({ error: "Failed to run simulation" });
    }
  });

  const analyzeLayoutSchema = z.object({
    practiceId: z.string(),
    operatingHours: z.number().min(1).max(24).optional().default(8),
  });

  app.post("/api/ai/analyze-layout", async (req, res) => {
    try {
      const { practiceId, operatingHours } = analyzeLayoutSchema.parse(req.body);
      
      const practice = await storage.getPractice(practiceId);
      if (!practice) {
        return res.status(404).json({ error: "Practice not found" });
      }

      const rooms = await storage.getRoomsByPracticeId(practiceId);
      const staff = await storage.getStaffByPracticeId(practiceId);

      const analysis = await analyzeLayout(rooms, staff, operatingHours);
      res.json(analysis);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request parameters" });
      }
      console.error("AI analysis error:", error);
      res.status(500).json({ error: "Failed to analyze layout" });
    }
  });

  const recommendSchema = z.object({
    practiceId: z.string(),
    question: z.string().optional(),
  });

  app.post("/api/ai/recommend", async (req, res) => {
    try {
      const { practiceId, question } = recommendSchema.parse(req.body);
      
      const practice = await storage.getPractice(practiceId);
      if (!practice) {
        return res.status(404).json({ error: "Practice not found" });
      }

      const rooms = await storage.getRoomsByPracticeId(practiceId);
      const staff = await storage.getStaffByPracticeId(practiceId);

      const recommendation = await getQuickRecommendation(rooms, staff, question);
      res.json({ recommendation });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request parameters" });
      }
      console.error("AI recommendation error:", error);
      res.status(500).json({ error: "Failed to get recommendation" });
    }
  });

  app.get("/api/knowledge", async (req, res) => {
    try {
      const sources = await storage.getAllKnowledgeSources();
      res.json(sources);
    } catch (error) {
      console.error("Failed to fetch knowledge sources:", error);
      res.status(500).json({ error: "Failed to fetch knowledge sources" });
    }
  });

  app.get("/api/knowledge/:id", async (req, res) => {
    try {
      const source = await storage.getKnowledgeSource(req.params.id);
      if (!source) {
        return res.status(404).json({ error: "Knowledge source not found" });
      }
      const chunks = await storage.getChunksBySourceId(req.params.id);
      res.json({ source, chunks });
    } catch (error) {
      console.error("Failed to fetch knowledge source:", error);
      res.status(500).json({ error: "Failed to fetch knowledge source" });
    }
  });


  const searchKnowledgeSchema = z.object({
    query: z.string().min(1),
    limit: z.number().min(1).max(20).optional().default(5),
  });

  app.post("/api/knowledge/search", async (req, res) => {
    try {
      const { query, limit } = searchKnowledgeSchema.parse(req.body);
      const results = await searchKnowledge(query, limit);
      res.json(results);
    } catch (error) {
      console.error("Failed to search knowledge:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid search parameters" });
      }
      res.status(500).json({ error: "Failed to search knowledge" });
    }
  });

  const coachChatSchema = z.object({
    question: z.string().min(1),
  });

  app.post("/api/ai/coach-chat", async (req, res) => {
    try {
      const { question } = coachChatSchema.parse(req.body);
      const response = await queryRAG(question, 5);
      res.json({
        answer: response.answer,
        sources: response.kbChunks.map(c => ({
          title: c.docName.replace(/\.docx$/i, "").replace(/[_-]/g, " "),
          category: c.headingPath || "Allgemein"
        })),
        webResults: response.webResults,
        kbCoverage: response.kbCoverage
      });
    } catch (error) {
      console.error("Coach chat error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request" });
      }
      res.status(500).json({ error: "Failed to generate response" });
    }
  });

  const ragQuerySchema = z.object({
    question: z.string().min(1),
    topK: z.number().min(1).max(20).optional().default(5),
  });

  app.post("/api/v1/rag/query", async (req, res) => {
    try {
      const { question, topK } = ragQuerySchema.parse(req.body);
      const response = await queryRAG(question, topK);
      res.json({
        answer: response.answer,
        retrievedChunks: response.kbChunks.map(c => ({
          id: c.id,
          docName: c.docName,
          headingPath: c.headingPath,
          score: c.score
        })),
        webResults: response.webResults,
        kbCoverage: response.kbCoverage
      });
    } catch (error) {
      console.error("RAG query error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query parameters" });
      }
      res.status(500).json({ error: "Failed to process query" });
    }
  });

  return httpServer;
}
