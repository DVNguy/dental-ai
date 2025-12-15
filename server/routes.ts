import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertPracticeSchema,
  insertRoomSchema,
  insertStaffSchema,
  insertSimulationSchema,
  insertWorkflowSchema,
  insertWorkflowConnectionSchema,
  insertWorkflowStepSchema,
} from "@shared/schema";
import { runSimulation, calculateLayoutEfficiencyBreakdown, type SimulationParameters } from "./simulation";
import { computeLayoutEfficiency, computeWorkflowMetrics } from "./ai/layoutEfficiency";
import { analyzeLayout, getQuickRecommendation, computeWorkflowAnalysis } from "./ai/advisor";
import { DEFAULT_LAYOUT_SCALE_PX_PER_METER } from "@shared/roomTypes";
import { searchKnowledge } from "./ai/knowledgeProcessor";
import { generateCoachResponse } from "./ai/coachChat";
import { queryRAG, retrieveKnowledgeChunks } from "./ai/ragQuery";
import {
  getKnowledgePoweredRoomSizes,
  getKnowledgePoweredStaffing,
  getKnowledgePoweredScheduling,
  getHealthScoreDrivers,
} from "./ai/artifactBenchmarks";
import { getArtifacts } from "./ai/artifactService";
import { z } from "zod";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  requirePracticeAccess,
  requireRoomAccess,
  requireStaffAccess,
  requireWorkflowAccess,
  requireConnectionAccess,
  requireStepAccess,
} from "./auth";
import { aiRateLimiter, aiBudgetGuard, RATE_LIMIT_CONFIG } from "./rateLimit";

// ... deine existierenden Imports (Express, http, storage, schema, etc.) ...
// NEU: Imports für den Consultant Bot
import { OpenAI } from "openai";
import { tavily } from "@tavily/core";
import { DENTAL_BENCHMARKS } from "./benchmark"; // Wichtig: Singular "./benchmark", wie in deinem Screenshot

