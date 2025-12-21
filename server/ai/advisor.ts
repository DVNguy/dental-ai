import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { Room, Staff, WorkflowConnection } from "@shared/schema";
import {
  ROOM_SIZE_STANDARDS,
  STAFFING_RATIOS,
  PATIENT_FLOW_METRICS,
  LAYOUT_EFFICIENCY_PRINCIPLES,
  INDUSTRY_BENCHMARKS,
  evaluateRoomSize,
  evaluateStaffingRatios,
  calculatePatientCapacityBenchmark,
  getLayoutRecommendations,
  pixelsToSqM
} from "./benchmarks";
import { pxToMeters, normalizeRoomType, DEFAULT_LAYOUT_SCALE_PX_PER_METER } from "@shared/roomTypes";
import { searchKnowledge, formatKnowledgeContext } from "./knowledgeProcessor";
import {
  evaluateRoomSizeWithKnowledge,
  getKnowledgePoweredRecommendations
} from "./artifactBenchmarks";
import { formatCitations } from "./artifactService";
import { pxToM } from "@shared/units";
import {
  classifyStaffForRatios,
  getClassificationDebug,
  type StaffClassificationDebug
} from "./staffRoleClassifier";

// Re-export for backward compatibility with tests
export type { StaffClassificationDebug as StaffingDebugInfo };

const DISTANCE_CLASS_THRESHOLDS = {
  short: { min: 0, max: 3 },
  medium: { min: 3, max: 8 },
  long: { min: 8, max: Infinity }
};

const DISTANCE_CLASS_WEIGHTS = {
  short: 1.0,
  medium: 1.5,
  long: 2.0
};

function getDistanceClass(distanceMeters: number): "short" | "medium" | "long" {
  if (distanceMeters <= DISTANCE_CLASS_THRESHOLDS.short.max) return "short";
  if (distanceMeters <= DISTANCE_CLASS_THRESHOLDS.medium.max) return "medium";
  return "long";
}

