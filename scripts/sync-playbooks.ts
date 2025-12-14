import crypto from "crypto";
import OpenAI from "openai";
import { db } from "../server/db";
import { knowledgeChunks, knowledgeSources, knowledgeArtifacts } from "../shared/schema";
import { eq, sql, and, or, ilike } from "drizzle-orm";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PlaybookSchema = z.object({
  name: z.string(),
  steps: z.array(z.object({
    order: z.number(),
    action: z.string(),
    details: z.string()
  })),
  description: z.string()
});

const PLAYBOOK_DEFINITIONS = [
  {
    topic: "neupatient_aufnahme",
    searchTerms: ["Neupatient", "Ersttermin", "Aufnahme", "Anamnese", "Erstgespräch"],
    prompt: `Extrahiere einen Playbook für den Neupatient-Aufnahmeprozess.
    Liefere JSON mit: name (string), description (string), steps (Array von {order: number, action: string, details: string}).
    Die Schritte sollten den kompletten Ablauf von Ankunft bis Behandlungsstart abdecken.`
  },
  {
    topic: "behandlungsablauf_standard",
    searchTerms: ["Behandlung", "Ablauf", "Prozess", "Workflow", "Standard"],
    prompt: `Extrahiere einen Playbook für den Standard-Behandlungsablauf.
    Liefere JSON mit: name (string), description (string), steps (Array von {order: number, action: string, details: string}).
    Die Schritte sollten vom Behandlungsbeginn bis zum Abschluss reichen.`
  },
  {
    topic: "hygiene_tagesroutine",
    searchTerms: ["Hygiene", "Desinfektion", "Sterilisation", "Reinigung", "RKI"],
    prompt: `Extrahiere einen Playbook für die tägliche Hygiene-Routine.
    Liefere JSON mit: name (string), description (string), steps (Array von {order: number, action: string, details: string}).
    Die Schritte sollten alle wichtigen Hygienemaßnahmen enthalten.`
  },
  {
    topic: "notfall_protokoll",
    searchTerms: ["Notfall", "Erste Hilfe", "Notruf", "Reanimation", "Allergie"],
    prompt: `Extrahiere einen Playbook für Notfallsituationen in der Praxis.
    Liefere JSON mit: name (string), description (string), steps (Array von {order: number, action: string, details: string}).
    Die Schritte sollten die wichtigsten Notfall-Reaktionen abdecken.`
  },
  {
    topic: "tagesbeginn_checkliste",
    searchTerms: ["Morgen", "Tagesbeginn", "Vorbereitung", "Öffnung", "Start"],
    prompt: `Extrahiere einen Playbook für den Tagesbeginn/Praxisöffnung.
    Liefere JSON mit: name (string), description (string), steps (Array von {order: number, action: string, details: string}).
    Die Schritte sollten alle Vorbereitungen vor dem ersten Patienten enthalten.`
  },
  {
    topic: "tagesende_checkliste",
    searchTerms: ["Abend", "Tagesende", "Schließung", "Feierabend", "Ende"],
    prompt: `Extrahiere einen Playbook für den Tagesabschluss/Praxisschließung.
    Liefere JSON mit: name (string), description (string), steps (Array von {order: number, action: string, details: string}).
    Die Schritte sollten alle Aufgaben nach dem letzten Patienten enthalten.`
  }
];

async function searchRelevantChunks(searchTerms: string[]): Promise<{ content: string; docName: string; headingPath: string | null; id: string }[]> {
  const conditions = searchTerms.map(term => 
    ilike(knowledgeChunks.content, `%${term}%`)
  );

  const results = await db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
      headingPath: knowledgeChunks.headingPath,
      docName: knowledgeSources.fileName
    })
    .from(knowledgeChunks)
    .leftJoin(knowledgeSources, eq(knowledgeChunks.sourceId, knowledgeSources.id))
    .where(or(...conditions))
    .limit(10);

  return results.map(r => ({
    id: r.id,
    content: r.content,
    docName: r.docName || "unknown",
    headingPath: r.headingPath
  }));
}

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

