import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Brain, Search, Loader2, CheckCircle2, BookOpen, TrendingUp, Users, Calculator, Shield } from "lucide-react";
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

const EXPERTISE_AREAS = [
  { icon: TrendingUp, title: "Praxiseffizienz", desc: "Workflow-Optimierung & Lean Management" },
  { icon: Users, title: "Personalführung", desc: "Recruiting, Teambuilding & Change Management" },
  { icon: Calculator, title: "Betriebswirtschaft", desc: "Kostenrechnung, KPIs & Wirtschaftlichkeit" },
  { icon: Shield, title: "Compliance", desc: "GOZ-Abrechnung, Recht & Qualitätsmanagement" },
];

export default function Knowledge() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: sources = [] } = useQuery({
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

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Umfassendes Praxis-Expertenwissen
          </CardTitle>
          <CardDescription>
            Von A bis Z - fundiert, praxiserprobt und wissenschaftlich basiert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm leading-relaxed">
            Unsere KI basiert auf einer <strong>umfangreichen Wissensbasis</strong>, die jahrelange Erfahrung 
            in der Beratung und Optimierung von Zahnarztpraxen vereint. Das integrierte Expertenwissen 
            umfasst alle relevanten Bereiche der modernen Praxisführung - von der strategischen Planung 
            bis zur operativen Umsetzung.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EXPERTISE_AREAS.map((area, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border">
                <area.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-medium text-sm">{area.title}</h4>
                  <p className="text-xs text-muted-foreground">{area.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{sources.length} Wissensmodule integriert</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Kontinuierlich aktualisiert</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Deutsche Regularien & Standards</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Wissen durchsuchen
          </CardTitle>
          <CardDescription>
            Stellen Sie eine Frage - die KI findet die relevanten Informationen
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
    </div>
  );
}
