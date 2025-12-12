import OpenAI from "openai";
import { tavily } from "@tavily/core";
import { db } from "../db";
import { knowledgeSources, knowledgeChunks } from "../../shared/schema";
import { sql, eq, desc } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tavilyClient = process.env.TAVILY_API_KEY 
  ? tavily({ apiKey: process.env.TAVILY_API_KEY })
  : null;

const TIME_SENSITIVE_KEYWORDS = [
  "aktuell", "neu", "2024", "2025", "gesetz", "richtlinie", "verordnung",
  "gebühren", "goz", "bema", "frist", "deadline", "änderung", "reform",
  "kv", "kassenzahnärztlich", "hygiene", "rki", "corona", "covid"
];

const AUTHORITATIVE_DOMAINS = [
  "kzbv.de", "bzaek.de", "dgzmk.de", "rki.de", "bundesgesundheitsministerium.de",
  "gesetze-im-internet.de", "aok.de", "tk.de", "barmer.de", "kvwl.de"
];

export interface RetrievedChunk {
  id: string;
  docName: string;
  headingPath: string | null;
  content: string;
  score: number;
}

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  publisher?: string;
  date?: string;
}

export interface RAGQueryResult {
  answer: string;
  kbChunks: RetrievedChunk[];
  webResults?: WebResult[];
  kbCoverage: "sufficient" | "partial" | "insufficient";
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

export async function retrieveKnowledgeChunks(
  question: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await generateEmbedding(question);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const results = await db.execute(sql`
    SELECT 
      kc.id,
      ks.file_name as doc_name,
      kc.heading_path,
      kc.content,
      1 - (kc.embedding <=> ${embeddingStr}::vector) as score
    FROM knowledge_chunks kc
    JOIN knowledge_sources ks ON kc.source_id = ks.id
    WHERE kc.embedding IS NOT NULL
    ORDER BY kc.embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `);

  return (results.rows as any[]).map(row => ({
    id: row.id,
    docName: row.doc_name,
    headingPath: row.heading_path,
    content: row.content,
    score: parseFloat(row.score) || 0
  }));
}

function assessKBCoverage(chunks: RetrievedChunk[]): "sufficient" | "partial" | "insufficient" {
  if (chunks.length === 0) return "insufficient";
  
  const avgScore = chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length;
  const topScore = chunks[0]?.score || 0;
  
  if (topScore >= 0.75 && avgScore >= 0.6) return "sufficient";
  if (topScore >= 0.5 || avgScore >= 0.4) return "partial";
  return "insufficient";
}

function isTimeSensitiveTopic(question: string): boolean {
  const lowerQ = question.toLowerCase();
  return TIME_SENSITIVE_KEYWORDS.some(kw => lowerQ.includes(kw));
}

function filterAuthoritativeDomains(results: WebResult[]): WebResult[] {
  const authoritative = results.filter(r => 
    AUTHORITATIVE_DOMAINS.some(domain => r.url.includes(domain))
  );
  return authoritative.length > 0 ? authoritative : results.slice(0, 3);
}

async function performWebSearch(question: string): Promise<WebResult[]> {
  if (!tavilyClient) return [];
  
  try {
    const response = await tavilyClient.search(
      `${question} Zahnarztpraxis Deutschland`,
      { searchDepth: "basic", maxResults: 5 }
    );
    
    const results: WebResult[] = response.results
      .filter(r => r.url && r.url.startsWith("http"))
      .map(r => {
        let publisher = "web";
        try {
          publisher = new URL(r.url).hostname.replace("www.", "");
        } catch {}
        return {
          title: r.title || "Webquelle",
          url: r.url,
          snippet: (r.content || "").slice(0, 2500),
          publisher,
          date: new Date().toISOString().split("T")[0]
        };
      });
    
    return filterAuthoritativeDomains(results);
  } catch (error) {
    console.error("Web search error:", error);
    return [];
  }
}

function formatKBContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  
  return chunks.map((chunk, i) => {
    const source = chunk.docName.replace(/\.docx$/i, "").replace(/[_-]/g, " ");
    const heading = chunk.headingPath || "Allgemein";
    return `[KB-Quelle ${i + 1}: "${source}" > ${heading}]\n${chunk.content}`;
  }).join("\n\n---\n\n");
}

function formatWebContext(results: WebResult[]): string {
  if (results.length === 0) return "";
  
  return results.map((r, i) => 
    `[Web-Quelle ${i + 1}: ${r.title} (${r.publisher}, ${r.date})]\nURL: ${r.url}\n${r.snippet}`
  ).join("\n\n---\n\n");
}

export async function queryRAG(
  question: string,
  topK: number = 5
): Promise<RAGQueryResult> {
  const kbChunks = await retrieveKnowledgeChunks(question, topK);
  const kbCoverage = assessKBCoverage(kbChunks);
  
  let webResults: WebResult[] = [];
  const needsWebSearch = kbCoverage !== "sufficient" || isTimeSensitiveTopic(question);
  
  if (needsWebSearch) {
    webResults = await performWebSearch(question);
  }
  
  const kbContext = formatKBContext(kbChunks);
  const webContext = formatWebContext(webResults);
  
  const systemPrompt = `Du bist ein erfahrener **AI Praxis-Coach** für Zahnarztpraxen.

## Antwort-Regeln:
1. **Primäre Quelle (KB)**: Nutze die Coach-Wissensbasis als Hauptquelle
2. **Sekundäre Quelle (Web)**: Ergänze mit Web-Quellen nur wenn KB unzureichend oder Thema zeitkritisch
3. **Zitierung PFLICHT**: Jede Aussage muss mit [KB-Quelle X] oder [Web-Quelle X] zitiert werden
4. **Deutsche Standards**: Berücksichtige ArbStättV, KV-Benchmarks, GOZ, QM-RL, KZBV
5. **Keine Personenbewertungen**: Keine individuellen Leistungs- oder Stress-Scores

## Format:
- Strukturierte Aufzählungspunkte
- Max. 300 Wörter
- Wenn Info fehlt: Klar benennen was fehlt
- KB-Quellen vor Web-Quellen bevorzugen

## Quellen-Trennung am Ende:
Falls Web-Quellen genutzt:
**Wissensbasis-Quellen:** [Liste der KB-Quellen]
**Web-Quellen:** [Titel, Herausgeber, Datum, URL]`;

  const userPrompt = `=== WISSENSBASIS (Primär) ===
${kbContext || "(Keine relevanten KB-Einträge gefunden)"}

${webContext ? `=== WEB-RECHERCHE (Sekundär) ===
${webContext}` : ""}

NUTZERFRAGE: ${question}

Gib eine strukturierte Antwort mit korrekten Zitierungen.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.5
    });

    const answer = response.choices[0]?.message?.content || 
      "Entschuldigung, ich konnte keine Antwort generieren.";

    return { answer, kbChunks, webResults: webResults.length > 0 ? webResults : undefined, kbCoverage };
  } catch (error) {
    console.error("RAG query error:", error);
    throw new Error("Fehler bei der KI-Antwort. Bitte versuchen Sie es erneut.");
  }
}