async function extractPlaybook(definition: typeof PLAYBOOK_DEFINITIONS[0], chunks: { content: string; docName: string; headingPath: string | null; id: string }[]): Promise<{
  payload: z.infer<typeof PlaybookSchema>;
  citations: { docName: string; headingPath: string | null; chunkId: string }[];
} | null> {
  if (chunks.length === 0) {
    console.log(`  No relevant chunks found for ${definition.topic}`);
    return null;
  }

  const context = chunks.map((c, i) => `[Chunk ${i + 1}]\n${c.content}`).join("\n\n---\n\n");

  const systemPrompt = `Du bist ein Experte für Praxismanagement und Workflow-Optimierung.
Extrahiere strukturierte Playbook-Daten aus dem gegebenen Wissenskontext.
Antworte NUR mit validem JSON, keine Erklärungen.
Wenn du nicht genug Informationen findest, erstelle ein sinnvolles Playbook basierend auf Best Practices.`;

  const userPrompt = `=== WISSENSKONTEXT ===
${context}

=== AUFGABE ===
${definition.prompt}

Antworte nur mit JSON:`;

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
    if (!content) return null;

    const parsed = JSON.parse(content);
    const validated = PlaybookSchema.parse(parsed);

    return {
      payload: validated,
      citations: chunks.slice(0, 3).map(c => ({
        docName: c.docName,
        headingPath: c.headingPath,
        chunkId: c.id
      }))
    };
  } catch (error) {
    console.error(`  Error extracting ${definition.topic}:`, error);
    return null;
  }
}

async function upsertPlaybookArtifact(
  topic: string,
  payload: z.infer<typeof PlaybookSchema>,
  citations: { docName: string; headingPath: string | null; chunkId: string }[],
  sourceHash: string
) {
  const existing = await db
    .select()
    .from(knowledgeArtifacts)
    .where(and(
      eq(knowledgeArtifacts.module, "qm"),
      eq(knowledgeArtifacts.topic, topic),
      eq(knowledgeArtifacts.artifactType, "playbook")
    ))
    .limit(1);

  if (existing.length > 0 && existing[0].sourceHash === sourceHash) {
    console.log(`  Playbook ${topic} already up-to-date, skipping`);
    return;
  }

  if (existing.length > 0) {
    await db
      .update(knowledgeArtifacts)
      .set({
        payloadJson: payload,
        sourceCitations: citations,
        sourceHash,
        version: existing[0].version + 1
      })
      .where(eq(knowledgeArtifacts.id, existing[0].id));
    console.log(`  Updated playbook: ${topic}`);
  } else {
    await db.insert(knowledgeArtifacts).values({
      id: crypto.randomUUID(),
      module: "qm",
      topic,
      artifactType: "playbook",
      payloadJson: payload,
      sourceCitations: citations,
      confidence: 0.85,
      version: 1,
      sourceHash
    });
    console.log(`  Created playbook: ${topic}`);
  }
}

async function main() {
  console.log("🔄 Starting Playbook Sync...\n");

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const definition of PLAYBOOK_DEFINITIONS) {
    console.log(`\n📋 Processing: ${definition.topic}`);
    
    const chunks = await searchRelevantChunks(definition.searchTerms);
    console.log(`  Found ${chunks.length} relevant chunks`);
    
    if (chunks.length === 0) {
      console.log(`  Creating default playbook for ${definition.topic}...`);
      const defaultPayload = await createDefaultPlaybook(definition);
      if (defaultPayload) {
        const hash = computeHash(JSON.stringify(defaultPayload));
        await upsertPlaybookArtifact(definition.topic, defaultPayload, [], hash);
        created++;
      } else {
        failed++;
      }
      continue;
    }

    const result = await extractPlaybook(definition, chunks);
    
    if (result) {
      const hash = computeHash(chunks.map(c => c.content).join(""));
      await upsertPlaybookArtifact(definition.topic, result.payload, result.citations, hash);
      created++;
    } else {
      failed++;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n✅ Sync complete!`);
  console.log(`   Created/Updated: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);

  process.exit(0);
}

