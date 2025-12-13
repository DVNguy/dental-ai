import OpenAI from "openai";
import type { Room, Staff } from "@shared/schema";
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

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

/**
 * Strips internal KB citation metadata from recommendation text.
 * Removes:
 * - Bracketed citations: [KB-Quelle: ...], [Quelle X]
 * - Parenthetical citations: (Quelle 1), (Band 6.1, „QM...")
 * - Quoted KB titles: *"Document Title"*, „Document Title"
 * - Source attribution phrases: Laut Coach-Wissen, gemäß Coach-Wissen, basierend auf
 * - Trailing "gemäß ..." with breadcrumb paths containing ">"
 * - Knowledge base file paths and heading structures
 * - Markdown formatting: **bold**, *italic*
 */
function cleanRecommendationText(text: string): string {
  let cleaned = text;
  
  // STEP 1: Remove complete attribution phrases BEFORE stripping markdown
  // This preserves the structure so patterns like "basierend auf *Title*" match correctly
  
  // Remove "basierend auf *..." patterns with any content including titles
  cleaned = cleaned.replace(/\s*basierend auf\s+\*+[^*]+\*+\s*[,:]?/gi, ' ');
  
  // Remove "gemäß *..." patterns with any content
  cleaned = cleaned.replace(/\s*gemäß\s+\*+[^*]+\*+\s*[,:]?/gi, ' ');
  
  // Remove "laut *..." patterns with any content  
  cleaned = cleaned.replace(/\s*laut\s+\*+[^*]+\*+\s*[,:]?/gi, ' ');
  
  // Remove "gemäß <breadcrumb path>" patterns (paths with > separators)
  cleaned = cleaned.replace(/\s*gemäß\s+[^.,!?]*>\s*[^.,!?]+/gi, '');
  
  // Remove "basierend auf <breadcrumb path>" patterns
  cleaned = cleaned.replace(/\s*basierend auf\s+[^.,!?]*>\s*[^.,!?]+/gi, '');
  
  // STEP 2: Remove bracketed and parenthetical citations
  cleaned = cleaned.replace(/\s*\[[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\s*\([^)]*(?:Quelle|Band|Kapitel)[^)]*\)/gi, '');
  
  // STEP 3: Remove "Laut/Gemäß/Nach Coach-Wissen" attribution phrases with all variants
  // Pattern includes Band/Kapitel descriptors: "Laut Coach-Wissen Band 2 Kapitel 3: ..."
  cleaned = cleaned.replace(/\s*(?:Laut|Gemäß|Nach|Basierend auf)\s+(?:Coach-Wissen|dem Coach-Wissen|KB-Wissen|der Wissensbasis)(?:\s+(?:Band|Kapitel)\s*[\d.,]+)*\s*[,:]\s*/gi, '');
  // Handle without punctuation: "Laut Coach-Wissen Band 2 sollten" -> "sollten"
  cleaned = cleaned.replace(/\s*(?:Laut|Gemäß|Nach|Basierend auf)\s+(?:Coach-Wissen|dem Coach-Wissen|KB-Wissen|der Wissensbasis)(?:\s+(?:Band|Kapitel)\s*[\d.,]+)*\s+/gi, '');
  // Handle sentence-ending: "Basierend auf Coach-Wissen." -> ""
  cleaned = cleaned.replace(/\s*(?:Laut|Gemäß|Nach|Basierend auf)\s+(?:Coach-Wissen|dem Coach-Wissen|KB-Wissen|der Wissensbasis)(?:\s+(?:Band|Kapitel)\s*[\d.,]+)*\s*\.?\s*$/gi, '');
  
  // Remove standalone Band/Kapitel references that may have leaked
  cleaned = cleaned.replace(/\s*Band\s+[\d.,]+\s*(?:Kapitel\s+[\d.,]+)?\s*[,:.]?\s*/gi, ' ');
  
  // STEP 4: Now remove markdown and quoted titles
  cleaned = cleaned.replace(/\*+["„][^""]*[""]\*+/g, '');
  cleaned = cleaned.replace(/„[^"]*(?:Praxis|Coach|Training|Algorithmen|Führung|Architektur|Workflow|Prozess|QM|Zahnarzt|Patientenaufnahme|Übersicht|Checkliste)[^"]*"/gi, '');
  cleaned = cleaned.replace(/["„][A-Z][^""]*(?:Praxis|Coach|Training|Algorithmen|Führung|Architektur|Workflow|Prozess)[^""]*[""](?:\s*\(Quelle[^)]*\))?/gi, '');
  
  // STEP 5: Remove any remaining orphaned attribution words
  cleaned = cleaned.replace(/\s*(gemäß|basierend auf|laut)\s+\./gi, '.');
  cleaned = cleaned.replace(/\s*(gemäß|basierend auf|laut)\s*$/gi, '');
  cleaned = cleaned.replace(/\s*(gemäß|basierend auf|laut)\s+,/gi, ',');
  
  // STEP 6: Remove markdown bold/italic markers
  cleaned = cleaned.replace(/\*+/g, '');
  
  // STEP 7: Clean up punctuation and spacing
  cleaned = cleaned.replace(/,\s*\./g, '.');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  cleaned = cleaned.replace(/\s+\./g, '.');
  cleaned = cleaned.replace(/\.\s*,/g, '.');
  cleaned = cleaned.trim();
  
  // Ensure sentence ends properly
  if (cleaned.length > 0 && !cleaned.match(/[.!?]$/)) {
    cleaned += '.';
  }
  
  return cleaned;
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

function analyzeStaffing(staff: Staff[], rooms: Room[]): StaffingAnalysis {
  const doctors = staff.filter(s => s.role === "doctor" || s.role === "dentist").length;
  const nurses = staff.filter(s => s.role === "nurse").length;
  const receptionists = staff.filter(s => s.role === "receptionist").length;
  const examRooms = rooms.filter(r => r.type === "exam").length;

  return evaluateStaffingRatios(doctors, nurses, receptionists, staff.length, examRooms);
}

function analyzeCapacity(rooms: Room[], staff: Staff[], operatingHours: number = 8): CapacityAnalysis {
  const examRooms = rooms.filter(r => r.type === "exam").length;
  const providers = staff.filter(s => s.role === "doctor" || s.role === "dentist").length;
  
  return calculatePatientCapacityBenchmark(examRooms, operatingHours, providers);
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

  const prompt = `Du bist ein erfahrener Zahnarztpraxis-Coach und Berater. Deine Empfehlungen basieren PRIMÄR auf deinem Coach-Wissen (falls vorhanden) und ergänzend auf deutschen Vorschriften.

${coachKnowledge}

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

WICHTIG: Nutze das Coach-Wissen als primäre Grundlage für deine Empfehlungen. Gib eine kurze, personalisierte 2-3 Sätze Analyse mit Fokus auf:
1. Die wichtigste Verbesserung basierend auf Coach-Erfahrung
2. Wie ihr Setup im Vergleich zu erfolgreichen Praxen abschneidet
3. Ein konkreter, umsetzbarer Tipp aus der Praxis

KEINE QUELLENANGABEN: Zitiere KEINE Dokumenttitel, Kapitelnummern, Bandnummern oder Quellennachweise. Schreibe nur den reinen Empfehlungstext ohne Verweise wie "(Quelle X)", "gemäß Dokument Y", oder "laut Coach-Wissen Band Z".

Halte die Antwort unter 120 Wörtern, professionell aber freundlich. Antworte auf Deutsch.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400
    });

    return response.choices[0]?.message?.content || "KI-Analyse ist derzeit nicht verfügbar.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "KI-Analyse ist vorübergehend nicht verfügbar. Bitte beachten Sie die benchmark-basierten Empfehlungen oben.";
  }
}

export async function analyzeLayout(
  rooms: Room[],
  staff: Staff[],
  operatingHours: number = 8,
  scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER
): Promise<LayoutAnalysis> {
  const efficiencyScore = calculateLayoutEfficiencyScore(rooms, scalePxPerMeter);
  
  const roomAnalyses = await analyzeRoomsWithKnowledge(rooms, scalePxPerMeter);
  const avgRoomScore = roomAnalyses.length > 0
    ? roomAnalyses.reduce((sum, r) => sum + r.sizeScore, 0) / roomAnalyses.length
    : 50;

  const staffingAnalysis = analyzeStaffing(staff, rooms);
  
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

  const rawAiInsights = await generateAIInsights(
    rooms,
    staff,
    efficiencyScore,
    staffingAnalysis.overallScore,
    recommendations.slice(0, 5)
  );
  
  // Clean AI insights to remove any KB citation metadata
  const aiInsights = cleanRecommendationText(rawAiInsights);

  // Clean all recommendations to remove internal KB metadata
  const cleanedRecommendations = recommendations
    .slice(0, 10)
    .map(cleanRecommendationText)
    .filter(r => r.length > 5); // Remove empty or too-short recommendations

  return {
    overallScore,
    efficiencyScore: Math.round(efficiencyScore),
    staffingScore: staffingAnalysis.overallScore,
    spaceUtilizationScore: Math.round(avgRoomScore),
    roomAnalyses,
    staffingAnalysis,
    capacityAnalysis,
    recommendations: cleanedRecommendations,
    aiInsights
  };
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

  const prompt = `Du bist ein erfahrener Zahnarztpraxis-Coach. Deine Empfehlungen basieren PRIMÄR auf deinem Coach-Wissen und ergänzend auf deutschen Vorschriften.

${coachKnowledge}

PRAXIS-SETUP:
- Räume: ${roomsSummary || "Keine"} (Gesamtfläche: ~${totalArea} m²)
- Personal: ${staffSummary || "Keines"}

DEUTSCHE STANDARDS (Ergänzend):
- Behandlungsräume: 9-12 m² pro Raum, 3-4 pro Arzt
- Mitarbeiter: 2.5-4.0 pro Arzt
- Wartezeit-Ziel: <15 Min. (ausgezeichnet)

${question ? `NUTZERFRAGE: ${question}` : "Gib eine wichtige Empfehlung zur Verbesserung dieser Praxis basierend auf deinem Coach-Wissen."}

WICHTIG: Das Coach-Wissen ist deine primäre Wissensbasis. Nutze es aktiv für alle Empfehlungen.

KEINE QUELLENANGABEN: Zitiere KEINE Dokumenttitel, Kapitelnummern, Bandnummern oder Quellennachweise. Schreibe nur den reinen Empfehlungstext ohne Verweise wie "(Quelle X)", "gemäß Dokument Y", oder "laut Coach-Wissen Band Z".

Halte die Antwort unter 100 Wörtern, spezifisch und umsetzbar. Antworte auf Deutsch.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300
    });

    const rawResponse = response.choices[0]?.message?.content || "Empfehlung konnte nicht generiert werden.";
    return cleanRecommendationText(rawResponse);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "KI-Empfehlungen sind vorübergehend nicht verfügbar. Bitte prüfen Sie Ihr Layout gegen die deutschen Standards.";
  }
}