// NEU: Clients initialisieren
// Stelle sicher, dass diese Keys in den Replit Secrets (.env) sind!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || "tvly-DUMMY" }); // Fallback verhindert Crash beim Start

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await setupAuth(app);

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const practices = await storage.getPracticesByOwnerId(userId);
      let practiceId = practices.length > 0 ? practices[0].id : null;
      
      if (!practiceId) {
        const practice = await storage.createPractice({
          name: `Praxis ${user.firstName || user.email || userId}`,
          budget: 50000,
          ownerId: userId,
        });
        practiceId = practice.id;
      }
      
      res.json({ ...user, practiceId });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.use("/api", (req, res, next) => {
    if (req.path === "/login" || req.path === "/callback" || req.path === "/logout") return next();
    if (req.path.startsWith("/auth")) return next();
    if (req.path === "/debug/status") return next();
    return isAuthenticated(req, res, next);
  });

  // Rate limiting for AI endpoints
  // Limits: 30 req/min for authenticated users, 10 req/min for anonymous (IP-based)
  // Budget guard is applied per-route after requirePracticeAccess sets practiceId
  app.use("/api/ai", aiRateLimiter);
  app.use("/api/v1/rag", aiRateLimiter);

  app.get("/api/debug/status", async (req, res) => {
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
  });

  app.get("/api/practices/:id", requirePracticeAccess, async (req, res) => {
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
      const practice = await storage.createPractice({
        ...validated,
        ownerId: req.session.userId,
      });
      res.json(practice);
    } catch (error) {
      res.status(400).json({ error: "Invalid practice data" });
    }
  });

  app.put("/api/practices/:id/budget", requirePracticeAccess, async (req, res) => {
    try {
      const { budget } = req.body;
      if (typeof budget !== "number") {
        return res.status(400).json({ error: "Budget must be a number" });
      }

      const practice = await storage.updatePracticeBudget(
        req.params.id,
        budget,
      );
      if (!practice) {
        return res.status(404).json({ error: "Practice not found" });
      }

      res.json(practice);
    } catch (error) {
      res.status(500).json({ error: "Failed to update budget" });
    }
  });

  app.get("/api/practices/:id/layout-efficiency", requirePracticeAccess, async (req, res) => {
    try {
      const rooms = await storage.getRoomsByPracticeId(req.params.id);
      const breakdown = await calculateLayoutEfficiencyBreakdown(rooms);
      res.json(breakdown);
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate layout efficiency" });
    }
  });

  app.post("/api/layout/efficiency", requirePracticeAccess, async (req, res) => {
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
  });

  app.get("/api/practices/:id/rooms", requirePracticeAccess, async (req, res) => {
    try {
      const rooms = await storage.getRoomsByPracticeId(req.params.id);
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  app.post("/api/practices/:id/rooms", requirePracticeAccess, async (req, res) => {
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

  app.put("/api/rooms/:id", requireRoomAccess, async (req, res) => {
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

  app.delete("/api/rooms/:id", requireRoomAccess, async (req, res) => {
    try {
      await storage.deleteRoom(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete room" });
    }
  });

  app.get("/api/practices/:id/staff", requirePracticeAccess, async (req, res) => {
    try {
      const staff = await storage.getStaffByPracticeId(req.params.id);
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.post("/api/practices/:id/staff", requirePracticeAccess, async (req, res) => {
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

  app.put("/api/staff/:id", requireStaffAccess, async (req, res) => {
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

  app.delete("/api/staff/:id", requireStaffAccess, async (req, res) => {
    try {
      await storage.deleteStaff(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete staff" });
    }
  });

  app.post("/api/simulations", requirePracticeAccess, async (req, res) => {
    try {
      const validated = insertSimulationSchema.parse(req.body);
      const simulation = await storage.createSimulation(validated);
      res.json(simulation);
    } catch (error) {
      res.status(400).json({ error: "Invalid simulation data" });
    }
  });

  app.get("/api/practices/:id/simulations", requirePracticeAccess, async (req, res) => {
    try {
      const simulations = await storage.getSimulationsByPracticeId(
        req.params.id,
      );
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

  app.post("/api/simulations/run", requirePracticeAccess, async (req, res) => {
    try {
      const { practiceId, patientVolume, operatingHours } =
        runSimulationSchema.parse(req.body);

      const practice = await storage.getPractice(practiceId);
      if (!practice) {
        return res.status(404).json({ error: "Practice not found" });
      }

      const rooms = await storage.getRoomsByPracticeId(practiceId);
      const staff = await storage.getStaffByPracticeId(practiceId);

      const parameters: SimulationParameters = {
        patientVolume,
        operatingHours,
        layoutScalePxPerMeter: practice.layoutScalePxPerMeter ?? DEFAULT_LAYOUT_SCALE_PX_PER_METER,
      };
      const result = await runSimulation(rooms, staff, parameters);

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

  app.post("/api/ai/analyze-layout", requirePracticeAccess, aiBudgetGuard, async (req, res) => {
    try {
      const { practiceId, operatingHours } = analyzeLayoutSchema.parse(
        req.body,
      );

      const practice = await storage.getPractice(practiceId);
      if (!practice) {
        return res.status(404).json({ error: "Practice not found" });
      }

      const rooms = await storage.getRoomsByPracticeId(practiceId);
      const staff = await storage.getStaffByPracticeId(practiceId);
      const connections = await storage.getConnectionsByPracticeId(practiceId);

      const analysis = await analyzeLayout(rooms, staff, operatingHours, practice.layoutScalePxPerMeter ?? DEFAULT_LAYOUT_SCALE_PX_PER_METER, connections);
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

  app.post("/api/ai/recommend", requirePracticeAccess, aiBudgetGuard, async (req, res) => {
    try {
      const { practiceId, question } = recommendSchema.parse(req.body);

      const practice = await storage.getPractice(practiceId);
      if (!practice) {
        return res.status(404).json({ error: "Practice not found" });
      }

      const rooms = await storage.getRoomsByPracticeId(practiceId);
      const staff = await storage.getStaffByPracticeId(practiceId);

      const recommendation = await getQuickRecommendation(
        rooms,
        staff,
        question,
        practice.layoutScalePxPerMeter ?? DEFAULT_LAYOUT_SCALE_PX_PER_METER,
      );
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
        sources: response.kbChunks.map((c) => ({
          title: c.docName.replace(/\.docx$/i, "").replace(/[_-]/g, " "),
          category: c.headingPath || "Allgemein",
        })),
        webResults: response.webResults,
        kbCoverage: response.kbCoverage,
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
        kbCitations: response.kbChunks.map((c) => ({
          chunkId: c.id,
          docName: c.docName.replace(/\.docx$/i, ""),
          headingPath: c.headingPath || "Allgemein",
          score: c.score,
        })),
        webCitations: response.webResults?.map((w) => ({
          title: w.title,
          publisher: w.publisher || "web",
          date: w.date || new Date().toISOString().split("T")[0],
          url: w.url,
        })),
        kbCoverage: response.kbCoverage,
      });
    } catch (error) {
      console.error("RAG query error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query parameters" });
      }
      res.status(500).json({ error: "Failed to process query" });
    }
  });

  app.get("/api/benchmarks", async (req, res) => {
    try {
      const [roomSizes, staffing, scheduling, healthScore] = await Promise.all([
        getKnowledgePoweredRoomSizes(),
        getKnowledgePoweredStaffing(),
        getKnowledgePoweredScheduling(),
        getHealthScoreDrivers(),
      ]);

      res.json({
        roomSizes,
        staffing,
        scheduling,
        healthScoreWeights: healthScore.weights,
        healthScoreFromKnowledge: healthScore.fromKnowledge,
      });
    } catch (error) {
      console.error("Failed to fetch benchmarks:", error);
      res.status(500).json({ error: "Failed to fetch benchmarks" });
    }
  });

  app.get("/api/playbooks", async (req, res) => {
    try {
      const playbooks = await getArtifacts({ artifactType: "playbook" });
      res.json(playbooks);
    } catch (error) {
      console.error("Error fetching playbooks:", error);
      res.status(500).json({ error: "Failed to fetch playbooks" });
    }
  });

  app.get("/api/playbooks/:id", async (req, res) => {
    try {
      const playbooks = await getArtifacts({ artifactType: "playbook" });
      const playbook = playbooks.find(p => p.id === req.params.id);
      if (!playbook) {
        return res.status(404).json({ error: "Playbook not found" });
      }
      res.json(playbook);
    } catch (error) {
      console.error("Error fetching playbook:", error);
      res.status(500).json({ error: "Failed to fetch playbook" });
    }
  });

  // ---------------------------------------------------------
  // NEU: Der "Smart Consultant" mit Benchmarks & Web-Suche
  // ---------------------------------------------------------
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message } = req.body;

      // 1. System Prompt mit den harten Fakten (Benchmarks) anreichern
      const benchmarkContext = JSON.stringify(DENTAL_BENCHMARKS, null, 2);

      const systemPrompt = `
      Du bist ein hochspezialisierter KI-Unternehmensberater für Zahnarztpraxen.

      DEINE GRUNDLAGE (GROUND TRUTH):
      Nutze für Berechnungen und Standards ZWINGEND diese Benchmarks. Rate nicht, wenn Daten hier stehen:
      ${benchmarkContext}

      INSTRUKTIONEN ZUR SUCHE:
      - Nutze das 'web_search' Tool für aktuelle Trends (2024/2025), Gesetzesänderungen oder Marktanalysen.
      - Nutze die Benchmarks für operative Fragen (Raumgrößen, Umsatz, Personal).
      - Antworte professionell, präzise und immer auf Deutsch.
      `;

      // 2. Definition der Tools (Websuche)
      const tools = [
        {
          type: "function",
          function: {
            name: "web_search",
            description:
              "Sucht im Internet nach aktuellen Informationen, Nachrichten oder Fakten.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Der Suchbegriff" },
              },
              required: ["query"],
            },
          },
        },
      ];

      // 3. Initialer Aufruf an GPT-4o
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages as any,
        tools: tools as any,
        tool_choice: "auto",
      });

      const responseMessage = completion.choices[0].message;

      // 4. Prüfen: Will die KI ein Tool nutzen?
      if (responseMessage.tool_calls) {
        // KI will suchen -> Wir führen die Suche aus
        const toolCall = responseMessage.tool_calls[0];

        if (toolCall.function.name === "web_search") {
          const args = JSON.parse(toolCall.function.arguments);
          console.log(`🔎 KI sucht nach: ${args.query}`);

          // Tavily Suche ausführen
          let searchResult;
          try {
            searchResult = await tvly.search(args.query, {
              searchDepth: "basic",
            });
          } catch (e) {
            searchResult = { error: "Suche fehlgeschlagen" };
          }

          // Verlauf aktualisieren
          messages.push(responseMessage as any); // Die Absicht der KI
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(searchResult), // Das Ergebnis der Suche
          } as any);

          // 5. Zweiter Aufruf: KI verarbeitet das Suchergebnis
          const secondResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages as any,
          });

          return res.json({
            response: secondResponse.choices[0].message.content,
          });
        }
      }

      // Fallback: Keine Suche nötig
      res.json({ response: responseMessage.content });
    } catch (error) {
      console.error("Smart Consultant Error:", error);
      res.status(500).json({ error: "Fehler im KI-Berater Modul" });
    }
  });
  // ---------------------------------------------------------

  // Workflow endpoints
  app.get("/api/practices/:id/workflows", requirePracticeAccess, async (req, res) => {
    try {
      const workflows = await storage.getWorkflowsByPracticeId(req.params.id);
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  app.post("/api/practices/:id/workflows", requirePracticeAccess, async (req, res) => {
    try {
      const validated = insertWorkflowSchema.parse({
        ...req.body,
        practiceId: req.params.id,
      });
      const workflow = await storage.createWorkflow(validated);
      res.json(workflow);
    } catch (error) {
      res.status(400).json({ error: "Invalid workflow data" });
    }
  });

  app.put("/api/practices/:id/workflows", requirePracticeAccess, async (req, res) => {
    try {
      const validated = insertWorkflowSchema.parse({
        ...req.body,
        practiceId: req.params.id,
      });
      const workflow = await storage.upsertWorkflow(validated);
      res.json(workflow);
    } catch (error) {
      console.error("Failed to upsert workflow:", error);
      res.status(400).json({ error: "Invalid workflow data" });
    }
  });

  app.delete("/api/workflows/:id", requireWorkflowAccess, async (req, res) => {
    try {
      await storage.deleteWorkflow(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete workflow" });
    }
  });

  // Workflow Steps endpoints (workflow-specific ordered steps)
  app.get("/api/workflows/:id/steps", requireWorkflowAccess, async (req, res) => {
    try {
      const steps = await storage.getWorkflowSteps(req.params.id);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow steps" });
    }
  });

  app.post("/api/workflows/:id/steps", requireWorkflowAccess, async (req, res) => {
    try {
      const maxIndex = await storage.getMaxStepIndex(req.params.id);
      const validated = insertWorkflowStepSchema.parse({
        ...req.body,
        workflowId: req.params.id,
        stepIndex: maxIndex + 1,
      });
      const step = await storage.createWorkflowStep(validated);
      res.json(step);
    } catch (error) {
      console.error("Failed to create workflow step:", error);
      res.status(400).json({ error: "Invalid step data" });
    }
  });

  app.delete("/api/workflow-steps/:id", requireStepAccess, async (req, res) => {
    try {
      await storage.deleteWorkflowStep(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete workflow step" });
    }
  });

  // Workflow connection endpoints (practice-based)

  app.put("/api/workflow-connections/:id", requireConnectionAccess, async (req, res) => {
    try {
      const connection = await storage.updateConnection(req.params.id, req.body);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json(connection);
    } catch (error) {
      res.status(500).json({ error: "Failed to update connection" });
    }
  });

  app.delete("/api/workflow-connections/:id", requireConnectionAccess, async (req, res) => {
    try {
      await storage.deleteConnection(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  // Practice-level workflow connections (alle Connections einer Praxis)
  app.get("/api/practices/:id/workflow-connections", requirePracticeAccess, async (req, res) => {
    try {
      const connections = await storage.getConnectionsByPracticeId(req.params.id);
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow connections" });
    }
  });

  app.post("/api/practices/:id/workflow-connections", requirePracticeAccess, async (req, res) => {
    try {
      const validated = insertWorkflowConnectionSchema.parse({
        ...req.body,
        practiceId: req.params.id,
      });
      const connection = await storage.createConnection(validated);
      res.json(connection);
    } catch (error) {
      res.status(400).json({ error: "Invalid connection data" });
    }
  });

  const analyzeWorkflowsSchema = z.object({
    practiceId: z.string(),
    includeRAG: z.boolean().optional().default(false),
  });

  app.post("/api/ai/analyze-workflows", requirePracticeAccess, aiBudgetGuard, async (req, res) => {
    try {
      const { practiceId, includeRAG } = analyzeWorkflowsSchema.parse(req.body);
      
      const practice = await storage.getPractice(practiceId);
      if (!practice) {
        return res.status(404).json({ error: "Practice not found" });
      }
      
      const rooms = await storage.getRoomsByPracticeId(practiceId);
      const workflows = await storage.getWorkflowsByPracticeId(practiceId);
      
      const workflowStepsMap = new Map<string, any[]>();
      for (const workflow of workflows) {
        const steps = await storage.getWorkflowSteps(workflow.id);
        workflowStepsMap.set(workflow.id, steps);
      }
      
      const { analyzeWorkflows } = await import("./ai/workflowEfficiency");
      const analysis = await analyzeWorkflows(
        practiceId,
        rooms,
        workflows,
        workflowStepsMap,
        practice.layoutScalePxPerMeter ?? DEFAULT_LAYOUT_SCALE_PX_PER_METER
      );
      
      if (includeRAG && analysis.recommendations.length > 0) {
        try {
          const metricsContext = analysis.workflows.map(w => 
            `Workflow "${w.workflowName}": ${w.totalDistanceM}m Gesamtweg, Score ${w.score}/100, ${w.floorChangeCount} Etagenwechsel`
          ).join(". ");
          
          const ragQuestion = `Gib 3 konkrete Optimierungen für Praxisabläufe ohne Umbau. Kontext: ${metricsContext}. Fokus auf Prozessoptimierung, digitale Lösungen und Materialorganisation.`;
          
          const ragResult = await queryRAG(ragQuestion, 3);
          
          (analysis as any).knowledgeInsight = {
            answer: ragResult.answer,
            sources: ragResult.kbChunks.map(c => ({
              docName: c.docName.replace(/\.docx$/i, ""),
              headingPath: c.headingPath || "Allgemein",
            })),
          };
        } catch (ragError) {
          console.error("RAG enhancement failed:", ragError);
        }
      }
      
      res.json(analysis);
    } catch (error) {
      console.error("Workflow analysis error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request parameters" });
      }
      res.status(500).json({ error: "Failed to analyze workflows" });
    }
  });

  return httpServer;
}
