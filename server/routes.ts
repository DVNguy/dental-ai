import type { Express } from "express";
import { type Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import {
  requirePracticeAccess,
  requireRoomAccess,
  requireStaffAccess,
  requireWorkflowAccess,
  requireConnectionAccess,
  requireStepAccess,
  requireElementAccess,
} from "./auth";
import { storage } from "./storage";
import { hashPassword } from "./auth";
import passport from "passport";
import { aiRateLimiter, aiBudgetGuard } from "./rateLimit";

import * as practiceController from "./controllers/practiceController";
import * as workflowController from "./controllers/workflowController";
import * as aiController from "./controllers/aiController";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  setupAuth(app);

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("User already exists");
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.upsertUser({
        ...req.body,
        email: req.body.username, // Using username field as email
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        return res.json(user);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
  app.get('/api/me', isAuthenticated, practiceController.handleGetUser);

  app.use("/api", (req, res, next) => {
    if (req.path === "/login" || req.path === "/callback" || req.path === "/logout") return next();
    if (req.path.startsWith("/auth")) return next();
    if (req.path === "/debug/status") return next();
    return isAuthenticated(req, res, next);
  });

  app.use("/api/ai", aiRateLimiter);
  app.use("/api/v1/rag", aiRateLimiter);

  app.get("/api/debug/status", practiceController.getDebugStatus);

  app.get("/api/practices/:id", requirePracticeAccess, practiceController.getPractice);
  app.post("/api/practices", practiceController.createPractice);
  app.put("/api/practices/:id/budget", requirePracticeAccess, practiceController.updateBudget);
  app.get("/api/practices/:id/layout-efficiency", requirePracticeAccess, practiceController.getLayoutEfficiencyBreakdown);
  app.post("/api/layout/efficiency", requirePracticeAccess, practiceController.computeLayoutEfficiencyHandler);

  app.get("/api/practices/:id/rooms", requirePracticeAccess, practiceController.getRooms);
  app.post("/api/practices/:id/rooms", requirePracticeAccess, practiceController.createRoom);
  app.put("/api/rooms/:id", requireRoomAccess, practiceController.updateRoom);
  app.delete("/api/rooms/:id", requireRoomAccess, practiceController.deleteRoom);

  app.get("/api/practices/:id/staff", requirePracticeAccess, practiceController.getStaff);
  app.post("/api/practices/:id/staff", requirePracticeAccess, practiceController.createStaff);
  app.put("/api/staff/:id", requireStaffAccess, practiceController.updateStaff);
  app.delete("/api/staff/:id", requireStaffAccess, practiceController.deleteStaff);

  app.get("/api/practices/:id/elements", requirePracticeAccess, practiceController.getArchitecturalElements);
  app.post("/api/practices/:id/elements", requirePracticeAccess, practiceController.createArchitecturalElement);
  app.put("/api/elements/:id", requireElementAccess, practiceController.updateArchitecturalElement);
  app.delete("/api/elements/:id", requireElementAccess, practiceController.deleteArchitecturalElement);

  app.post("/api/simulations", requirePracticeAccess, aiController.createSimulation);
  app.get("/api/practices/:id/simulations", requirePracticeAccess, aiController.getSimulations);
  app.post("/api/simulations/run", requirePracticeAccess, aiController.runSimulationHandler);

  app.post("/api/ai/analyze-layout", requirePracticeAccess, aiBudgetGuard, aiController.analyzeLayoutHandler);
  app.post("/api/ai/recommend", requirePracticeAccess, aiBudgetGuard, aiController.recommendHandler);
  app.post("/api/ai/coach-chat", aiController.coachChatHandler);
  app.post("/api/ai/chat", aiController.smartConsultantChat);
  app.post("/api/ai/analyze-workflows", requirePracticeAccess, aiBudgetGuard, aiController.analyzeWorkflowsHandler);

  app.get("/api/knowledge", aiController.getKnowledgeSources);
  app.get("/api/knowledge/inventory-rules", aiController.getInventoryRulesHandler);
  app.get("/api/knowledge/inventory", aiController.getInventoryRulesHandler);
  app.get("/api/knowledge/:id", aiController.getKnowledgeSource);
  app.post("/api/knowledge/search", aiController.searchKnowledgeHandler);

  app.post("/api/v1/rag/query", aiController.ragQueryHandler);

  app.get("/api/benchmarks", aiController.getBenchmarks);
  app.get("/api/playbooks", aiController.getPlaybooks);
  app.get("/api/playbooks/:id", aiController.getPlaybook);

  app.get("/api/practices/:id/workflows", requirePracticeAccess, workflowController.getWorkflows);
  app.post("/api/practices/:id/workflows", requirePracticeAccess, workflowController.createWorkflow);
  app.put("/api/practices/:id/workflows", requirePracticeAccess, workflowController.upsertWorkflow);
  app.delete("/api/workflows/:id", requireWorkflowAccess, workflowController.deleteWorkflow);

  app.get("/api/workflows/:id/steps", requireWorkflowAccess, workflowController.getWorkflowSteps);
  app.post("/api/workflows/:id/steps", requireWorkflowAccess, workflowController.createWorkflowStep);
  app.put("/api/workflow-steps/:id", requireStepAccess, workflowController.updateWorkflowStep);
  app.delete("/api/workflow-steps/:id", requireStepAccess, workflowController.deleteWorkflowStep);

  app.get("/api/practices/:id/workflow-connections", requirePracticeAccess, workflowController.getConnections);
  app.post("/api/practices/:id/workflow-connections", requirePracticeAccess, workflowController.createConnection);
  app.put("/api/workflow-connections/:id", requireConnectionAccess, workflowController.updateConnection);
  app.delete("/api/workflow-connections/:id", requireConnectionAccess, workflowController.deleteConnection);

  return httpServer;
}
