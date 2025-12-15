import crypto from "crypto";
import OpenAI from "openai";
import { db } from "../server/db";
import { knowledgeChunks, knowledgeSources, knowledgeArtifacts } from "../shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ARTIFACT_DEFINITIONS: ArtifactDefinition[] = [
  // Dashboard artifacts (5)
  {
    module: "dashboard",
    topic: "health_score_weights",
    artifactType: "config",
    prompt: `Extrahiere aus dem Wissenskontext die optimalen GEWICHTUNGEN für einen Praxis-Gesundheitsscore.
    Liefere JSON mit: efficiency_weight, harmony_weight, patient_satisfaction_weight, staff_wellbeing_weight (alle 0-1, Summe = 1).`,
    schema: z.object({
      efficiency_weight: z.number().min(0).max(1),
      harmony_weight: z.number().min(0).max(1),
      patient_satisfaction_weight: z.number().min(0).max(1),
      staff_wellbeing_weight: z.number().min(0).max(1)
    }),
    searchTerms: ["Effizienz", "Kennzahl", "Performance", "Zufriedenheit", "Score"]
  },
  {
    module: "dashboard",
    topic: "kpi_benchmarks",
    artifactType: "benchmark",
    prompt: `Extrahiere die wichtigsten KPIs und Benchmarks für Zahnarztpraxen.
    Liefere JSON mit: revenue_per_hour (number), patients_per_day (number), recall_rate_target (number 0-1), new_patient_rate_target (number 0-1).`,
    schema: z.object({
      revenue_per_hour: z.number(),
      patients_per_day: z.number(),
      recall_rate_target: z.number(),
      new_patient_rate_target: z.number()
    }),
    searchTerms: ["Umsatz", "Patient", "Kennzahl", "Benchmark", "KPI"]
  },
  {
    module: "dashboard",
    topic: "efficiency_drivers",
    artifactType: "insight",
    prompt: `Identifiziere die Haupttreiber für Praxiseffizienz.
    Liefere JSON mit: drivers (Array von {name, impact_score 1-10, category, recommendation}).`,
    schema: z.object({
      drivers: z.array(z.object({
        name: z.string(),
        impact_score: z.number().min(1).max(10),
        category: z.string(),
        recommendation: z.string()
      }))
    }),
    searchTerms: ["Effizienz", "Optimierung", "Prozess", "Workflow", "Verbesserung"]
  },
  {
    module: "dashboard",
    topic: "patient_flow_metrics",
    artifactType: "benchmark",
    prompt: `Extrahiere Patientenfluss-Metriken und optimale Durchlaufzeiten.
    Liefere JSON mit: avg_appointment_duration_min, max_wait_time_min, optimal_schedule_buffer_percent, patients_per_treatment_room.`,
    schema: z.object({
      avg_appointment_duration_min: z.number(),
      max_wait_time_min: z.number(),
      optimal_schedule_buffer_percent: z.number(),
      patients_per_treatment_room: z.number()
    }),
    searchTerms: ["Wartezeit", "Termin", "Durchlauf", "Patient", "Zeitmanagement"]
  },
  {
    module: "dashboard",
    topic: "quality_indicators",
    artifactType: "benchmark",
    prompt: `Extrahiere Qualitätsindikatoren für Zahnarztpraxen.
    Liefere JSON mit: treatment_success_rate, patient_retention_rate, complaint_rate_max, recommendation_rate_target.`,
    schema: z.object({
      treatment_success_rate: z.number(),
      patient_retention_rate: z.number(),
      complaint_rate_max: z.number(),
      recommendation_rate_target: z.number()
    }),
    searchTerms: ["Qualität", "Erfolg", "Zufriedenheit", "Beschwerde", "Empfehlung"]
  },

  // Staffing artifacts (3)
  {
    module: "staffing",
    topic: "role_ratios",
    artifactType: "config",
    prompt: `Extrahiere optimale Personalverhältnisse für Zahnarztpraxen.
    Liefere JSON mit: mfa_per_dentist (number), reception_per_dentist (number), prophylaxis_per_dentist (number), total_staff_per_dentist (number).`,
    schema: z.object({
      mfa_per_dentist: z.number(),
      reception_per_dentist: z.number(),
      prophylaxis_per_dentist: z.number(),
      total_staff_per_dentist: z.number()
    }),
    searchTerms: ["Personal", "MFA", "Zahnarzt", "Verhältnis", "Team"]
  },
  {
    module: "staffing",
    topic: "skill_requirements",
    artifactType: "config",
    prompt: `Extrahiere Qualifikationsanforderungen pro Rolle.
    Liefere JSON mit: roles (Array von {role, required_skills[], optional_skills[], certification_requirements[]}).`,
    schema: z.object({
      roles: z.array(z.object({
        role: z.string(),
        required_skills: z.array(z.string()),
        optional_skills: z.array(z.string()),
        certification_requirements: z.array(z.string())
      }))
    }),
    searchTerms: ["Qualifikation", "Ausbildung", "Kompetenz", "Fortbildung", "Zertifikat"]
  },
  {
    module: "staffing",
    topic: "scheduling_rules",
    artifactType: "config",
    prompt: `Extrahiere Regeln für optimale Personalplanung.
    Liefere JSON mit: min_staff_per_shift (number), peak_hours_multiplier (number), min_break_duration_min (number), max_continuous_work_hours (number), overlap_time_minutes (number).`,
    schema: z.object({
      min_staff_per_shift: z.number(),
      peak_hours_multiplier: z.number(),
      min_break_duration_min: z.number(),
      max_continuous_work_hours: z.number(),
      overlap_time_minutes: z.number()
    }),
    searchTerms: ["Schicht", "Planung", "Pause", "Arbeitszeit", "Personal"]
  },

  // Layout artifacts (3)
  {
    module: "layout",
    topic: "room_size_standards",
    artifactType: "benchmark",
    prompt: `Extrahiere Raumgrößen-Standards gemäß deutscher Vorschriften.
    Liefere JSON mit: room_types (Object mit Raumtyp als Key und {min_sqm, optimal_sqm, max_sqm, regulation_reference} als Value).`,
    schema: z.object({
      room_types: z.record(z.object({
        min_sqm: z.number(),
        optimal_sqm: z.number(),
        max_sqm: z.number(),
        regulation_reference: z.string()
      }))
    }),
    searchTerms: ["Raumgröße", "Quadratmeter", "Behandlungsraum", "Wartebereich", "Empfang"]
  },
  {
    module: "layout",
    topic: "proximity_rules",
    artifactType: "config",
    prompt: `Extrahiere Regeln für optimale Raumanordnung und Laufwege.
    Liefere JSON mit: proximity_pairs (Array von {room1, room2, max_distance_m, reason}).`,
    schema: z.object({
      proximity_pairs: z.array(z.object({
        room1: z.string(),
        room2: z.string(),
        max_distance_m: z.number(),
        reason: z.string()
      }))
    }),
    searchTerms: ["Laufweg", "Entfernung", "Anordnung", "Workflow", "Nähe"]
  },
  {
    module: "layout",
    topic: "workflow_zones",
    artifactType: "config",
    prompt: `Extrahiere Empfehlungen für Praxis-Zonen und Workflow-Bereiche.
    Liefere JSON mit: zones (Array von {zone_name, included_rooms[], accessibility_level, patient_flow_order}).`,
    schema: z.object({
      zones: z.array(z.object({
        zone_name: z.string(),
        included_rooms: z.array(z.string()),
        accessibility_level: z.string(),
        patient_flow_order: z.number()
      }))
    }),
    searchTerms: ["Zone", "Bereich", "Workflow", "Patient", "Ablauf"]
  },

  // Inventory artifacts
  {
    module: "layout",
    topic: "inventory_rules",
    artifactType: "inventory_item",
    prompt: `Extrahiere Inventar- und Ausstattungsregeln für Zahnarztpraxen.
    Liefere JSON mit: items (Array von {item, category, dimensions: {width_cm, depth_cm, height_cm}, placement, requires[], clearance_cm, description}).
    Kategorien: behandlung, empfang, wartezimmer, labor, lager, büro.`,
    schema: z.object({
      items: z.array(z.object({
        item: z.string(),
        category: z.string(),
        dimensions: z.object({
          width_cm: z.number().optional(),
          depth_cm: z.number().optional(),
          height_cm: z.number().optional()
        }).optional(),
        placement: z.string(),
        requires: z.array(z.string()).optional(),
        clearance_cm: z.number().optional(),
        description: z.string()
      }))
    }),
    searchTerms: ["Ausstattung", "Inventar", "Gerät", "Möbel", "Behandlungsstuhl", "Röntgen", "Sterilisator"]
  }
];

