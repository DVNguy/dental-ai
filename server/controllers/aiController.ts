import type { Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertSimulationSchema } from "@shared/schema";
import { runSimulation } from "../simulation";
import { analyzeLayout, getQuickRecommendation } from "../ai/advisor";
import { searchKnowledge } from "../ai/knowledgeProcessor";
import { queryRAG } from "../ai/ragQuery";
import {
  getKnowledgePoweredRoomSizes,
  getKnowledgePoweredStaffing,
  getKnowledgePoweredScheduling,
  getHealthScoreDrivers,
} from "../ai/artifactBenchmarks";
import { getArtifacts } from "../ai/artifactService";
import { DENTAL_BENCHMARKS } from "../ai/benchmarks";
import { DEFAULT_LAYOUT_SCALE_PX_PER_METER } from "@shared/roomTypes";
import { OpenAI } from "openai";
import { tavily } from "@tavily/core";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || "tvly-DUMMY" });

const runSimulationSchema = z.object({
  practiceId: z.string(),
  patientVolume: z.number().min(1).max(1000),
  operatingHours: z.number().min(1).max(24),
});

const analyzeLayoutSchema = z.object({
  practiceId: z.string(),
  operatingHours: z.number().min(1).max(24).optional().default(8),
});

const recommendSchema = z.object({
  practiceId: z.string(),
  question: z.string().optional(),
});

const searchKnowledgeSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(20).optional().default(5),
});

const coachChatSchema = z.object({
  question: z.string().min(1),
});

const ragQuerySchema = z.object({
  question: z.string().min(1),
  topK: z.number().min(1).max(20).optional().default(5),
});

const analyzeWorkflowsSchema = z.object({
  practiceId: z.string(),
  includeRAG: z.boolean().optional().default(false),
});

export async function createSimulation(req: Request, res: Response) {
  try {
    const validated = insertSimulationSchema.parse(req.body);
    const simulation = await storage.createSimulation(validated);
    res.json(simulation);
  } catch (error) {
    res.status(400).json({ error: "Invalid simulation data" });
  }
}

export async function getSimulations(req: Request, res: Response) {
  try {
    const simulations = await storage.getSimulationsByPracticeId(req.params.id);
    res.json(simulations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch simulations" });
  }
}

export async function runSimulationHandler(req: Request, res: Response) {
  try {
    const { practiceId, patientVolume, operatingHours } = runSimulationSchema.parse(req.body);
    const practice = await storage.getPractice(practiceId);
    if (!practice) {
      return res.status(404).json({ error: "Practice not found" });
    }

    const rooms = await storage.getRoomsByPracticeId(practiceId);
    const staff = await storage.getStaffByPracticeId(practiceId);

    const parameters = {
      patientVolume,
      operatingHours,
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
}

export async function analyzeLayoutHandler(req: Request, res: Response) {
  try {
    const { practiceId, operatingHours } = analyzeLayoutSchema.parse(req.body);
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
}

export async function recommendHandler(req: Request, res: Response) {
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
}

export async function getKnowledgeSources(req: Request, res: Response) {
  try {
    const sources = await storage.getAllKnowledgeSources();
    res.json(sources);
  } catch (error) {
    console.error("Failed to fetch knowledge sources:", error);
    res.status(500).json({ error: "Failed to fetch knowledge sources" });
  }
}

export async function getKnowledgeSource(req: Request, res: Response) {
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
}

export async function searchKnowledgeHandler(req: Request, res: Response) {
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
}

export async function coachChatHandler(req: Request, res: Response) {
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
}

export async function ragQueryHandler(req: Request, res: Response) {
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
}

export async function getBenchmarks(req: Request, res: Response) {
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
}

export async function getPlaybooks(req: Request, res: Response) {
  try {
    const playbooks = await getArtifacts({ artifactType: "playbook" });
    res.json(playbooks);
  } catch (error) {
    console.error("Error fetching playbooks:", error);
    res.status(500).json({ error: "Failed to fetch playbooks" });
  }
}

export async function getPlaybook(req: Request, res: Response) {
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
}

export async function smartConsultantChat(req: Request, res: Response) {
  try {
    const { message } = req.body;
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

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "web_search",
          description: "Sucht im Internet nach aktuellen Informationen, Nachrichten oder Fakten.",
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

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto",
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls) {
      const toolCall = responseMessage.tool_calls[0];

      if (toolCall.function.name === "web_search") {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`🔎 KI sucht nach: ${args.query}`);

        let searchResult;
        try {
          searchResult = await tvly.search(args.query, { searchDepth: "basic" });
        } catch (e) {
          searchResult = { error: "Suche fehlgeschlagen" };
        }

        messages.push(responseMessage);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(searchResult),
        });

        const secondResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
        });

        return res.json({ response: secondResponse.choices[0].message.content });
      }
    }

    res.json({ response: responseMessage.content });
  } catch (error) {
    console.error("Smart Consultant Error:", error);
    res.status(500).json({ error: "Fehler im KI-Berater Modul" });
  }
}

export async function analyzeWorkflowsHandler(req: Request, res: Response) {
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
    
    const { analyzeWorkflows } = await import("../ai/workflowEfficiency");
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
}
