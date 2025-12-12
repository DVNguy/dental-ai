import OpenAI from "openai";
import { tavily } from "@tavily/core";
import { searchKnowledge, formatKnowledgeContext } from "./knowledgeProcessor";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const tavilyClient = process.env.TAVILY_API_KEY 
  ? tavily({ apiKey: process.env.TAVILY_API_KEY })
  : null;

export interface CoachChatResponse {
  answer: string;
  sources: Array<{ title: string; category: string }>;
  webResults?: Array<{ title: string; url: string; snippet: string }>;
}

async function performWebSearch(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  if (!tavilyClient) {
    console.log("Tavily API key not configured, skipping web search");
    return [];
  }

  try {
    const germanQuery = `${query} Zahnarztpraxis Deutschland`;
    
    const response = await tavilyClient.search(germanQuery, {
      searchDepth: "basic",
      maxResults: 3,
      includeAnswer: false,
    });

    return response.results.map((result) => ({
      title: result.title || "Brancheninfo",
      url: result.url || "",
      snippet: result.content || ""
    }));
  } catch (error) {
    console.error("Tavily web search error:", error);
    return [];
  }
}

export async function generateCoachResponse(question: string): Promise<CoachChatResponse> {
  const knowledgeResults = await searchKnowledge(question, 5);
  const coachKnowledge = formatKnowledgeContext(knowledgeResults);
  
  const sources = knowledgeResults.map(r => ({
    title: r.source.title,
    category: r.source.category
  }));

  const webResults = await performWebSearch(question);

  const webContext = webResults.length > 0 
    ? `\n\n=== AKTUELLE BRANCHENINFORMATIONEN ===\n${webResults.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`).join('\n')}\n=== ENDE BRANCHENINFO ===`
    : "";

  const systemPrompt = `Du bist ein erfahrener **AI Praxis-Coach** für Zahnarztpraxen. Deine Rolle:

1. **Primäre Wissensbasis**: Nutze das Coach-Wissen aus den Dokumenten als Hauptquelle
2. **Ergänzende Informationen**: Integriere aktuelle Brancheninfos wenn relevant
3. **Deutsche Standards**: Berücksichtige ArbStättV, KV-Benchmarks, GOZ, QM-RL
4. **Praxisnah**: Gib konkrete, umsetzbare Empfehlungen

**Kommunikationsstil:**
- Professionell aber freundlich
- Strukturiert mit Aufzählungen wenn sinnvoll
- Keine übermäßig langen Antworten (max. 200-300 Wörter)
- Zitiere Quellen wenn du auf Coach-Wissen referenzierst

Du berätst zu allen Themen rund um die Zahnarztpraxis: Effizienz, Personal, Abrechnung, Marketing, Kommunikation, Compliance, Raumplanung und mehr.`;

  const userPrompt = `${coachKnowledge}${webContext}

NUTZERFRAGE: ${question}

Gib eine hilfreiche, strukturierte Antwort basierend auf deinem Coach-Wissen. Wenn relevantes Coach-Wissen vorhanden ist, nutze es aktiv und verweise darauf.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    const answer = response.choices[0]?.message?.content || "Entschuldigung, ich konnte keine Antwort generieren.";

    return {
      answer,
      sources,
      webResults: webResults.length > 0 ? webResults : undefined
    };
  } catch (error) {
    console.error("Coach chat error:", error);
    throw new Error("Fehler bei der KI-Antwort. Bitte versuchen Sie es erneut.");
  }
}
