import type { Request, Response } from "express";
import { storage } from "../storage";
import { insertWorkflowSchema, insertWorkflowConnectionSchema, insertWorkflowStepSchema } from "@shared/schema";

export async function getWorkflows(req: Request, res: Response) {
  try {
    const workflows = await storage.getWorkflowsByPracticeId(req.params.id);
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
}

export async function createWorkflow(req: Request, res: Response) {
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
}

export async function upsertWorkflow(req: Request, res: Response) {
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
}

export async function deleteWorkflow(req: Request, res: Response) {
  try {
    await storage.deleteWorkflow(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete workflow" });
  }
}

export async function getWorkflowSteps(req: Request, res: Response) {
  try {
    const steps = await storage.getWorkflowSteps(req.params.id);
    res.json(steps);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch workflow steps" });
  }
}

export async function createWorkflowStep(req: Request, res: Response) {
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
}

export async function updateWorkflowStep(req: Request, res: Response) {
  try {
    const step = await storage.updateWorkflowStep(req.params.id, req.body);
    if (!step) {
      return res.status(404).json({ error: "Workflow step not found" });
    }
    res.json(step);
  } catch (error) {
    res.status(500).json({ error: "Failed to update workflow step" });
  }
}

export async function deleteWorkflowStep(req: Request, res: Response) {
  try {
    await storage.deleteWorkflowStep(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete workflow step" });
  }
}

export async function getConnections(req: Request, res: Response) {
  try {
    const connections = await storage.getConnectionsByPracticeId(req.params.id);
    res.json(connections);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch workflow connections" });
  }
}

export async function createConnection(req: Request, res: Response) {
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
}

export async function updateConnection(req: Request, res: Response) {
  try {
    const connection = await storage.updateConnection(req.params.id, req.body);
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    res.json(connection);
  } catch (error) {
    res.status(500).json({ error: "Failed to update connection" });
  }
}

export async function deleteConnection(req: Request, res: Response) {
  try {
    await storage.deleteConnection(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete connection" });
  }
}