async function createDefaultPlaybook(definition: typeof PLAYBOOK_DEFINITIONS[0]): Promise<z.infer<typeof PlaybookSchema> | null> {
  const defaults: Record<string, z.infer<typeof PlaybookSchema>> = {
    neupatient_aufnahme: {
      name: "Neupatient-Aufnahme",
      description: "Standard-Ablauf für die Aufnahme neuer Patienten",
      steps: [
        { order: 1, action: "Begrüßung", details: "Patient freundlich empfangen und Termin bestätigen" },
        { order: 2, action: "Anmeldung", details: "Personalien aufnehmen und Versicherungsdaten erfassen" },
        { order: 3, action: "Anamnesebogen", details: "Gesundheitsfragebogen aushändigen und erklären" },
        { order: 4, action: "Wartebereich", details: "Patient in Wartebereich begleiten" },
        { order: 5, action: "Aufklärung", details: "Datenschutz und Behandlungsablauf erläutern" }
      ]
    },
    behandlungsablauf_standard: {
      name: "Standard-Behandlungsablauf",
      description: "Allgemeiner Ablauf einer Behandlung",
      steps: [
        { order: 1, action: "Vorbereitung", details: "Behandlungsraum vorbereiten und Instrumente prüfen" },
        { order: 2, action: "Patient abholen", details: "Patient aus Wartebereich begleiten" },
        { order: 3, action: "Befunderhebung", details: "Aktuelle Beschwerden erfragen" },
        { order: 4, action: "Behandlung", details: "Geplante Behandlung durchführen" },
        { order: 5, action: "Nachsorge", details: "Pflegehinweise geben und Folgetermin vereinbaren" }
      ]
    },
    hygiene_tagesroutine: {
      name: "Tägliche Hygiene-Routine",
      description: "Hygienemaßnahmen gemäß RKI-Richtlinien",
      steps: [
        { order: 1, action: "Flächendesinfektion", details: "Alle Kontaktflächen vor Arbeitsbeginn desinfizieren" },
        { order: 2, action: "Instrumentenaufbereitung", details: "Sterilisator befüllen und Chargenkontrolle" },
        { order: 3, action: "Zwischendesinfektion", details: "Nach jedem Patienten Behandlungseinheit desinfizieren" },
        { order: 4, action: "Händehygiene", details: "Protokoll für Händedesinfektion befolgen" },
        { order: 5, action: "Dokumentation", details: "Hygienemaßnahmen im Hygieneplan dokumentieren" }
      ]
    },
    notfall_protokoll: {
      name: "Notfall-Protokoll",
      description: "Sofortmaßnahmen bei medizinischen Notfällen",
      steps: [
        { order: 1, action: "Erkennen", details: "Notfallsituation erkennen und bewerten" },
        { order: 2, action: "Notruf", details: "112 anrufen - Wer, Was, Wo, Wie viele" },
        { order: 3, action: "Erste Hilfe", details: "Lebensrettende Sofortmaßnahmen einleiten" },
        { order: 4, action: "Notfallkoffer", details: "Notfallausrüstung bereitstellen" },
        { order: 5, action: "Rettungsdienst", details: "Einweisung und Übergabe an Rettungsdienst" }
      ]
    },
    tagesbeginn_checkliste: {
      name: "Tagesbeginn-Checkliste",
      description: "Vorbereitungen vor dem ersten Patienten",
      steps: [
        { order: 1, action: "Praxis öffnen", details: "Schlüsselverwaltung und Alarm deaktivieren" },
        { order: 2, action: "Systeme starten", details: "Computer, Praxissoftware und Geräte hochfahren" },
        { order: 3, action: "Terminplan prüfen", details: "Tagesplan durchgehen und Vorbereitungen treffen" },
        { order: 4, action: "Material prüfen", details: "Verbrauchsmaterial und Instrumente kontrollieren" },
        { order: 5, action: "Empfangsbereich", details: "Wartebereich aufräumen und vorbereiten" }
      ]
    },
    tagesende_checkliste: {
      name: "Tagesende-Checkliste",
      description: "Aufgaben nach dem letzten Patienten",
      steps: [
        { order: 1, action: "Abrechnung", details: "Tagesabrechnungen abschließen" },
        { order: 2, action: "Aufräumen", details: "Behandlungsräume aufräumen und desinfizieren" },
        { order: 3, action: "Geräte ausschalten", details: "Alle Geräte ordnungsgemäß abschalten" },
        { order: 4, action: "Sicherheit", details: "Fenster und Türen kontrollieren" },
        { order: 5, action: "Alarm aktivieren", details: "Alarmanlage aktivieren und Praxis verschließen" }
      ]
    }
  };

  return defaults[definition.topic] || null;
}

main().catch(console.error);