export function computeWorkflowAnalysis(
  rooms: Room[],
  connections: WorkflowConnection[]
): WorkflowAnalysis {
  const roomMap = new Map(rooms.map(r => [r.id, r]));
  
  if (connections.length === 0) {
    return {
      workflowCostTotal: 0,
      workflowScore: 70,
      topConnections: [],
      recommendations: [
        "Verbinden Sie Räume im Layout-Editor, um Arbeitsabläufe sichtbar zu machen.",
        "Kanban-Prinzip anwenden: Check-In → Warten → Behandlung → Check-Out als Workflow definieren.",
        "Beginnen Sie mit dem häufigsten Patientenpfad (Empfang → Wartebereich → Behandlungsraum).",
        "Materialien an frequentierten Stationen vorhalten, um Laufwege zu minimieren.",
        "Standardisierte Checklisten für wiederkehrende Abläufe einführen."
      ]
    };
  }

  const connectionDetails: Array<{
    fromName: string;
    toName: string;
    distance: number;
    distanceClass: "short" | "medium" | "long";
    weight: number;
    cost: number;
    fromRoomId: string;
    toRoomId: string;
  }> = [];

  let totalCost = 0;
  const visitedPairs = new Map<string, number>();

  for (const conn of connections) {
    const fromRoom = roomMap.get(conn.fromRoomId);
    const toRoom = roomMap.get(conn.toRoomId);
    
    if (!fromRoom || !toRoom) continue;

    const fromCenter = { x: fromRoom.x + fromRoom.width / 2, y: fromRoom.y + fromRoom.height / 2 };
    const toCenter = { x: toRoom.x + toRoom.width / 2, y: toRoom.y + toRoom.height / 2 };
    
    const distancePx = Math.sqrt(
      Math.pow(toCenter.x - fromCenter.x, 2) + Math.pow(toCenter.y - fromCenter.y, 2)
    );
    const distanceMeters = pxToM(distancePx);
    
    const distanceClass = conn.distanceClass === "auto" || !conn.distanceClass
      ? getDistanceClass(distanceMeters)
      : conn.distanceClass as "short" | "medium" | "long";
    
    const userWeight = conn.weight || 1;
    const classWeight = DISTANCE_CLASS_WEIGHTS[distanceClass];
    const cost = distanceMeters * userWeight * classWeight;
    
    totalCost += cost;

    connectionDetails.push({
      fromName: fromRoom.name || fromRoom.type,
      toName: toRoom.name || toRoom.type,
      distance: Math.round(distanceMeters * 10) / 10,
      distanceClass,
      weight: userWeight,
      cost: Math.round(cost * 10) / 10,
      fromRoomId: conn.fromRoomId,
      toRoomId: conn.toRoomId
    });

    const pairKey = [conn.fromRoomId, conn.toRoomId].sort().join("-");
    visitedPairs.set(pairKey, (visitedPairs.get(pairKey) || 0) + 1);
  }

  const backtrackingPairs = Array.from(visitedPairs.entries()).filter(([_, count]) => count > 1);
  const hasBacktracking = backtrackingPairs.length > 0;
  const longConnections = connectionDetails.filter(c => c.distanceClass === "long");
  const mediumConnections = connectionDetails.filter(c => c.distanceClass === "medium");
  const hasLongConnections = longConnections.length > 0;

  const avgCostPerConnection = connections.length > 0 ? totalCost / connections.length : 0;
  const penaltyPerPoint = 2;
  const normalizedPenalty = Math.min(30, avgCostPerConnection * penaltyPerPoint / 3);
  let workflowScore = Math.round(100 - normalizedPenalty);
  
  if (hasBacktracking) workflowScore -= 3;
  if (hasLongConnections) workflowScore -= longConnections.length * 2;
  if (mediumConnections.length > 2) workflowScore -= 2;
  
  workflowScore = Math.max(0, Math.min(100, workflowScore));

  const recommendations: string[] = [];

  if (hasLongConnections) {
    const longNames = longConnections.map(c => `${c.fromName}→${c.toName}`).join(", ");
    recommendations.push(
      `Lange Wege (${longNames}): Material-Staging an diesen Stationen einrichten oder Aufgaben bündeln.`
    );
  }

  if (hasBacktracking) {
    recommendations.push(
      "Rückläufige Bewegungen: Checklisten und standardisierte Abläufe helfen, Hin- und Herlaufen zu reduzieren."
    );
  }

  const patientKind = connections.filter(c => c.kind === "patient");
  const staffKind = connections.filter(c => c.kind === "staff");
  
  if (patientKind.length === 0 && staffKind.length > 0) {
    recommendations.push(
      "Patientenpfad definieren: Check-In → Warten → Behandlung als separate Verbindungen anlegen."
    );
  }

  if (avgCostPerConnection > 12) {
    recommendations.push(
      "Hohe Wegkosten: Prüfen Sie Material-Bereitstellung und Aufgaben-Bündelung an frequentierten Stationen."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Gute Arbeitsabläufe! Materialien direkt am Einsatzort lagern optimiert den Workflow weiter."
    );
  }

  if (recommendations.length < 3) {
    recommendations.push(
      "Lean-Tipp: Kanban-Tafeln (Check-In → Warten → Behandlung → Check-Out) machen den Workflow sichtbar."
    );
  }

  if (recommendations.length < 4 && mediumConnections.length > 0) {
    recommendations.push(
      "Mittlere Distanzen: Überlegen Sie, ob häufig benötigte Materialien an Zwischenstationen bereitgestellt werden können."
    );
  }

  const topConnections = connectionDetails
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 3)
    .map(({ fromName, toName, distance, distanceClass, weight, cost }) => ({
      fromName,
      toName,
      distance,
      distanceClass,
      weight,
      cost
    }));

  return {
    workflowCostTotal: Math.round(totalCost * 10) / 10,
    workflowScore,
    topConnections,
    recommendations: recommendations.slice(0, 5)
  };
}

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

const AIInsightsSchema = z.object({
  analysis: z.string().describe("Kurze 1-2 Sätze Analyse der aktuellen Praxis-Situation"),
  keyImprovement: z.string().describe("Die wichtigste Verbesserung basierend auf Coach-Erfahrung"),
  marketComparison: z.string().describe("Wie die Praxis im Vergleich zu erfolgreichen Praxen abschneidet"),
  practicalTip: z.string().describe("Ein konkreter, umsetzbarer Tipp aus der Praxis")
});

const QuickRecommendationSchema = z.object({
  recommendation: z.string().describe("Die konkrete Empfehlung ohne Quellenangaben"),
  reasoning: z.string().describe("Kurze Begründung für die Empfehlung")
});

export interface WorkflowAnalysis {
  workflowCostTotal: number;
  workflowScore: number;
  topConnections: Array<{
    fromName: string;
    toName: string;
    distance: number;
    distanceClass: "short" | "medium" | "long";
    weight: number;
    cost: number;
  }>;
  recommendations: string[];
}

