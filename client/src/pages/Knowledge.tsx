import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Brain, Search, BookOpen, Loader2, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

const CATEGORIES = [
  { value: "scheduling", label: "Terminplanung" },
  { value: "patient-flow", label: "Patientenfluss" },
  { value: "staff-management", label: "Personalführung" },
  { value: "room-layout", label: "Raumplanung" },
  { value: "efficiency", label: "Effizienz" },
  { value: "profitability", label: "Wirtschaftlichkeit" },
  { value: "communication", label: "Kommunikation" },
  { value: "marketing", label: "Praxismarketing" },
  { value: "hygiene", label: "Hygiene" },
  { value: "quality", label: "Qualitätsmanagement" },
  { value: "general", label: "Allgemein" },
];

export default function Knowledge() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["knowledge-sources"],
    queryFn: api.knowledge.list,
  });

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["knowledge-search", debouncedQuery],
    queryFn: () => api.knowledge.search(debouncedQuery, 5),
    enabled: debouncedQuery.length > 2,
  });

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-knowledge">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-knowledge">
            <Brain className="h-7 w-7 text-primary" />
            Coach-Wissensbasis
          </h1>
          <p className="text-muted-foreground mt-1">
            Expertenwissen als Grundlage für alle KI-Empfehlungen
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Wissen durchsuchen
          </CardTitle>
          <CardDescription>
            Durchsuchen Sie die integrierte Coaching-Wissensbasis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="z.B. Wie optimiere ich die Wartezeiten?"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          
          {isSearching && (
            <div className="flex items-center gap-2 mt-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Suche...
            </div>
          )}
          
          {searchResults && searchResults.length > 0 && (
            <div className="mt-4 space-y-3">
              {searchResults.map((result, i) => (
                <div key={i} className="p-3 border rounded-lg bg-muted/30" data-testid={`search-result-${i}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{getCategoryLabel(result.source.category)}</Badge>
                    <span className="text-sm font-medium">{result.source.title}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {Math.round(result.similarity * 100)}% relevant
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {result.content}
                  </p>
                </div>
              ))}
            </div>
          )}
          
          {searchQuery.length > 2 && searchResults?.length === 0 && !isSearching && (
            <p className="mt-4 text-muted-foreground text-sm">
              Keine passenden Ergebnisse gefunden.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Integriertes Wissen ({sources.length} Quellen)
          </CardTitle>
          <CardDescription>
            Fest eingebautes Coaching-Expertenwissen
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Quellen...
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Die Wissensbasis wird gerade eingerichtet.</p>
              <p className="text-sm mt-1">
                Bald stehen hier Coaching-Tipps für optimale Praxisführung zur Verfügung.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map(source => (
                <div
                  key={source.id}
                  className="flex items-start gap-3 p-4 border rounded-lg"
                  data-testid={`knowledge-source-${source.id}`}
                >
                  <FileText className="h-8 w-8 text-primary shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium">{source.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge>{getCategoryLabel(source.category)}</Badge>
                      {source.tags.map((tag, i) => (
                        <Badge key={i} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                    {source.description && (
                      <p className="text-sm text-muted-foreground mt-2">{source.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
