import fs from "fs";
import path from "path";
import crypto from "crypto";
import mammoth from "mammoth";
import OpenAI from "openai";
import { db } from "../server/db";
import { knowledgeSources, knowledgeChunks } from "../shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const KNOWLEDGE_DOCS_DIR = "./knowledge-docs";
const TARGET_TOKENS = 750;
const MIN_TOKENS = 600;
const MAX_TOKENS = 900;
const OVERLAP_TOKENS = 100;

const FORCE_MODE = process.argv.includes("--force") || process.env.FORCE_REINGEST === "1";
const DEBUG_MODE = process.argv.includes("--debug");

interface ChunkInfo {
  content: string;
  headingPath: string;
  tokens: number;
}

interface IngestStats {
  documentsProcessed: number;
  documentsSkippedUnchanged: number;
  chunksExisting: number;
  chunksInserted: number;
  chunksUpdated: number;
  chunksSkipped: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function computeFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

function computeContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;

  let text = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n\n# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n\n### $1\n\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n\n#### $1\n\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "• $1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

function extractTextFromMarkdown(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8").trim();
}

function splitIntoHeadingBasedChunks(text: string): ChunkInfo[] {
  const lines = text.split("\n");
  const chunks: ChunkInfo[] = [];
  
  let currentHeadingPath = "Dokument";
  let currentContent = "";
  let headingStack: string[] = [];
  
  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);
    const h4Match = line.match(/^#### (.+)$/);
    
    if (h1Match) {
      if (currentContent.trim()) {
        chunks.push(...splitLargeChunk(currentContent.trim(), currentHeadingPath));
      }
      headingStack = [h1Match[1]];
      currentHeadingPath = headingStack.join(" > ");
      currentContent = "";
    } else if (h2Match) {
      if (currentContent.trim()) {
        chunks.push(...splitLargeChunk(currentContent.trim(), currentHeadingPath));
      }
      headingStack = headingStack.slice(0, 1);
      headingStack.push(h2Match[1]);
      currentHeadingPath = headingStack.join(" > ");
      currentContent = "";
    } else if (h3Match) {
      if (currentContent.trim()) {
        chunks.push(...splitLargeChunk(currentContent.trim(), currentHeadingPath));
      }
      headingStack = headingStack.slice(0, 2);
      headingStack.push(h3Match[1]);
      currentHeadingPath = headingStack.join(" > ");
      currentContent = "";
    } else if (h4Match) {
      if (currentContent.trim()) {
        chunks.push(...splitLargeChunk(currentContent.trim(), currentHeadingPath));
      }
      headingStack = headingStack.slice(0, 3);
      headingStack.push(h4Match[1]);
      currentHeadingPath = headingStack.join(" > ");
      currentContent = "";
    } else {
      currentContent += line + "\n";
    }
  }
  
  if (currentContent.trim()) {
    chunks.push(...splitLargeChunk(currentContent.trim(), currentHeadingPath));
  }
  
  return chunks;
}

function splitLargeChunk(content: string, headingPath: string): ChunkInfo[] {
  const tokens = estimateTokens(content);
  
  if (tokens <= MAX_TOKENS) {
    return [{ content, headingPath, tokens }];
  }
  
  const paragraphs = content.split(/\n\n+/);
  const chunks: ChunkInfo[] = [];
  let currentChunk = "";
  let currentTokens = 0;
  
  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);
    
    if (currentTokens + paraTokens > TARGET_TOKENS && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        headingPath,
        tokens: currentTokens
      });
      
      const overlapText = currentChunk.slice(-OVERLAP_TOKENS * 4);
      currentChunk = overlapText + "\n\n" + para;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
      currentTokens += paraTokens;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      headingPath,
      tokens: estimateTokens(currentChunk.trim())
    });
  }
  
  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

