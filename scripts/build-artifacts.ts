import crypto from "crypto";
import OpenAI from "openai";
import { db } from "../server/db";
import { knowledgeChunks, knowledgeSources, knowledgeArtifacts } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { ARTIFACT_TYPES, MODULES, type SourceCitation } from "../shared/taxonomy";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ChunkGroup {
  docName: string;
  headingPath: string | null;
  chunks: Array<{ id: string; content: string }>;
  contentHash: string;
}

const EXTRACTION_PROMPT = `You are an expert at extracting structured knowledge artifacts from dental practice management documents.

Extract ALL relevant artifacts from the provided text. Each artifact should be one of:
- benchmark: Numeric standards/thresholds (room sizes, wait times, ratios)
- rule: Business rules or constraints (if X then Y)
- formula: Calculations or formulas for metrics
- checklist: Step-by-step checklists or procedures
- template: Text templates or scripts
- playbook: Multi-step action plans

For each artifact, identify which module it belongs to:
- dashboard: Overall practice health/scoring
- layout: Room sizes, placement, spatial design
- staffing: Staff ratios, roles, scheduling
- scheduling: Appointment timing, buffers, patient flow
- hygiene: Sterilization, infection control
- billing: GOZ, BEMA, invoicing
- marketing: Patient acquisition, retention
- qm: Quality management, documentation

Return ONLY valid JSON array. Each object must have:
{
  "artifactType": "benchmark|rule|formula|checklist|template|playbook",
  "module": "dashboard|layout|staffing|scheduling|hygiene|billing|marketing|qm",
  "topic": "short descriptive topic name",
  "payload": {
    // For benchmark: { "metric": "name", "unit": "m²|min|ratio|%", "min": n, "max": n, "optimal": n, "description": "...", "source": "regulation name" }
    // For rule: { "condition": "...", "action": "...", "priority": "critical|high|medium|low", "description": "..." }
    // For formula: { "name": "...", "formula": "...", "variables": {"var": "description"}, "description": "..." }
    // For checklist: { "name": "...", "items": ["..."], "frequency": "daily|weekly|monthly", "description": "..." }
    // For template: { "name": "...", "template": "...", "variables": ["..."], "description": "..." }
    // For playbook: { "name": "...", "steps": [{"order": 1, "action": "...", "details": "..."}], "description": "..." }
  },
  "confidence": 0.0-1.0
}

IMPORTANT:
- Extract only concrete, actionable artifacts with specific values
- Do NOT extract vague or generic statements
- Numbers must be extracted precisely as stated in the source
- If uncertain, set lower confidence (0.5-0.7)
- Return empty array [] if no concrete artifacts found`;

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

async function getChunkGroups(): Promise<ChunkGroup[]> {
  const results = await db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
      headingPath: knowledgeChunks.headingPath,
      docName: knowledgeSources.fileName,
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeSources, eq(knowledgeChunks.sourceId, knowledgeSources.id))
    .orderBy(knowledgeSources.fileName, knowledgeChunks.headingPath);

  const groups = new Map<string, ChunkGroup>();

  for (const row of results) {
    const key = `${row.docName}::${row.headingPath || "root"}`;
    if (!groups.has(key)) {
      groups.set(key, {
        docName: row.docName,
        headingPath: row.headingPath,
        chunks: [],
        contentHash: "",
      });
    }
    groups.get(key)!.chunks.push({ id: row.id, content: row.content });
  }

  for (const group of groups.values()) {
    const combined = group.chunks.map(c => c.content).join("\n");
    group.contentHash = computeHash(combined);
  }

  return Array.from(groups.values());
}

