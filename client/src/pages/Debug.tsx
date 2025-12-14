import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Database, Brain, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TableStats {
  count: number;
  latestCreatedAt?: string | null;
  latestUpdatedAt?: string | null;
}

interface DebugStats {
  tables: {
    users: TableStats;
    practices: TableStats;
    rooms: TableStats;
    staff: TableStats;
    simulations: TableStats;
    knowledgeSources: TableStats;
    knowledgeChunks: TableStats;
    knowledgeArtifacts: TableStats;
    workflows: TableStats;
    workflowConnections: TableStats;
    workflowSteps: TableStats;
  };
  ragConfig: {
    embeddingModel: string;
    vectorDimensions: number;
    targetChunkTokens: string;
    overlap: number;
  };
  workflowDuplicates: { slug: string; practiceId: string; count: number }[];
  timestamp: string;
  environment: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function Debug() {
  const { data, isLoading, error, refetch } = useQuery<DebugStats>({
    queryKey: ["/api/debug/status"],
    queryFn: async () => {
      const res = await fetch("/api/debug/status");
      if (!res.ok) throw new Error("Failed to fetch debug stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="debug-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" data-testid="debug-error">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">Debug endpoint nicht verfügbar</p>
        <p className="text-sm text-muted-foreground">Möglicherweise ist DEBUG_STATUS nicht aktiviert.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6" data-testid="debug-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="debug-title">System Debug Status</h1>
          <p className="text-sm text-muted-foreground">
            Letzte Aktualisierung: {formatDate(data?.timestamp)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data?.environment === "production" ? "destructive" : "secondary"} data-testid="debug-env">
            {data?.environment}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="debug-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="debug-tables-card" className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Datenbank Tabellen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Tabelle</th>
                    <th className="text-right py-2 px-2">Count</th>
                    <th className="text-right py-2 px-2">Letzte Erstellung</th>
                    <th className="text-right py-2 px-2">Letztes Update</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.tables && Object.entries(data.tables).map(([key, stats]) => (
                    <tr key={key} className="border-b last:border-0 hover:bg-muted/50" data-testid={`table-${key}`}>
                      <td className="py-2 px-2 font-medium">{key}</td>
                      <td className="py-2 px-2 text-right font-mono">{stats.count}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground text-xs">
                        {formatDate(stats.latestCreatedAt)}
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground text-xs">
                        {formatDate(stats.latestUpdatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="debug-rag-card">
          <CardHeader className="flex flex-row items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">RAG Konfiguration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {data?.ragConfig && Object.entries(data.ragConfig).map(([key, value]) => (
                <div key={key} className="flex justify-between" data-testid={`rag-${key}`}>
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-mono font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="debug-duplicates-card">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg">Workflow Duplikate</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.workflowDuplicates && data.workflowDuplicates.length > 0 ? (
              <div className="space-y-2 text-sm">
                {data.workflowDuplicates.map((dup, i) => (
                  <div key={i} className="flex justify-between text-orange-600" data-testid={`duplicate-${i}`}>
                    <span>{dup.slug}</span>
                    <span className="font-mono">{dup.count}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-600" data-testid="no-duplicates">
                Keine Duplikate gefunden
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="debug-raw-card">
        <CardHeader>
          <CardTitle className="text-lg">Raw JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs max-h-96" data-testid="debug-raw-json">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
