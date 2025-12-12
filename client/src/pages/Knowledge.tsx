import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, Loader2, User, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; category: string }>;
  isStreaming?: boolean;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: `Willkommen beim **AI Praxis-Coach**! 

Ich bin Ihr persönlicher Berater für alle Fragen rund um die Zahnarztpraxis. Mein Wissen basiert auf umfangreicher Coaching-Erfahrung und aktuellen Branchenstandards.

**Wie kann ich Ihnen helfen?** Fragen Sie mich zum Beispiel:
- "Wie kann ich die Wartezeiten in meiner Praxis reduzieren?"
- "Welche KPIs sollte ich monatlich überwachen?"
- "Tipps für effektives Personalrecruiting"
- "Wie optimiere ich meine GOZ-Abrechnung?"`,
};

export default function Knowledge() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await fetch("/api/ai/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      
      if (!response.ok) {
        throw new Error("Fehler bei der Anfrage");
      }
      
      return response.json() as Promise<{ 
        answer: string; 
        sources: Array<{ title: string; category: string }>;
        webResults?: Array<{ title: string; url: string }>;
      }>;
    },
    onMutate: (question) => {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question,
      };
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        isStreaming: true,
      };
      
      setMessages(prev => [...prev, userMessage, assistantMessage]);
    },
    onSuccess: (data) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.isStreaming 
            ? { ...msg, content: data.answer, sources: data.sources, isStreaming: false }
            : msg
        )
      );
    },
    onError: (error) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.isStreaming 
            ? { ...msg, content: `Entschuldigung, es gab einen Fehler: ${error.message}`, isStreaming: false }
            : msg
        )
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;
    
    chatMutation.mutate(input.trim());
    setInput("");
  };

  const handleNewChat = () => {
    setMessages([WELCOME_MESSAGE]);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)]" data-testid="page-knowledge">
      <div className="border-b p-3 md:p-4 flex items-center justify-between bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold" data-testid="heading-knowledge">
              AI Praxis-Coach
            </h1>
            <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">
              Ihr persönlicher Berater für Praxisoptimierung
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleNewChat}
          data-testid="button-new-chat"
          className="text-xs md:text-sm"
        >
          <RefreshCw className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Neuer Chat</span>
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
              data-testid={`message-${message.id}`}
            >
              {message.role === "assistant" && (
                <div className="p-2 rounded-full bg-primary/10 h-fit">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}
              
              <Card className={cn(
                "max-w-[80%]",
                message.role === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted/50"
              )}>
                <CardContent className="p-3">
                  {message.isStreaming ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Denke nach...</span>
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div 
                        className="text-sm whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ 
                          __html: message.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\n/g, '<br>')
                        }} 
                      />
                    </div>
                  )}
                  
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Basierend auf Coach-Wissen:</p>
                      <div className="flex flex-wrap gap-1">
                        {message.sources.slice(0, 3).map((source, i) => (
                          <span 
                            key={i} 
                            className="text-xs px-2 py-0.5 rounded bg-primary/10 text-foreground"
                            title={source.title}
                          >
                            {source.title.length > 30 ? source.title.substring(0, 30) + "..." : source.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {message.role === "user" && (
                <div className="p-2 rounded-full bg-primary h-fit">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4 bg-background/95 backdrop-blur">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Stellen Sie Ihre Frage..."
            disabled={chatMutation.isPending}
            className="flex-1"
            data-testid="input-chat"
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || chatMutation.isPending}
            data-testid="button-send"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
