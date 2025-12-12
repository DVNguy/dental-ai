import { db } from "../db";
import { knowledgeArtifacts } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { SAFE_DEFAULTS, type SourceCitation, type BenchmarkPayload, type RulePayload } from "../../shared/taxonomy";

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

export async function getRoomSizeBenchmarks(): Promise<Record<string, { min: number; max: number; optimal: number; citations: SourceCitation[] }>> {
  const artifacts = await getBenchmarks("layout");
  const roomTypes = ["reception", "waiting", "treatment", "exam", "lab", "office", "storage"];
  
  const result: Record<string, { min: number; max: number; optimal: number; citations: SourceCitation[] }> = {};
  
  for (const type of roomTypes) {
    const artifact = artifacts.find(a => 
      a.payload.metric?.toLowerCase().includes(type) || 
      a.topic.toLowerCase().includes(type)
    );
    
    if (artifact && artifact.payload.min !== undefined) {
      result[type] = {
        min: artifact.payload.min,
        max: artifact.payload.max || artifact.payload.min * 1.5,
        optimal: artifact.payload.optimal || (artifact.payload.min + (artifact.payload.max || artifact.payload.min * 1.5)) / 2,
        citations: artifact.citations
      };
    } else {
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
  const artifacts = await getBenchmarks("staffing");
  
  const mfaArtifact = artifacts.find(a => 
    a.topic.toLowerCase().includes("mfa") || 
    a.payload.metric?.toLowerCase().includes("mfa")
  );
  
  const supportArtifact = artifacts.find(a => 
    a.topic.toLowerCase().includes("support") || 
    a.topic.toLowerCase().includes("personal") ||
    a.payload.metric?.toLowerCase().includes("staff")
  );

  return {
    mfaPerDoctor: mfaArtifact ? {
      min: mfaArtifact.payload.min || 1.0,
      max: mfaArtifact.payload.max || 2.0,
      optimal: mfaArtifact.payload.optimal || 1.5,
      citations: mfaArtifact.citations
    } : { ...SAFE_DEFAULTS.staffing.ratios.mfaPerDoctor, citations: [] },
    
    supportPerPhysician: supportArtifact ? {
      min: supportArtifact.payload.min || 2.5,
      max: supportArtifact.payload.max || 4.0,
      optimal: supportArtifact.payload.optimal || 3.0,
      citations: supportArtifact.citations
    } : { ...SAFE_DEFAULTS.staffing.ratios.supportPerPhysician, citations: [] }
  };
}

export async function getSchedulingDefaults(): Promise<{
  serviceTimes: Record<string, { min: number; max: number; optimal: number; citations: SourceCitation[] }>;
  bufferMinutes: { value: number; citations: SourceCitation[] };
  maxWaitTime: { value: number; citations: SourceCitation[] };
}> {
  const artifacts = await getBenchmarks("scheduling");
  
  const serviceTypes = ["checkup", "treatment", "cleaning", "consultation", "xray"];
  const serviceTimes: Record<string, { min: number; max: number; optimal: number; citations: SourceCitation[] }> = {};
  
  for (const type of serviceTypes) {
    const artifact = artifacts.find(a => 
      a.topic.toLowerCase().includes(type) ||
      a.payload.metric?.toLowerCase().includes(type)
    );
    
    if (artifact) {
      serviceTimes[type] = {
        min: artifact.payload.min || 15,
        max: artifact.payload.max || 60,
        optimal: artifact.payload.optimal || 30,
        citations: artifact.citations
      };
    } else {
      const fallback = (SAFE_DEFAULTS.scheduling.serviceTimes as any)[type];
      if (fallback) {
        logMissingTopic("scheduling", `service_time_${type}`);
        serviceTimes[type] = { ...fallback, citations: [] };
      }
    }
  }

  const bufferArtifact = artifacts.find(a => 
    a.topic.toLowerCase().includes("buffer") || 
    a.topic.toLowerCase().includes("puffer")
  );
  
  const waitArtifact = artifacts.find(a => 
    a.topic.toLowerCase().includes("wartezeit") || 
    a.topic.toLowerCase().includes("wait")
  );

  return {
    serviceTimes,
    bufferMinutes: bufferArtifact ? {
      value: bufferArtifact.payload.optimal || bufferArtifact.payload.min || 5,
      citations: bufferArtifact.citations
    } : { value: SAFE_DEFAULTS.scheduling.bufferMinutes, citations: [] },
    maxWaitTime: waitArtifact ? {
      value: waitArtifact.payload.max || waitArtifact.payload.optimal || 15,
      citations: waitArtifact.citations
    } : { value: SAFE_DEFAULTS.scheduling.maxWaitTime, citations: [] }
  };
}

export async function getDashboardRules(): Promise<ArtifactResult<RulePayload>[]> {
  const rules = await getRules("dashboard");
  
  if (rules.length === 0) {
    logMissingTopic("dashboard", "health_score_rules");
  }
  
  return rules;
}

export async function getLayoutRules(): Promise<ArtifactResult<RulePayload>[]> {
  return getRules("layout");
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
  return [...new Set(citations.map(formatCitation))];
}