interface ArtifactDefinition {
  module: string;
  topic: string;
  artifactType: string;
  prompt: string;
  schema: z.ZodSchema;
  searchTerms: string[];
}

interface ChunkWithSource {
  id: string;
  docName: string;
  headingPath: string | null;
  content: string;
}

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

async function searchRelevantChunks(searchTerms: string[], limit: number = 10): Promise<ChunkWithSource[]> {
  const patterns = searchTerms.map(t => `%${t}%`);
  const results = await db.execute(sql`
    SELECT 
      kc.id,
      ks.file_name as doc_name,
      kc.heading_path,
      kc.content
    FROM knowledge_chunks kc
    JOIN knowledge_sources ks ON kc.source_id = ks.id
    WHERE kc.content ILIKE ANY(ARRAY[${sql.join(patterns.map(p => sql`${p}`), sql`, `)}])
    LIMIT ${limit}
  `);

  return (results.rows as any[]).map(row => ({
    id: row.id,
    docName: row.doc_name,
    headingPath: row.heading_path,
    content: row.content
  }));
}

async function generateArtifact(
  definition: ArtifactDefinition,
  chunks: ChunkWithSource[]
): Promise<{ payload: any; citations: any[] } | null> {
  if (chunks.length === 0) {
    console.log(`  ⚠️  No relevant chunks found for ${definition.module}/${definition.topic}`);
    return null;
  }

  const context = chunks.map((c, i) => 
    `[Quelle ${i + 1}: ${c.docName} > ${c.headingPath || "Allgemein"}]\n${c.content}`
  ).join("\n\n---\n\n");

  const systemPrompt = `Du bist ein Experte für Zahnarztpraxis-Management.
Analysiere den Wissenskontext und extrahiere strukturierte Daten.

WICHTIG:
- Antworte NUR mit validem JSON (kein Markdown, keine Erklärungen)
- Verwende realistische Werte basierend auf deutschen Standards
- Wenn Werte nicht im Kontext stehen, nutze typische Branchenwerte`;

  const userPrompt = `WISSENSKONTEXT:
${context}

AUFGABE:
${definition.prompt}

Antworte NUR mit dem JSON-Objekt:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log(`  ❌ Empty response for ${definition.module}/${definition.topic}`);
      return null;
    }

    const parsed = JSON.parse(content);
    
    // Validate with zod
    const validated = definition.schema.safeParse(parsed);
    if (!validated.success) {
      console.log(`  ❌ Validation failed for ${definition.module}/${definition.topic}:`, validated.error.message);
      return null;
    }

    const citations = chunks.map(c => ({
      chunkId: c.id,
      docName: c.docName.replace(/\.docx$/i, ""),
      headingPath: c.headingPath || "Allgemein"
    }));

    return { payload: validated.data, citations };
  } catch (error) {
    console.log(`  ❌ Error generating ${definition.module}/${definition.topic}:`, error);
    return null;
  }
}

async function buildArtifact(definition: ArtifactDefinition): Promise<boolean> {
  console.log(`\n📦 Building: ${definition.module}/${definition.topic}`);
  
  // Search for relevant chunks
  const chunks = await searchRelevantChunks(definition.searchTerms, 8);
  
  if (chunks.length === 0) {
    console.log(`  ⏭️  Skipped: No relevant knowledge found`);
    return false;
  }

  // Compute source hash for idempotency
  const sourceContent = chunks.map(c => c.content).join("");
  const sourceHash = computeHash(sourceContent + definition.prompt);

  // Check if artifact exists with same hash
  const existing = await db.select()
    .from(knowledgeArtifacts)
    .where(and(
      eq(knowledgeArtifacts.module, definition.module),
      eq(knowledgeArtifacts.topic, definition.topic),
      eq(knowledgeArtifacts.sourceHash, sourceHash)
    ))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  ⏭️  Unchanged (hash match)`);
    return true;
  }

  // Generate artifact
  const result = await generateArtifact(definition, chunks);
  if (!result) {
    return false;
  }

  // Delete old versions
  await db.delete(knowledgeArtifacts)
    .where(and(
      eq(knowledgeArtifacts.module, definition.module),
      eq(knowledgeArtifacts.topic, definition.topic)
    ));

  // Insert new artifact
  await db.insert(knowledgeArtifacts).values({
    module: definition.module,
    topic: definition.topic,
    artifactType: definition.artifactType,
    payloadJson: result.payload,
    sourceCitations: result.citations,
    sourceHash,
    confidence: 0.85,
    version: 1
  });

  console.log(`  ✅ Created with ${result.citations.length} citations`);
  return true;
}

