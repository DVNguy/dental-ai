import { db } from "../db";
import { knowledgeArtifacts } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { SAFE_DEFAULTS, type SourceCitation, type BenchmarkPayload, type RulePayload, type InventoryItemPayload } from "../../shared/taxonomy";

export interface ArtifactResult<T = any> {
  id: string;
  topic: string;
  payload: T;
  citations: SourceCitation[];
  confidence: number;
  fromKnowledge: boolean;
}

export interface ArtifactQueryOptions {
  module?: string;
  artifactType?: string;
  topic?: string;
  minConfidence?: number;
}

const missingTopicsLog: Set<string> = new Set();

export async function getArtifacts(options: ArtifactQueryOptions): Promise<ArtifactResult[]> {
  const conditions = [];
  
  if (options.module) {
    conditions.push(eq(knowledgeArtifacts.module, options.module));
  }
  if (options.artifactType) {
    conditions.push(eq(knowledgeArtifacts.artifactType, options.artifactType));
  }
  if (options.topic) {
    conditions.push(sql`${knowledgeArtifacts.topic} ILIKE ${`%${options.topic}%`}`);
  }
  if (options.minConfidence) {
    conditions.push(sql`${knowledgeArtifacts.confidence} >= ${options.minConfidence}`);
  }

  const results = await db
    .select()
    .from(knowledgeArtifacts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${knowledgeArtifacts.confidence} DESC`);

  return results.map(r => ({
    id: r.id,
    topic: r.topic,
    payload: r.payloadJson as any,
    citations: r.sourceCitations as SourceCitation[],
    confidence: r.confidence,
    fromKnowledge: true
  }));
}

export async function getBenchmarks(module: string): Promise<ArtifactResult<BenchmarkPayload>[]> {
  return getArtifacts({ module, artifactType: "benchmark" }) as Promise<ArtifactResult<BenchmarkPayload>[]>;
}

export async function getRules(module: string): Promise<ArtifactResult<RulePayload>[]> {
  return getArtifacts({ module, artifactType: "rule" }) as Promise<ArtifactResult<RulePayload>[]>;
}

export function logMissingTopic(module: string, topic: string) {
  const key = `${module}:${topic}`;
  if (!missingTopicsLog.has(key)) {
    missingTopicsLog.add(key);
    console.warn(`[ArtifactService] Missing artifact: module=${module}, topic=${topic}`);
  }
}

const GERMAN_TO_ENGLISH_ROOM: Record<string, string> = {
  "empfangsbereich": "reception",
  "empfang": "reception",
  "wartezimmer": "waiting",
  "wartebereich": "waiting",
  "behandlungszimmer": "treatment",
  "behandlungsraum": "treatment",
  "untersuchungsraum": "exam",
  "labor": "lab",
  "personalraum": "office",
  "büro": "office",
  "sterilisationsraum": "storage",
  "lager": "storage"
};

export async function getRoomSizeBenchmarks(): Promise<Record<string, { min: number; max: number; optimal: number; citations: SourceCitation[] }>> {
  const artifacts = await getArtifacts({ module: "layout", topic: "room_size_standards" });
  const result: Record<string, { min: number; max: number; optimal: number; citations: SourceCitation[] }> = {};
  
  const roomSizesArtifact = artifacts.find(a => a.topic === "room_size_standards");
  
  if (roomSizesArtifact && roomSizesArtifact.payload.room_types) {
    const roomTypes = roomSizesArtifact.payload.room_types as Record<string, { min_sqm: number; max_sqm: number; optimal_sqm: number }>;
    
    for (const [germanName, sizes] of Object.entries(roomTypes)) {
      const englishName = GERMAN_TO_ENGLISH_ROOM[germanName.toLowerCase()] || germanName.toLowerCase();
      result[englishName] = {
        min: sizes.min_sqm,
        max: sizes.max_sqm,
        optimal: sizes.optimal_sqm,
        citations: roomSizesArtifact.citations
      };
    }
  }
  
  const fallbackTypes = ["reception", "waiting", "treatment", "exam", "lab", "office", "storage"];
  for (const type of fallbackTypes) {
    if (!result[type]) {
      const fallback = (SAFE_DEFAULTS.layout.roomSizes as any)[type];
      if (fallback) {
        logMissingTopic("layout", `room_size_${type}`);
        result[type] = { ...fallback, citations: [] };
      }
    }
  }
  
  return result;
}

export async function getStaffingBenchmarks(): Promise<{
  mfaPerDoctor: { min: number; max: number; optimal: number; citations: SourceCitation[] };
  supportPerPhysician: { min: number; max: number; optimal: number; citations: SourceCitation[] };
}> {
  const artifacts = await getArtifacts({ module: "staffing", topic: "role_ratios" });
  const roleRatiosArtifact = artifacts.find(a => a.topic === "role_ratios");
  
  if (roleRatiosArtifact && roleRatiosArtifact.payload) {
    const payload = roleRatiosArtifact.payload as {
      mfa_per_dentist?: number;
      total_staff_per_dentist?: number;
      reception_per_dentist?: number;
      prophylaxis_per_dentist?: number;
    };
    
    const mfaValue = payload.mfa_per_dentist || 2;
    const totalValue = payload.total_staff_per_dentist || 4;
    
    return {
      mfaPerDoctor: {
        min: Math.max(1, mfaValue - 0.5),
        max: mfaValue + 1,
        optimal: mfaValue,
        citations: roleRatiosArtifact.citations
      },
      supportPerPhysician: {
        min: Math.max(2.5, totalValue - 1),
        max: totalValue + 1,
        optimal: totalValue,
        citations: roleRatiosArtifact.citations
      }
    };
  }

  return {
    mfaPerDoctor: { ...SAFE_DEFAULTS.staffing.ratios.mfaPerDoctor, citations: [] },
    supportPerPhysician: { ...SAFE_DEFAULTS.staffing.ratios.supportPerPhysician, citations: [] }
  };
}

export async function getSchedulingDefaults(): Promise<{
  serviceTimes: Record<string, { min: number; max: number; optimal: number; citations: SourceCitation[] }>;
  bufferMinutes: { value: number; citations: SourceCitation[] };
  maxWaitTime: { value: number; citations: SourceCitation[] };
}> {
  const [schedulingArtifacts, dashboardArtifacts] = await Promise.all([
    getArtifacts({ module: "scheduling" }),
    getArtifacts({ module: "dashboard", topic: "patient_flow_metrics" })
  ]);
  
  const serviceTimes: Record<string, { min: number; max: number; optimal: number; citations: SourceCitation[] }> = {};
  
  for (const artifact of schedulingArtifacts) {
    if (artifact.topic.startsWith("service_time_")) {
      const serviceType = artifact.topic.replace("service_time_", "");
      serviceTimes[serviceType] = {
        min: artifact.payload.min || 15,
        max: artifact.payload.max || 60,
        optimal: artifact.payload.optimal || 30,
        citations: artifact.citations
      };
    }
  }
  
  const serviceTypes = ["checkup", "treatment", "cleaning", "consultation", "xray"];
  for (const type of serviceTypes) {
    if (!serviceTimes[type]) {
      const fallback = (SAFE_DEFAULTS.scheduling.serviceTimes as any)[type];
      if (fallback) {
        serviceTimes[type] = { ...fallback, citations: [] };
      }
    }
  }

  const maxWaitArtifact = schedulingArtifacts.find(a => a.topic === "max_wait_time");
  const patientFlowArtifact = dashboardArtifacts.find(a => a.topic === "patient_flow_metrics");
  
  let bufferValue = SAFE_DEFAULTS.scheduling.bufferMinutes;
  let bufferCitations: SourceCitation[] = [];
  
  if (patientFlowArtifact?.payload?.optimal_schedule_buffer_percent) {
    bufferValue = Math.round(30 * (patientFlowArtifact.payload.optimal_schedule_buffer_percent / 100));
    bufferCitations = patientFlowArtifact.citations;
  }

  return {
    serviceTimes,
    bufferMinutes: { value: bufferValue, citations: bufferCitations },
    maxWaitTime: maxWaitArtifact ? {
      value: maxWaitArtifact.payload.optimal || maxWaitArtifact.payload.max || 15,
      citations: maxWaitArtifact.citations
    } : { value: SAFE_DEFAULTS.scheduling.maxWaitTime, citations: [] }
  };
}

export async function getDashboardRules(): Promise<ArtifactResult[]> {
  const artifacts = await getArtifacts({ module: "dashboard" });
  
  if (artifacts.length === 0) {
    logMissingTopic("dashboard", "health_score_weights");
  }
  
  return artifacts;
}

export async function getLayoutRules(): Promise<ArtifactResult[]> {
  const artifacts = await getArtifacts({ module: "layout" });
  return artifacts.filter(a => a.topic !== "room_size_standards");
}

export async function getAllArtifactsByModule(module: string): Promise<{
  benchmarks: ArtifactResult<BenchmarkPayload>[];
  rules: ArtifactResult<RulePayload>[];
}> {
  const [benchmarks, rules] = await Promise.all([
    getBenchmarks(module),
    getRules(module)
  ]);
  
  return { benchmarks, rules };
}

export function formatCitation(citation: SourceCitation): string {
  const docName = citation.docName.replace(/\.docx$/i, "").replace(/[_-]/g, " ");
  return citation.headingPath 
    ? `${docName} > ${citation.headingPath}`
    : docName;
}

export function formatCitations(citations: SourceCitation[]): string[] {
  return Array.from(new Set(citations.map(formatCitation)));
}

export async function getInventoryRules(category?: string): Promise<{
  items: InventoryItemPayload[];
  citations: SourceCitation[];
  fromKnowledge: boolean;
}> {
  const artifacts = await getArtifacts({ module: "layout", topic: "inventory_rules" });
  const inventoryArtifact = artifacts.find(a => a.topic === "inventory_rules");

  if (!inventoryArtifact || !inventoryArtifact.payload?.items) {
    logMissingTopic("layout", "inventory_rules");
    return { items: [], citations: [], fromKnowledge: false };
  }

  let items = inventoryArtifact.payload.items as InventoryItemPayload[];

  if (category) {
    items = items.filter(item => item.category.toLowerCase() === category.toLowerCase());
  }

  return {
    items,
    citations: inventoryArtifact.citations,
    fromKnowledge: true
  };
}

export async function getInventoryRulesGrouped(): Promise<{
  byCategory: Record<string, InventoryItemPayload[]>;
  citations: SourceCitation[];
  fromKnowledge: boolean;
}> {
  const artifacts = await getArtifacts({ module: "layout", topic: "inventory_rules" });
  const inventoryArtifact = artifacts.find(a => a.topic === "inventory_rules");

  if (!inventoryArtifact || !inventoryArtifact.payload?.items) {
    logMissingTopic("layout", "inventory_rules");
    return { byCategory: {}, citations: [], fromKnowledge: false };
  }

  const items = inventoryArtifact.payload.items as InventoryItemPayload[];
  const byCategory: Record<string, InventoryItemPayload[]> = {};

  for (const item of items) {
    const cat = item.category.toLowerCase();
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat].push(item);
  }

  return {
    byCategory,
    citations: inventoryArtifact.citations,
    fromKnowledge: true
  };
}