async function extractArtifacts(group: ChunkGroup): Promise<any[]> {
  const combinedContent = group.chunks.map(c => c.content).join("\n\n");
  
  if (combinedContent.length < 100) {
    return [];
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Document: ${group.docName}\nSection: ${group.headingPath || "General"}\n\n${combinedContent.slice(0, 12000)}` }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000,
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    
    const artifacts = Array.isArray(parsed) ? parsed : (parsed.artifacts || []);
    
    return artifacts.filter((a: any) => 
      ARTIFACT_TYPES.includes(a.artifactType) && 
      MODULES.includes(a.module) &&
      a.topic &&
      a.payload
    );
  } catch (error) {
    console.error(`  Error extracting from ${group.docName}:`, error);
    return [];
  }
}

async function main() {
  const BATCH_LIMIT = parseInt(process.env.ARTIFACT_BATCH_LIMIT || "20", 10);
  const PRIORITY_KEYWORDS = ["Raumgröße", "Behandlungsraum", "Personal", "Wartezeit", "MFA", "Termin", "Patient", "Labor", "Empfang", "m²", "Quadratmeter"];
  
  console.log("🔧 Building Knowledge Artifacts...\n");
  console.log(`📋 Batch limit: ${BATCH_LIMIT} groups per run\n`);
  const startTime = Date.now();

  const allGroups = await getChunkGroups();
  console.log(`📚 Found ${allGroups.length} total chunk groups\n`);

  const groupsToProcess: ChunkGroup[] = [];
  let skippedGroups = 0;

  for (const group of allGroups) {
    const existingArtifact = await db
      .select({ id: knowledgeArtifacts.id })
      .from(knowledgeArtifacts)
      .where(eq(knowledgeArtifacts.sourceHash, group.contentHash))
      .limit(1);

    if (existingArtifact.length > 0) {
      skippedGroups++;
      continue;
    }
    groupsToProcess.push(group);
  }

  console.log(`⏭️  Skipping ${skippedGroups} already-processed groups`);
  console.log(`📝 ${groupsToProcess.length} groups need processing\n`);

  const priorityGroups = groupsToProcess.filter(g => {
    const combined = g.chunks.map(c => c.content).join(" ");
    return PRIORITY_KEYWORDS.some(kw => combined.toLowerCase().includes(kw.toLowerCase()));
  });
  const otherGroups = groupsToProcess.filter(g => !priorityGroups.includes(g));
  const sortedGroups = [...priorityGroups, ...otherGroups];

  const batchGroups = sortedGroups.slice(0, BATCH_LIMIT);
  console.log(`🎯 Processing ${batchGroups.length} groups this batch (${priorityGroups.length} priority)\n`);

  let totalArtifacts = 0;
  let processedGroups = 0;

  for (const group of batchGroups) {
    console.log(`  [${processedGroups + 1}/${batchGroups.length}] ${group.docName.slice(0, 40)}... > ${(group.headingPath || "root").slice(0, 50)}`);
    
    const artifacts = await extractArtifacts(group);
    
    for (const artifact of artifacts) {
      const citations: SourceCitation[] = group.chunks.map(c => ({
        docName: group.docName,
        headingPath: group.headingPath,
        chunkId: c.id
      }));

      await db.insert(knowledgeArtifacts).values({
        artifactType: artifact.artifactType,
        module: artifact.module,
        topic: artifact.topic,
        payloadJson: artifact.payload,
        sourceCitations: citations,
        confidence: artifact.confidence || 0.8,
        sourceHash: group.contentHash,
        version: 1
      });

      totalArtifacts++;
    }

    processedGroups++;
    
    if (processedGroups % 5 === 0) {
      console.log(`  ... ${processedGroups}/${batchGroups.length} processed, ${totalArtifacts} artifacts extracted`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const remaining = sortedGroups.length - batchGroups.length;

  console.log("\n" + "=".repeat(50));
  console.log("📊 Artifact Build Summary");
  console.log("=".repeat(50));
  console.log(`Groups processed this batch: ${processedGroups}`);
  console.log(`Groups already processed: ${skippedGroups}`);
  console.log(`Groups remaining: ${remaining}`);
  console.log(`Artifacts created: ${totalArtifacts}`);
  console.log(`Duration: ${duration}s`);
  if (remaining > 0) {
    console.log(`\n💡 Run again to process next batch of ${Math.min(remaining, BATCH_LIMIT)} groups`);
  } else {
    console.log(`\n✅ All groups processed!`);
  }
  console.log("=".repeat(50));
}

main().catch(console.error).finally(() => process.exit(0));