async function main() {
  console.log("🚀 Knowledge Artifacts Build Starting...\n");
  console.log("=".repeat(50));

  const startTime = Date.now();
  let success = 0;
  let failed = 0;
  let skipped = 0;

  const dashboard = ARTIFACT_DEFINITIONS.filter(d => d.module === "dashboard");
  const staffing = ARTIFACT_DEFINITIONS.filter(d => d.module === "staffing");
  const layout = ARTIFACT_DEFINITIONS.filter(d => d.module === "layout");

  console.log(`📊 Dashboard artifacts: ${dashboard.length}`);
  console.log(`👥 Staffing artifacts: ${staffing.length}`);
  console.log(`🏗️  Layout artifacts: ${layout.length}`);

  for (const definition of ARTIFACT_DEFINITIONS) {
    try {
      const result = await buildArtifact(definition);
      if (result) success++;
      else failed++;
    } catch (error) {
      console.log(`  ❌ Error: ${error}`);
      failed++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(50));
  console.log("📊 Build Summary");
  console.log("=".repeat(50));
  console.log(`Total definitions: ${ARTIFACT_DEFINITIONS.length}`);
  console.log(`Successful:        ${success}`);
  console.log(`Failed:            ${failed}`);
  console.log(`Duration:          ${duration}s`);
  console.log("=".repeat(50));

  // Show artifact counts by module
  const counts = await db.execute(sql`
    SELECT module, COUNT(*) as count 
    FROM knowledge_artifacts 
    GROUP BY module
  `);
  console.log("\n📦 Artifacts in database:");
  for (const row of counts.rows as any[]) {
    console.log(`  ${row.module}: ${row.count}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
