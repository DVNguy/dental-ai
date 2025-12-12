import {
  getRoomSizeBenchmarks,
  getStaffingBenchmarks,
  getSchedulingDefaults,
  getDashboardRules,
  getLayoutRules,
  formatCitations,
  type ArtifactResult
} from "./artifactService";
import { SAFE_DEFAULTS, type SourceCitation, type RulePayload } from "../../shared/taxonomy";
import {
  ROOM_SIZE_STANDARDS,
  STAFFING_RATIOS,
  PATIENT_FLOW_METRICS,
  type RoomSizeStandard,
  pixelsToSqM
} from "./benchmarks";

export interface KnowledgePoweredRoomSize {
  minSqM: number;
  maxSqM: number;
  optimalSqM: number;
  source: string;
  citations: SourceCitation[];
  fromKnowledge: boolean;
}

export interface KnowledgePoweredStaffing {
  min: number;
  max: number;
  optimal: number;
  source: string;
  citations: SourceCitation[];
  fromKnowledge: boolean;
}

export interface KnowledgePoweredMetric {
  value: number;
  unit: string;
  source: string;
  citations: SourceCitation[];
  fromKnowledge: boolean;
}

export interface RecommendationWithCitation {
  text: string;
  priority: "critical" | "high" | "medium" | "low";
  citations: SourceCitation[];
  fromKnowledge: boolean;
}

let cachedRoomSizes: Record<string, KnowledgePoweredRoomSize> | null = null;
let cachedStaffing: Record<string, KnowledgePoweredStaffing> | null = null;
let cachedScheduling: {
  serviceTimes: Record<string, { min: number; max: number; optimal: number; citations: SourceCitation[] }>;
  bufferMinutes: { value: number; citations: SourceCitation[] };
  maxWaitTime: { value: number; citations: SourceCitation[] };
} | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function refreshCacheIfNeeded() {
  if (Date.now() < cacheExpiry) return;

  try {
    const [roomSizes, staffing, scheduling] = await Promise.all([
      getRoomSizeBenchmarks(),
      getStaffingBenchmarks(),
      getSchedulingDefaults()
    ]);

    cachedRoomSizes = {};
    for (const [type, data] of Object.entries(roomSizes)) {
      cachedRoomSizes[type] = {
        minSqM: data.min,
        maxSqM: data.max,
        optimalSqM: data.optimal,
        source: data.citations.length > 0 ? formatCitations(data.citations).join(", ") : (ROOM_SIZE_STANDARDS[type]?.source || "Safe Default"),
        citations: data.citations,
        fromKnowledge: data.citations.length > 0
      };
    }

    cachedStaffing = {
      mfaPerDoctor: {
        min: staffing.mfaPerDoctor.min,
        max: staffing.mfaPerDoctor.max,
        optimal: staffing.mfaPerDoctor.optimal,
        source: staffing.mfaPerDoctor.citations.length > 0 ? formatCitations(staffing.mfaPerDoctor.citations).join(", ") : "KZBV Praxis-Benchmarks",
        citations: staffing.mfaPerDoctor.citations,
        fromKnowledge: staffing.mfaPerDoctor.citations.length > 0
      },
      supportPerPhysician: {
        min: staffing.supportPerPhysician.min,
        max: staffing.supportPerPhysician.max,
        optimal: staffing.supportPerPhysician.optimal,
        source: staffing.supportPerPhysician.citations.length > 0 ? formatCitations(staffing.supportPerPhysician.citations).join(", ") : "KV Praxisorganisation",
        citations: staffing.supportPerPhysician.citations,
        fromKnowledge: staffing.supportPerPhysician.citations.length > 0
      }
    };

    cachedScheduling = scheduling;
    cacheExpiry = Date.now() + CACHE_TTL;
  } catch (error) {
    console.error("Failed to refresh artifact cache:", error);
  }
}

export async function getKnowledgePoweredRoomSizes(): Promise<Record<string, KnowledgePoweredRoomSize>> {
  await refreshCacheIfNeeded();
  
  if (cachedRoomSizes && Object.keys(cachedRoomSizes).length > 0) {
    return cachedRoomSizes;
  }

  const fallback: Record<string, KnowledgePoweredRoomSize> = {};
  for (const [type, standard] of Object.entries(ROOM_SIZE_STANDARDS)) {
    fallback[type] = {
      minSqM: standard.minSqM,
      maxSqM: standard.maxSqM,
      optimalSqM: standard.optimalSqM,
      source: standard.source,
      citations: [],
      fromKnowledge: false
    };
  }
  return fallback;
}