export interface LayoutAnalysis {
  overallScore: number;
  efficiencyScore: number;
  staffingScore: number;
  spaceUtilizationScore: number;
  roomAnalyses: RoomAnalysis[];
  staffingAnalysis: StaffingAnalysis;
  capacityAnalysis: CapacityAnalysis;
  recommendations: string[];
  aiInsights: string;
  workflowAnalysis?: WorkflowAnalysis;
}

export interface RoomAnalysis {
  roomId: string;
  roomName: string;
  roomType: string;
  sizeScore: number;
  sizeAssessment: "undersized" | "optimal" | "oversized";
  actualSqM: number;
  recommendation: string;
  source?: string;
  fromKnowledge?: boolean;
}

export interface StaffingAnalysis {
  overallScore: number;
  ratios: Record<string, {
    actual: number;
    optimal: number;
    score: number;
    recommendation: string;
  }>;
}

export interface CapacityAnalysis {
  estimatedCapacity: number;
  capacityScore: number;
  benchmarkComparison: string;
}

function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function getRoomCenter(room: Room): { x: number; y: number } {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2
  };
}

function calculateLayoutEfficiencyScore(rooms: Room[], scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER): number {
  if (rooms.length === 0) return 0;

  const roomsByType = new Map<string, Room[]>();
  rooms.forEach(room => {
    const normalizedType = normalizeRoomType(room.type);
    if (!roomsByType.has(normalizedType)) {
      roomsByType.set(normalizedType, []);
    }
    roomsByType.get(normalizedType)!.push(room);
  });

  let score = 50;

  const reception = roomsByType.get("reception")?.[0];
  const waiting = roomsByType.get("waiting")?.[0];
  const examRooms = roomsByType.get("exam") || [];
  const lab = roomsByType.get("lab")?.[0];

  if (reception && waiting) {
    const recCenter = getRoomCenter(reception);
    const waitCenter = getRoomCenter(waiting);
    const distancePx = calculateDistance(recCenter.x, recCenter.y, waitCenter.x, waitCenter.y);
    const distanceM = pxToMeters(distancePx, scalePxPerMeter);
    
    const benchmark = LAYOUT_EFFICIENCY_PRINCIPLES.distanceGuidelines.receptionToWaiting;
    if (distanceM <= benchmark.optimal) {
      score += 15;
    } else if (distanceM <= benchmark.maxMeters) {
      score += 10;
    } else {
      score -= 5;
    }
  }

  if (waiting && examRooms.length > 0) {
    const waitCenter = getRoomCenter(waiting);
    const avgDistance = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistance(waitCenter.x, waitCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;
    
    const distanceM = pxToMeters(avgDistance, scalePxPerMeter);
    const benchmark = LAYOUT_EFFICIENCY_PRINCIPLES.distanceGuidelines.waitingToExam;
    
    if (distanceM <= benchmark.optimal) {
      score += 15;
    } else if (distanceM <= benchmark.maxMeters) {
      score += 8;
    } else {
      score -= 5;
    }
  }

  if (lab && examRooms.length > 0) {
    const labCenter = getRoomCenter(lab);
    const avgDistance = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistance(labCenter.x, labCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;
    
    const distanceM = pxToMeters(avgDistance, scalePxPerMeter);
    const benchmark = LAYOUT_EFFICIENCY_PRINCIPLES.distanceGuidelines.examToLab;
    
    if (distanceM <= benchmark.optimal) {
      score += 12;
    } else if (distanceM <= benchmark.maxMeters) {
      score += 6;
    } else {
      score -= 3;
    }
  }

  if (!reception) score -= 15;
  if (!waiting) score -= 10;
  if (examRooms.length === 0) score -= 20;

  return Math.max(0, Math.min(100, score));
}

async function analyzeRoomsWithKnowledge(rooms: Room[], scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER): Promise<RoomAnalysis[]> {
  const analyses = await Promise.all(
    rooms.map(async (room) => {
      const evaluation = await evaluateRoomSizeWithKnowledge(room.type, room.width, room.height, scalePxPerMeter);
      return {
        roomId: room.id,
        roomName: room.name || room.type,
        roomType: room.type,
        sizeScore: evaluation.score,
        sizeAssessment: evaluation.assessment,
        actualSqM: evaluation.actualSqM,
        recommendation: evaluation.recommendation,
        source: evaluation.citations.length > 0 ? formatCitations(evaluation.citations).join(", ") : undefined,
        fromKnowledge: evaluation.fromKnowledge
      };
    })
  );
  return analyses;
}

/**
 * Extended StaffingAnalysis with optional debug info
 */
export interface StaffingAnalysisWithDebug extends StaffingAnalysis {
  debug?: StaffClassificationDebug;
}

/**
 * Analyzes staffing ratios for a practice using centralized role classification.
 *
 * Uses the central staffRoleClassifier module for consistent role classification
 * across all services (advisor, simulation, hrController).
 *
 * Role classification (Praxisflow-compatible with pattern matching):
 * - Providers: zahnarzt, zahnärztin, dentist, doctor, behandler, arzt, etc.
 * - Clinical Assistants: zfa, dh, mfa, assistenz, prophylaxe, sterilisation, etc.
 * - Frontdesk: empfang, rezeption, anmeldung, receptionist, frontdesk, etc.
 * - Excluded from ratios: practice_manager, praxismanager, manager, admin, etc.
 *
 * @param includeDebug - If true, includes debug info with role histogram and unknown roles
 */
function analyzeStaffing(staff: Staff[], rooms: Room[], includeDebug = false): StaffingAnalysisWithDebug {
  // Use centralized classifier
  const classification = classifyStaffForRatios(staff);

  const examRooms = rooms.filter(r => normalizeRoomType(r.type) === "exam").length;

  const baseResult = evaluateStaffingRatios({
    providersCount: classification.providersCount,
    clinicalAssistantsCount: classification.clinicalAssistantsCount,
    frontdeskCount: classification.frontdeskCount,
    supportTotalCount: classification.supportTotalCount,
    providersFte: classification.providersFte,
    clinicalAssistantsFte: classification.clinicalAssistantsFte,
    frontdeskFte: classification.frontdeskFte,
    supportTotalFte: classification.supportTotalFte,
    totalStaff: staff.length,
    examRooms
  });

  // Build result with optional debug info
  const result: StaffingAnalysisWithDebug = { ...baseResult };

  if (includeDebug) {
    result.debug = getClassificationDebug(classification);
  }

  return result;
}

function analyzeCapacity(rooms: Room[], staff: Staff[], operatingHours: number = 8): CapacityAnalysis {
  const examRooms = rooms.filter(r => normalizeRoomType(r.type) === "exam").length;
  const classification = classifyStaffForRatios(staff);

  return calculatePatientCapacityBenchmark(examRooms, operatingHours, classification.providersCount);
}

async function generateAIInsights(
  rooms: Room[],
  staff: Staff[],
  efficiencyScore: number,
  staffingScore: number,
  recommendations: string[]
): Promise<string> {
  const roomsByType = new Map<string, number>();
  rooms.forEach(room => {
    roomsByType.set(room.type, (roomsByType.get(room.type) || 0) + 1);
  });

  const staffByRole = new Map<string, number>();
  staff.forEach(s => {
    staffByRole.set(s.role, (staffByRole.get(s.role) || 0) + 1);
  });

  const roomsSummary = Array.from(roomsByType.entries())
    .map(([type, count]) => `${count} ${type}(s)`)
    .join(", ");
  
  const staffSummary = Array.from(staffByRole.entries())
    .map(([role, count]) => `${count} ${role}(s)`)
    .join(", ");

  const searchQuery = `Zahnarztpraxis Optimierung ${roomsSummary} ${staffSummary} Effizienz Layout`;
  let coachKnowledge = "";
  try {
    const knowledgeResults = await searchKnowledge(searchQuery, 3);
    coachKnowledge = formatKnowledgeContext(knowledgeResults);
  } catch (error) {
    console.log("No coaching knowledge available yet, using base standards");
  }

  const systemPrompt = `Du bist ein erfahrener Zahnarztpraxis-Coach und Berater. Gib strukturierte Empfehlungen basierend auf den Praxisdaten. KEINE Quellenangaben, Dokumenttitel oder Kapitelnummern. Nur reiner Empfehlungstext, professionell und freundlich auf Deutsch.`;

  const userPrompt = `${coachKnowledge}

PRAXIS-DATEN:
- Räume: ${roomsSummary || "Noch keine Räume"}
- Personal: ${staffSummary || "Noch kein Personal"}
- Layout-Effizienz Score: ${efficiencyScore}/100
- Personal-Score: ${staffingScore}/100

DEUTSCHE STANDARDS (Ergänzend):
- Raumgrößen: Arbeitsstättenverordnung (ArbStättV) & Praxisbegehung
- Personal: KV-Benchmarks (2.5-4.0 Mitarbeiter pro Arzt)
- Patientenfluss: QM-Richtlinie G-BA

AKTUELLE EMPFEHLUNGEN:
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Analysiere die Praxis und gib strukturierte Empfehlungen.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 500,
      response_format: zodResponseFormat(AIInsightsSchema, "ai_insights")
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return "KI-Analyse ist derzeit nicht verfügbar.";
    }

    const parsed = AIInsightsSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.error("AI Insights parse error:", parsed.error);
      return content;
    }

    const insight = parsed.data;
    return `${insight.analysis}\n\n**Wichtigste Verbesserung:** ${insight.keyImprovement}\n**Marktvergleich:** ${insight.marketComparison}\n**Praxis-Tipp:** ${insight.practicalTip}`;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "KI-Analyse ist vorübergehend nicht verfügbar. Bitte beachten Sie die benchmark-basierten Empfehlungen oben.";
  }
}

/**
 * Analysis metadata for debugging and cache control
 */
export interface AnalysisMeta {
  computedAt: string;       // ISO timestamp
  fromCache: boolean;       // Currently always false (no caching implemented)
  forceApplied: boolean;    // Whether force=1 was requested
  debugEnabled: boolean;    // Whether debug=1 was requested
  source: "advisor";        // Indicates which pipeline produced this analysis
}

/**
 * Extended LayoutAnalysis with optional meta and debug
 */
export interface LayoutAnalysisExtended extends LayoutAnalysis {
  analysisMeta?: AnalysisMeta;
}

/**
 * Options for analyzeLayout
 */
export interface AnalyzeLayoutOptions {
  force?: boolean;   // Force recompute (currently no-op since no caching)
  debug?: boolean;   // Include debug info in staffingAnalysis
}

export async function analyzeLayout(
  rooms: Room[],
  staff: Staff[],
  operatingHours: number = 8,
  scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER,
  connections: WorkflowConnection[] = [],
  options: AnalyzeLayoutOptions = {}
): Promise<LayoutAnalysisExtended> {
  const { force = false, debug = false } = options;

  const efficiencyScore = calculateLayoutEfficiencyScore(rooms, scalePxPerMeter);

  const workflowAnalysis = computeWorkflowAnalysis(rooms, connections);

  const roomAnalyses = await analyzeRoomsWithKnowledge(rooms, scalePxPerMeter);
  const avgRoomScore = roomAnalyses.length > 0
    ? roomAnalyses.reduce((sum, r) => sum + r.sizeScore, 0) / roomAnalyses.length
    : 50;

  // Pass debug flag to get role histogram and unknown roles
  const staffingAnalysis = analyzeStaffing(staff, rooms, debug);

  const capacityAnalysis = analyzeCapacity(rooms, staff, operatingHours);

  const hasReception = rooms.some(r => normalizeRoomType(r.type) === "reception");
  const hasWaiting = rooms.some(r => normalizeRoomType(r.type) === "waiting");
  const examRoomCount = rooms.filter(r => normalizeRoomType(r.type) === "exam").length;
  const hasLab = rooms.some(r => normalizeRoomType(r.type) === "lab");
  const hasOffice = rooms.some(r => normalizeRoomType(r.type) === "office");

  const knowledgeRecommendations = await getKnowledgePoweredRecommendations(
    hasReception,
    hasWaiting,
    examRoomCount,
    hasLab,
    hasOffice
  );

  const recommendations: string[] = knowledgeRecommendations.map(rec => {
    const citation = rec.citations.length > 0 ? ` [${formatCitations(rec.citations).join(", ")}]` : "";
    return rec.text + citation;
  });

  roomAnalyses.forEach(analysis => {
    if (analysis.sizeAssessment !== "optimal") {
      const source = analysis.source ? ` [${analysis.source}]` : "";
      recommendations.push(`${analysis.roomName}: ${analysis.recommendation}${source}`);
    }
  });

  Object.entries(staffingAnalysis.ratios).forEach(([key, ratio]) => {
    if (ratio.score < 80) {
      recommendations.push(ratio.recommendation);
    }
  });

  const safeEfficiency = isNaN(efficiencyScore) ? 0 : efficiencyScore;
  const safeRoomScore = isNaN(avgRoomScore) ? 50 : avgRoomScore;
  const safeStaffingScore = isNaN(staffingAnalysis.overallScore) ? 50 : staffingAnalysis.overallScore;
  const safeCapacityScore = isNaN(capacityAnalysis.capacityScore) || capacityAnalysis.capacityScore === null 
    ? 0 : capacityAnalysis.capacityScore;
  
  const overallScore = Math.round(
    (safeEfficiency * 0.35) +
    (safeRoomScore * 0.25) +
    (safeStaffingScore * 0.25) +
    (safeCapacityScore * 0.15)
  );

  const aiInsights = await generateAIInsights(
    rooms,
    staff,
    efficiencyScore,
    staffingAnalysis.overallScore,
    recommendations.slice(0, 5)
  );

  // Build result with optional meta
  const result: LayoutAnalysisExtended = {
    overallScore,
    efficiencyScore: Math.round(efficiencyScore),
    staffingScore: staffingAnalysis.overallScore,
    spaceUtilizationScore: Math.round(avgRoomScore),
    roomAnalyses,
    staffingAnalysis,
    capacityAnalysis,
    recommendations: recommendations.slice(0, 10),
    aiInsights,
    workflowAnalysis,
  };

  // Add analysis metadata (only if force or debug was requested, or always for transparency)
  if (force || debug) {
    result.analysisMeta = {
      computedAt: new Date().toISOString(),
      fromCache: false,  // No caching implemented
      forceApplied: force,
      debugEnabled: debug,
      source: "advisor",  // Indicates this analysis comes from the advisor pipeline
    };
  }

  return result;
}

export async function getQuickRecommendation(
  rooms: Room[],
  staff: Staff[],
  question?: string,
  scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER
): Promise<string> {
  const roomsByType = new Map<string, number>();
  rooms.forEach(room => {
    const normalizedType = normalizeRoomType(room.type);
    roomsByType.set(normalizedType, (roomsByType.get(normalizedType) || 0) + 1);
  });

  const staffByRole = new Map<string, number>();
  staff.forEach(s => {
    staffByRole.set(s.role, (staffByRole.get(s.role) || 0) + 1);
  });

  const roomsSummary = Array.from(roomsByType.entries())
    .map(([type, count]) => `${count} ${type}(s)`)
    .join(", ");
  
  const staffSummary = Array.from(staffByRole.entries())
    .map(([role, count]) => `${count} ${role}(s)`)
    .join(", ");

  const totalArea = rooms.reduce((sum, room) => sum + pixelsToSqM(room.width, room.height, scalePxPerMeter), 0);

  const searchQuery = question || `Zahnarztpraxis Optimierung ${roomsSummary} ${staffSummary}`;
  let coachKnowledge = "";
  try {
    const knowledgeResults = await searchKnowledge(searchQuery, 5);
    coachKnowledge = formatKnowledgeContext(knowledgeResults);
  } catch (error) {
    console.log("No coaching knowledge available yet, using base standards");
  }

  const prompt = `Du bist ein erfahrener Zahnarztpraxis-Coach.

${coachKnowledge}

PRAXIS-SETUP:
- Räume: ${roomsSummary || "Keine"} (Gesamtfläche: ~${totalArea} m²)
- Personal: ${staffSummary || "Keines"}

DEUTSCHE STANDARDS (Ergänzend):
- Behandlungsräume: 9-12 m² pro Raum, 3-4 pro Arzt
- Mitarbeiter: 2.5-4.0 pro Arzt
- Wartezeit-Ziel: <15 Min. (ausgezeichnet)

${question ? `NUTZERFRAGE: ${question}` : "Gib eine wichtige Empfehlung zur Verbesserung dieser Praxis."}

Gib eine konkrete, umsetzbare Empfehlung. KEINE Quellenangaben, Dokumenttitel oder Kapitelnummern. Unter 100 Wörter, auf Deutsch.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      response_format: zodResponseFormat(QuickRecommendationSchema, "quick_recommendation")
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return "Empfehlung konnte nicht generiert werden.";
    }

    const parsed = QuickRecommendationSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.error("Quick recommendation parse error:", parsed.error);
      return content;
    }

    return parsed.data.recommendation;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "KI-Empfehlungen sind vorübergehend nicht verfügbar. Bitte prüfen Sie Ihr Layout gegen die deutschen Standards.";
  }
}