async function ingestDocument(filePath: string, stats: IngestStats): Promise<void> {
  const fileName = path.basename(filePath);
  const isMarkdown = fileName.endsWith(".md");
  const buffer = fs.readFileSync(filePath);
  const fileHash = computeFileHash(buffer);
  
  if (DEBUG_MODE) {
    console.log(`  📋 ${fileName} → hash: ${fileHash}`);
  }
  
  const existingSource = await db.select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.fileName, fileName))
    .limit(1);
  
  let sourceId: string;
  const isUnchanged = existingSource.length > 0 && existingSource[0].fileHash === fileHash;
  
  if (isUnchanged && !FORCE_MODE) {
    console.log(`  ⏭️  Unchanged: ${fileName}`);
    stats.documentsSkippedUnchanged++;
    return;
  }
  
  stats.documentsProcessed++;
  
  if (existingSource.length > 0) {
    sourceId = existingSource[0].id;
    if (!isUnchanged) {
      await db.update(knowledgeSources)
        .set({ fileHash, updatedAt: new Date() })
        .where(eq(knowledgeSources.id, sourceId));
      console.log(`  🔄 Updating: ${fileName}`);
    } else {
      console.log(`  🔁 Force re-ingesting: ${fileName}`);
    }
  } else {
    const title = fileName.replace(/\.(docx|md)$/i, "").replace(/[_-]/g, " ");
    const [newSource] = await db.insert(knowledgeSources).values({
      title,
      fileName,
      fileHash,
      category: "training",
      tags: ["dental", "praxis", "coaching"],
    }).returning();
    sourceId = newSource.id;
    console.log(`  ➕ New: ${fileName}`);
  }

  const text = isMarkdown
    ? extractTextFromMarkdown(filePath)
    : await extractTextFromDocx(buffer);
  const chunkInfos = splitIntoHeadingBasedChunks(text);
  
  for (let i = 0; i < chunkInfos.length; i++) {
    const chunk = chunkInfos[i];
    const contentHash = computeContentHash(chunk.content);
    
    const existingChunk = await db.select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.contentHash, contentHash))
      .limit(1);
    
    if (existingChunk.length > 0) {
      if (existingChunk[0].sourceId !== sourceId) {
        await db.update(knowledgeChunks)
          .set({ sourceId, headingPath: chunk.headingPath, chunkIndex: i })
          .where(eq(knowledgeChunks.id, existingChunk[0].id));
        stats.chunksUpdated++;
      } else {
        stats.chunksExisting++;
      }
      continue;
    }
    
    const embedding = await generateEmbedding(chunk.content);
    
    await db.insert(knowledgeChunks).values({
      sourceId,
      headingPath: chunk.headingPath,
      chunkIndex: i,
      content: chunk.content,
      contentHash,
      tokens: chunk.tokens,
      embedding,
    });
    
    stats.chunksInserted++;
  }
}

async function main() {
  console.log("🚀 Knowledge Ingestion Starting...\n");
  
  if (FORCE_MODE) {
    console.log("⚡ FORCE MODE ENABLED - Re-processing all documents\n");
  }
  if (DEBUG_MODE) {
    console.log("🔍 DEBUG MODE ENABLED - Showing hash details\n");
  }
  
  const startTime = Date.now();
  
  const files = fs.readdirSync(KNOWLEDGE_DOCS_DIR)
    .filter(f => f.endsWith(".docx") || f.endsWith(".md"))
    .map(f => path.join(KNOWLEDGE_DOCS_DIR, f));
  
  console.log(`📚 Found ${files.length} documents\n`);
  
  const stats: IngestStats = {
    documentsProcessed: 0,
    documentsSkippedUnchanged: 0,
    chunksExisting: 0,
    chunksInserted: 0,
    chunksUpdated: 0,
    chunksSkipped: 0,
  };
  
  for (const file of files) {
    try {
      await ingestDocument(file, stats);
    } catch (error) {
      console.error(`  ❌ Error: ${path.basename(file)}:`, error);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 Ingestion Summary");
  console.log("=".repeat(50));
  console.log(`Documents found:              ${files.length}`);
  console.log(`Documents processed:          ${stats.documentsProcessed}`);
  console.log(`Documents skipped (unchanged):${stats.documentsSkippedUnchanged}`);
  console.log("-".repeat(50));
  console.log(`Chunks inserted (new):        ${stats.chunksInserted}`);
  console.log(`Chunks updated (moved):       ${stats.chunksUpdated}`);
  console.log(`Chunks existing (unchanged):  ${stats.chunksExisting}`);
  console.log("-".repeat(50));
  console.log(`Duration: ${duration}s`);
  console.log("=".repeat(50));
}

main().catch(console.error).finally(() => process.exit(0));