export async function getKnowledgePoweredStaffing(): Promise<Record<string, KnowledgePoweredStaffing>> {
  await refreshCacheIfNeeded();
  
  if (cachedStaffing) {
    return cachedStaffing;
  }

  return {
    mfaPerDoctor: {
      min: STAFFING_RATIOS.nursePerDoctor.min,
      max: STAFFING_RATIOS.nursePerDoctor.max,
      optimal: STAFFING_RATIOS.nursePerDoctor.optimal,
      source: STAFFING_RATIOS.nursePerDoctor.source,
      citations: [],
      fromKnowledge: false
    },
    supportPerPhysician: {
      min: STAFFING_RATIOS.supportStaffPerPhysician.min,
      max: STAFFING_RATIOS.supportStaffPerPhysician.max,
      optimal: STAFFING_RATIOS.supportStaffPerPhysician.optimal,
      source: STAFFING_RATIOS.supportStaffPerPhysician.source,
      citations: [],
      fromKnowledge: false
    }
  };
}

export async function getKnowledgePoweredScheduling(): Promise<{
  serviceTimes: Record<string, KnowledgePoweredMetric>;
  bufferMinutes: KnowledgePoweredMetric;
  maxWaitTime: KnowledgePoweredMetric;
}> {
  await refreshCacheIfNeeded();
  
  const serviceTimes: Record<string, KnowledgePoweredMetric> = {};
  
  if (cachedScheduling) {
    for (const [type, data] of Object.entries(cachedScheduling.serviceTimes)) {
      serviceTimes[type] = {
        value: data.optimal,
        unit: "Minuten",
        source: data.citations.length > 0 ? formatCitations(data.citations).join(", ") : "Safe Default",
        citations: data.citations,
        fromKnowledge: data.citations.length > 0
      };
    }
    
    return {
      serviceTimes,
      bufferMinutes: {
        value: cachedScheduling.bufferMinutes.value,
        unit: "Minuten",
        source: cachedScheduling.bufferMinutes.citations.length > 0 ? formatCitations(cachedScheduling.bufferMinutes.citations).join(", ") : "Safe Default",
        citations: cachedScheduling.bufferMinutes.citations,
        fromKnowledge: cachedScheduling.bufferMinutes.citations.length > 0
      },
      maxWaitTime: {
        value: cachedScheduling.maxWaitTime.value,
        unit: "Minuten",
        source: cachedScheduling.maxWaitTime.citations.length > 0 ? formatCitations(cachedScheduling.maxWaitTime.citations).join(", ") : "Safe Default",
        citations: cachedScheduling.maxWaitTime.citations,
        fromKnowledge: cachedScheduling.maxWaitTime.citations.length > 0
      }
    };
  }

  return {
    serviceTimes: {
      checkup: { value: 20, unit: "Minuten", source: "Safe Default", citations: [], fromKnowledge: false },
      treatment: { value: 45, unit: "Minuten", source: "Safe Default", citations: [], fromKnowledge: false },
      cleaning: { value: 30, unit: "Minuten", source: "Safe Default", citations: [], fromKnowledge: false }
    },
    bufferMinutes: { value: 5, unit: "Minuten", source: "Safe Default", citations: [], fromKnowledge: false },
    maxWaitTime: { value: 15, unit: "Minuten", source: "Safe Default", citations: [], fromKnowledge: false }
  };
}

export async function getKnowledgePoweredRecommendations(
  hasReception: boolean,
  hasWaiting: boolean,
  examRoomCount: number,
  hasLab: boolean,
  hasOffice: boolean
): Promise<RecommendationWithCitation[]> {
  const recommendations: RecommendationWithCitation[] = [];
  
  const layoutRules = await getLayoutRules();
  
  if (!hasReception) {
    const rule = layoutRules.find(r => 
      r.payload.condition?.toLowerCase().includes("empfang") ||
      r.topic.toLowerCase().includes("empfang") ||
      r.topic.toLowerCase().includes("reception")
    );
    
    recommendations.push({
      text: rule?.payload.action || "KRITISCH: Empfangsbereich hinzufügen. Unerlässlich für Patientenanmeldung und ersten Eindruck.",
      priority: "critical",
      citations: rule?.citations || [],
      fromKnowledge: !!rule
    });
  }

  if (!hasWaiting) {
    const rule = layoutRules.find(r => 
      r.payload.condition?.toLowerCase().includes("warte") ||
      r.topic.toLowerCase().includes("warte") ||
      r.topic.toLowerCase().includes("waiting")
    );
    
    recommendations.push({
      text: rule?.payload.action || "KRITISCH: Wartebereich hinzufügen. Patienten benötigen einen komfortablen Raum während der Wartezeit.",
      priority: "critical",
      citations: rule?.citations || [],
      fromKnowledge: !!rule
    });
  }

  if (examRoomCount === 0) {
    const rule = layoutRules.find(r => 
      r.payload.condition?.toLowerCase().includes("behandlungsraum") ||
      r.topic.toLowerCase().includes("behandlungsraum") ||
      r.topic.toLowerCase().includes("exam")
    );
    
    recommendations.push({
      text: rule?.payload.action || "KRITISCH: Behandlungsräume hinzufügen. Diese sind der Kern Ihrer Praxistätigkeit.",
      priority: "critical",
      citations: rule?.citations || [],
      fromKnowledge: !!rule
    });
  } else if (examRoomCount === 1) {
    const rule = layoutRules.find(r => 
      r.payload.condition?.toLowerCase().includes("behandlungsräume") ||
      r.topic.toLowerCase().includes("anzahl")
    );
    
    recommendations.push({
      text: rule?.payload.action || "Erwägen Sie weitere Behandlungsräume. Standard ist 3-4 pro Arzt für optimale Effizienz (KV-Empfehlung).",
      priority: "high",
      citations: rule?.citations || [],
      fromKnowledge: !!rule
    });
  }

  if (!hasLab && examRoomCount > 0) {
    const rule = layoutRules.find(r => 
      r.payload.condition?.toLowerCase().includes("labor") ||
      r.topic.toLowerCase().includes("labor") ||
      r.topic.toLowerCase().includes("lab")
    );
    
    recommendations.push({
      text: rule?.payload.action || "Erwägen Sie einen Laborbereich. Ein Labor neben den Behandlungsräumen reduziert Wartezeiten um 15-20%.",
      priority: "medium",
      citations: rule?.citations || [],
      fromKnowledge: !!rule
    });
  }

  if (!hasOffice) {
    recommendations.push({
      text: "Erwägen Sie ein Büro für Beratungsgespräche und Verwaltungsarbeit.",
      priority: "low",
      citations: [],
      fromKnowledge: false
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      text: "Ihr Layout enthält alle wesentlichen Raumtypen. Fokussieren Sie auf Optimierung der Raumplatzierung und -größen.",
      priority: "low",
      citations: [],
      fromKnowledge: false
    });
  }

  return recommendations;
}

