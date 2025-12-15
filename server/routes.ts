import type { Express } from "express";
import { type Server } from "http";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  requirePracticeAccess,
  requireRoomAccess,
  requireStaffAccess,
  requireWorkflowAccess,
  requireConnectionAccess,
  requireStepAccess,
} from "./auth";
import { aiRateLimiter, aiBudgetGuard } from "./rateLimit";

import * as practiceController from "./controllers/practiceController";
import * as workflowController from "./controllers/workflowController";
import * as aiController from "./controllers/aiController";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await setupAuth(app);

  app.get('/api/auth/user', isAuthenticated, practiceController.handleGetUser);
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

  app.post("/api/simulations", requirePracticeAccess, aiController.createSimulation);
  app.get("/api/practices/:id/simulations", requirePracticeAccess, aiController.getSimulations);
  app.post("/api/simulations/run", requirePracticeAccess, aiController.runSimulationHandler);

  app.post("/api/ai/analyze-layout", requirePracticeAccess, aiBudgetGuard, aiController.analyzeLayoutHandler);
  app.post("/api/ai/recommend", requirePracticeAccess, aiBudgetGuard, aiController.recommendHandler);
  app.post("/api/ai/coach-chat", aiController.coachChatHandler);
  app.post("/api/ai/chat", aiController.smartConsultantChat);
  app.post("/api/ai/analyze-workflows", requirePracticeAccess, aiBudgetGuard, aiController.analyzeWorkflowsHandler);

  app.get("/api/knowledge", aiController.getKnowledgeSources);
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
  app.delete("/api/workflow-steps/:id", requireStepAccess, workflowController.deleteWorkflowStep);

  app.get("/api/practices/:id/workflow-connections", requirePracticeAccess, workflowController.getConnections);
  app.post("/api/practices/:id/workflow-connections", requirePracticeAccess, workflowController.createConnection);
  app.put("/api/workflow-connections/:id", requireConnectionAccess, workflowController.updateConnection);
  app.delete("/api/workflow-connections/:id", requireConnectionAccess, workflowController.deleteConnection);

  return httpServer;
}
