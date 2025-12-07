import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type LayoutAnalysis } from "@/lib/api";
import { usePractice } from "@/contexts/PracticeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  TrendingUp, 
  Users, 
  LayoutGrid, 
  Target,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AIAdvisorProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

function ScoreGauge({ score, label, icon: Icon }: { score: number | null | undefined; label: string; icon: React.ElementType }) {
  const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
  
  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-600";
    if (s >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressColor = (s: number) => {
    if (s >= 80) return "bg-green-500";
    if (s >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={cn("text-sm font-bold", getScoreColor(safeScore))}>{safeScore}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-500", getProgressColor(safeScore))}
          style={{ width: `${safeScore}%` }}
        />
      </div>
    </div>
  );
}

function RecommendationItem({ text, index }: { text: string; index: number }) {
  const isCritical = text.startsWith("CRITICAL:");
  const isGood = text.includes("Good") || text.includes("Excellent") || text.includes("optimal");
  
  const Icon = isCritical ? AlertCircle : isGood ? CheckCircle : AlertTriangle;
  const iconColor = isCritical ? "text-red-500" : isGood ? "text-green-500" : "text-yellow-500";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconColor)} />
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </motion.div>
  );
}

export function AIAdvisor({ collapsed = false, onToggle }: AIAdvisorProps) {
  const { practiceId } = usePractice();
  const [question, setQuestion] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const { data: analysis, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ai-analysis", practiceId],
    queryFn: () => api.ai.analyzeLayout({ practiceId: practiceId!, operatingHours: 8 }),
    enabled: !!practiceId && !collapsed,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => api.ai.getRecommendation({ practiceId: practiceId!, question: q }),
  });

  const handleAsk = () => {
    if (question.trim()) {
      askMutation.mutate(question);
      setQuestion("");
    }
  };

  if (collapsed) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-200 hover:border-purple-300"
        data-testid="button-open-advisor"
      >
        <Sparkles className="h-4 w-4 text-purple-500" />
        AI Advisor
      </Button>
    );
  }

  return (
    <Card className="w-80 shadow-xl border-purple-200/50 bg-gradient-to-b from-white to-purple-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            AI Practice Advisor
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-analysis"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            {onToggle && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggle}
                data-testid="button-close-advisor"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Powered by real industry benchmarks from MGMA, ADA & AAOMS
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : analysis ? (
          <>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100">
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent" data-testid="text-overall-score">
                {typeof analysis.overallScore === 'number' && !isNaN(analysis.overallScore) ? analysis.overallScore : 0}%
              </div>
              <p className="text-sm text-muted-foreground mt-1">Overall Practice Score</p>
            </div>

            <div className="space-y-3">
              <ScoreGauge score={analysis.efficiencyScore} label="Layout Efficiency" icon={LayoutGrid} />
              <ScoreGauge score={analysis.staffingScore} label="Staffing Optimization" icon={Users} />
              <ScoreGauge score={analysis.spaceUtilizationScore} label="Space Utilization" icon={Target} />
            </div>

            <Separator />

            <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                <p className="text-sm text-purple-900 leading-relaxed" data-testid="text-ai-insights">
                  {analysis.aiInsights}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>Capacity Analysis</span>
                <span className="text-foreground">{analysis.capacityAnalysis.estimatedCapacity} patients/day</span>
              </div>
              <p className="text-xs text-muted-foreground">{analysis.capacityAnalysis.benchmarkComparison}</p>
            </div>

            <Button
              variant="ghost"
              className="w-full justify-between text-sm"
              onClick={() => setShowDetails(!showDetails)}
              data-testid="button-toggle-details"
            >
              <span>{analysis.recommendations.length} Recommendations</span>
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {analysis.recommendations.map((rec, i) => (
                      <RecommendationItem key={i} text={rec} index={i} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <span>Ask the Advisor</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., How can I reduce wait times?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                  className="text-sm"
                  data-testid="input-ask-advisor"
                />
                <Button
                  size="icon"
                  onClick={handleAsk}
                  disabled={!question.trim() || askMutation.isPending}
                  className="bg-purple-500 hover:bg-purple-600"
                  data-testid="button-ask-advisor"
                >
                  {askMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <AnimatePresence>
                {askMutation.data && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 rounded-lg bg-blue-50 border border-blue-100"
                  >
                    <p className="text-sm text-blue-900" data-testid="text-advisor-response">
                      {askMutation.data.recommendation}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Unable to load analysis.</p>
            <Button variant="link" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