export async function evaluateRoomSizeWithKnowledge(type: string, widthPx: number, heightPx: number): Promise<{
  score: number;
  assessment: "undersized" | "optimal" | "oversized";
  actualSqM: number;
  recommendation: string;
  citations: SourceCitation[];
  fromKnowledge: boolean;
}> {
  const roomSizes = await getKnowledgePoweredRoomSizes();
  const standard = roomSizes[type];
  
  if (!standard) {
    return {
      score: 50,
      assessment: "optimal",
      actualSqM: 0,
      recommendation: "Unbekannter Raumtyp",
      citations: [],
      fromKnowledge: false
    };
  }

  const areaPx = widthPx * heightPx;
  const actualSqM = pixelsToSqM(areaPx);

  let score: number;
  let assessment: "undersized" | "optimal" | "oversized";
  let recommendation: string;

  if (actualSqM < standard.minSqM) {
    const deficit = ((standard.minSqM - actualSqM) / standard.minSqM) * 100;
    score = Math.max(0, 50 - deficit);
    assessment = "undersized";
    recommendation = `Raum ist ${Math.round(deficit)}% unter dem Minimum. Empfehlung: mindestens ${standard.minSqM} m² gemäß ${standard.source}.`;
  } else if (actualSqM > standard.maxSqM) {
    const excess = ((actualSqM - standard.maxSqM) / standard.maxSqM) * 100;
    score = Math.max(60, 90 - (excess * 0.5));
    assessment = "oversized";
    recommendation = `Raum ist ${Math.round(excess)}% über dem Maximum. Raumnutzung optimieren.`;
  } else {
    const distanceFromOptimal = Math.abs(actualSqM - standard.optimalSqM);
    const range = standard.maxSqM - standard.minSqM;
    score = 100 - ((distanceFromOptimal / range) * 20);
    assessment = "optimal";
    recommendation = `Raumgröße entspricht den Standards. Optimale Größe: ${standard.optimalSqM} m².`;
  }

  return {
    score: Math.round(score),
    assessment,
    actualSqM,
    recommendation,
    citations: standard.citations,
    fromKnowledge: standard.fromKnowledge
  };
}

export async function getHealthScoreDrivers(): Promise<{
  weights: Record<string, number>;
  rules: ArtifactResult<RulePayload>[];
  citations: SourceCitation[];
  fromKnowledge: boolean;
}> {
  const rules = await getDashboardRules();
  
  const weightRule = rules.find(r => 
    r.topic.toLowerCase().includes("gewichtung") ||
    r.topic.toLowerCase().includes("score") ||
    r.topic.toLowerCase().includes("health")
  );

  if (weightRule && typeof weightRule.payload === 'object') {
    const allCitations = rules.flatMap(r => r.citations);
    return {
      weights: (weightRule.payload as any).weights || SAFE_DEFAULTS.dashboard.healthScoreWeights,
      rules,
      citations: allCitations,
      fromKnowledge: true
    };
  }

  return {
    weights: SAFE_DEFAULTS.dashboard.healthScoreWeights,
    rules,
    citations: [],
    fromKnowledge: false
  };
}

export function clearCache() {
  cachedRoomSizes = null;
  cachedStaffing = null;
  cachedScheduling = null;
  cacheExpiry = 0;
}
