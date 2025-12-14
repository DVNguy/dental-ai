import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, CheckCircle2 } from "lucide-react";

interface PlaybookStep {
  order: number;
  action: string;
  details: string;
}

interface PlaybookPayload {
  name: string;
  description: string;
  steps: PlaybookStep[];
}

interface Playbook {
  id: string;
  topic: string;
  payload: PlaybookPayload;
  confidence: number;
}

export default function Playbooks() {
  const { data: playbooks, isLoading, error } = useQuery<Playbook[]>({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const response = await fetch("/api/playbooks");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Playbooks");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]" data-testid="loading-playbooks">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6" data-testid="error-playbooks">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Fehler beim Laden der Playbooks. Bitte versuchen Sie es später erneut.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="page-playbooks">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold" data-testid="heading-playbooks">
            Praxis-Playbooks
          </h1>
          <p className="text-sm text-muted-foreground">
            Standard-Abläufe und Checklisten für Ihre Praxis
          </p>
        </div>
      </div>

      {!playbooks || playbooks.length === 0 ? (
        <Card data-testid="empty-playbooks">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              Keine Playbooks vorhanden. Führen Sie zuerst das Sync-Skript aus.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-3" data-testid="playbooks-list">
          {playbooks.map((playbook) => (
            <AccordionItem
              key={playbook.id}
              value={playbook.id}
              className="border rounded-lg px-4 bg-card"
              data-testid={`playbook-${playbook.topic}`}
            >
              <AccordionTrigger className="hover:no-underline py-4" data-testid={`trigger-playbook-${playbook.topic}`}>
                <div className="flex items-center gap-3 text-left">
                  <div className="flex-1">
                    <div className="font-medium">{playbook.payload.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {playbook.payload.description}
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {playbook.payload.steps.length} Schritte
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3 mt-2">
                  {playbook.payload.steps
                    .sort((a, b) => a.order - b.order)
                    .map((step, index) => (
                      <div
                        key={index}
                        className="flex gap-3 p-3 rounded-lg bg-muted/50"
                        data-testid={`step-${playbook.topic}-${step.order}`}
                      >
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">{step.order}</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{step.action}</div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {step.details}
                          </div>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                      </div>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
