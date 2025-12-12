import { db } from "./db";
import { knowledgeArtifacts, knowledgeChunks } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { MODULES } from "../shared/taxonomy";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

const ARTIFACT_TOPICS: Record<string, string[]> = {
  layout: ["room_size_reception", "room_size_waiting", "room_size_treatment", "room_size_lab", "room_size_office"],
  staffing: ["mfa_per_doctor", "support_per_physician"],
  scheduling: ["service_time_checkup", "service_time_treatment", "service_time_cleaning", "buffer_minutes", "max_wait_time"],
  dashboard: ["health_score_weights"]
};

async function extractArtifact(module: string, topic: string, chunks: any[]): Promise<any | null> {
  if (chunks.length === 0) return null;

  const context = chunks.map(c => c.content).join("\n\n---\n\n");

  const prompt = `Du bist ein Experte für die Extraktion strukturierter Daten aus deutschsprachigen medizinischen Praxisrichtlinien.

KONTEXT (aus Wissensdokumenten):
${context}

AUFGABE: Extrahiere für das Modul "${module}" zum Thema "${topic}" strukturierte Benchmark-Daten.

Antworte NUR mit einem gültigen JSON-Objekt in diesem Format:
{
  "artifactType": "benchmark",
  "metric": "Name der Metrik",
  "unit": "Einheit (z.B. m², Minuten, Verhältnis)",
  "min": <minimaler Wert als Zahl>,
  "max": <maximaler Wert als Zahl>,
  "optimal": <optimaler Wert als Zahl>,
  "description": "Kurze Beschreibung",
  "source": "Quellenangabe aus dem Dokument"
}

Falls keine relevanten Daten gefunden werden, antworte mit: null`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content || content === "null") return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.log(`[ArtifactLoader] Failed to extract ${module}/${topic}:`, error);
    return null;
  }
}

async function buildMissingArtifacts() {
  console.log("[ArtifactLoader] Checking for missing artifacts...");

  const existingArtifacts = await db.select({
    module: knowledgeArtifacts.module,
    topic: knowledgeArtifacts.topic
  }).from(knowledgeArtifacts);

  const existingSet = new Set(existingArtifacts.map(a => `${a.module}:${a.topic}`));

  const chunkCount = await db.select({ count: sql<number>`count(*)` }).from(knowledgeChunks);
  if (!chunkCount[0]?.count || chunkCount[0].count === 0) {
    console.log("[ArtifactLoader] No knowledge chunks found. Skipping artifact building.");
    return;
  }

  let built = 0;
  const maxPerRun = 5;

  for (const [module, topics] of Object.entries(ARTIFACT_TOPICS)) {
    if (built >= maxPerRun) break;

    for (const topic of topics) {
      if (built >= maxPerRun) break;
      if (existingSet.has(`${module}:${topic}`)) continue;

      const searchTerms = topic.replace(/_/g, " ");
      const chunks = await db.select().from(knowledgeChunks)
        .where(sql`to_tsvector('german', ${knowledgeChunks.content}) @@ plainto_tsquery('german', ${searchTerms})`)
        .limit(3);

      if (chunks.length === 0) {
        const fallbackChunks = await db.select().from(knowledgeChunks)
          .where(sql`${knowledgeChunks.content} ILIKE ${'%' + searchTerms.split(' ')[0] + '%'}`)
          .limit(3);
        
        if (fallbackChunks.length === 0) continue;
        chunks.push(...fallbackChunks);
      }

      const artifact = await extractArtifact(module, topic, chunks);
      if (!artifact) continue;

      const citations = chunks.map(c => ({
        docName: c.sourceId,
        headingPath: c.headingPath,
        chunkId: c.id
      }));

      await db.insert(knowledgeArtifacts).values({
        artifactType: artifact.artifactType || "benchmark",
        module,
        topic,
        payloadJson: artifact,
        sourceCitations: citations,
        confidence: 0.8,
        version: 1
      });

      console.log(`[ArtifactLoader] Built artifact: ${module}/${topic}`);
      built++;
    }
  }

  if (built > 0) {
    console.log(`[ArtifactLoader] Built ${built} new artifacts`);
  } else {
    console.log("[ArtifactLoader] All artifacts up to date");
  }
}

export async function initializeArtifacts() {
  try {
    await buildMissingArtifacts();
  } catch (error) {
    console.log("[ArtifactLoader] Artifact initialization skipped:", error);
  }
}
