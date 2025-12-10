import mammoth from "mammoth";
import OpenAI from "openai";
import { storage } from "../storage";
import type { InsertKnowledgeChunk } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function extractTextFromWord(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export function splitIntoChunks(text: string, maxTokens: number = 600): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";
  let currentTokenEstimate = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = Math.ceil(paragraph.length / 4);
    
    if (currentTokenEstimate + paragraphTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
      currentTokenEstimate = 0;
    }
    
    currentChunk += paragraph + "\n\n";
    currentTokenEstimate += paragraphTokens;
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

export async function extractKeyPoints(text: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Du bist ein Experte für Zahnarztpraxis-Management. Extrahiere die 2-4 wichtigsten Kernaussagen aus dem folgenden Text. Antworte nur mit einer JSON-Array von Strings."
      },
      {
        role: "user",
        content: text
      }
    ],
    response_format: { type: "json_object" }
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    return parsed.keyPoints || parsed.key_points || [];
  } catch {
    return [];
  }
}

export interface ProcessDocumentResult {
  sourceId: string;
  chunksProcessed: number;
  totalTokens: number;
}

export async function processDocument(
  buffer: Buffer,
  fileName: string,
  title: string,
  category: string,
  tags: string[],
  description?: string
): Promise<ProcessDocumentResult> {
  const text = await extractTextFromWord(buffer);
  
  const source = await storage.createKnowledgeSource({
    title,
    fileName,
    category,
    tags,
    description: description || null,
  });

  const chunks = splitIntoChunks(text);
  let totalTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    const tokens = Math.ceil(chunkText.length / 4);
    totalTokens += tokens;

    const [embedding, keyPoints] = await Promise.all([
      generateEmbedding(chunkText),
      extractKeyPoints(chunkText)
    ]);

    const chunkData: InsertKnowledgeChunk = {
      sourceId: source.id,
      chunkIndex: i,
      content: chunkText,
      tokens,
      embedding,
      keyPoints,
    };

    await storage.createKnowledgeChunk(chunkData);
  }

  return {
    sourceId: source.id,
    chunksProcessed: chunks.length,
    totalTokens,
  };
}

export async function searchKnowledge(query: string, limit: number = 5) {
  const sources = await storage.getAllKnowledgeSources();
  if (sources.length === 0) {
    return [];
  }
  
  const queryEmbedding = await generateEmbedding(query);
  return storage.searchKnowledgeChunks(queryEmbedding, limit);
}

export function formatKnowledgeContext(
  chunks: Array<{ content: string; source: { title: string; category: string }; similarity: number }>
): string {
  if (chunks.length === 0) {
    return "";
  }

  const context = chunks.map((chunk, i) => {
    return `[Quelle ${i + 1}: "${chunk.source.title}" (${chunk.source.category})]
${chunk.content}`;
  }).join("\n\n---\n\n");

  return `
=== COACH-WISSEN (Primäre Quelle) ===
Die folgenden Informationen stammen aus der Expertise eines erfahrenen Zahnarztpraxis-Coaches und sollten als primäre Grundlage für alle Empfehlungen dienen:

${context}

=== ENDE COACH-WISSEN ===
`;
}
