import fs from "fs";
import path from "path";
import { processDocument } from "../server/ai/knowledgeProcessor";
import { storage } from "../server/storage";

const KNOWLEDGE_DIR = "./knowledge-docs";

interface DocumentConfig {
  fileName: string;
  title: string;
  category: string;
  tags: string[];
  description?: string;
}

async function importDocuments() {
  console.log("🧠 Coach-Wissen Import Script\n");

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.log(`📁 Erstelle Ordner: ${KNOWLEDGE_DIR}`);
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => 
    f.endsWith(".docx") || f.endsWith(".doc")
  );

  if (files.length === 0) {
    console.log(`\n⚠️  Keine Word-Dokumente gefunden in ${KNOWLEDGE_DIR}/`);
    console.log("\nBitte legen Sie Ihre .docx-Dateien in diesen Ordner.");
    console.log("\nBeispiel-Dateistruktur:");
    console.log("  knowledge-docs/");
    console.log("    ├── terminplanung-grundlagen.docx");
    console.log("    ├── patientenfluss-optimierung.docx");
    console.log("    └── personalfuehrung-tipps.docx");
    return;
  }

  console.log(`📚 ${files.length} Dokument(e) gefunden:\n`);

  const existingSources = await storage.getAllKnowledgeSources();
  const existingFileNames = new Set(existingSources.map(s => s.fileName));

  for (const fileName of files) {
    const filePath = path.join(KNOWLEDGE_DIR, fileName);
    
    if (existingFileNames.has(fileName)) {
      console.log(`⏭️  ${fileName} - bereits importiert, überspringe...`);
      continue;
    }

    console.log(`📄 Verarbeite: ${fileName}`);
    
    const title = fileName
      .replace(/\.(docx?|doc)$/i, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());

    const category = detectCategory(fileName, title);
    const tags = extractTags(title);

    try {
      const buffer = fs.readFileSync(filePath);
      const result = await processDocument(
        buffer,
        fileName,
        title,
        category,
        tags,
        `Automatisch importiert aus ${fileName}`
      );
      
      console.log(`   ✅ ${result.chunksProcessed} Abschnitte verarbeitet (~${result.totalTokens} Tokens)`);
    } catch (error) {
      console.log(`   ❌ Fehler: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  }

  console.log("\n✨ Import abgeschlossen!");
  
  const allSources = await storage.getAllKnowledgeSources();
  console.log(`\n📊 Wissensbasis enthält jetzt ${allSources.length} Quelle(n).`);
}

function detectCategory(fileName: string, title: string): string {
  const text = (fileName + " " + title).toLowerCase();
  
  if (text.includes("termin") || text.includes("schedule") || text.includes("booking")) {
    return "scheduling";
  }
  if (text.includes("patient") || text.includes("flow") || text.includes("fluss")) {
    return "patient-flow";
  }
  if (text.includes("personal") || text.includes("staff") || text.includes("team") || text.includes("führung")) {
    return "staff-management";
  }
  if (text.includes("raum") || text.includes("layout") || text.includes("room")) {
    return "room-layout";
  }
  if (text.includes("effizienz") || text.includes("efficiency") || text.includes("produktiv")) {
    return "efficiency";
  }
  if (text.includes("wirtschaft") || text.includes("profit") || text.includes("umsatz") || text.includes("kosten")) {
    return "profitability";
  }
  if (text.includes("kommunikation") || text.includes("gespräch") || text.includes("communication")) {
    return "communication";
  }
  if (text.includes("marketing") || text.includes("werbung")) {
    return "marketing";
  }
  if (text.includes("hygiene") || text.includes("steril") || text.includes("desinfektion")) {
    return "hygiene";
  }
  if (text.includes("qualität") || text.includes("quality") || text.includes("qm")) {
    return "quality";
  }
  
  return "general";
}

function extractTags(title: string): string[] {
  const words = title.toLowerCase().split(/\s+/);
  const stopWords = new Set(["und", "oder", "für", "mit", "in", "der", "die", "das", "den", "dem", "ein", "eine", "einer"]);
  
  return words
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 5);
}

importDocuments().catch(console.error);
