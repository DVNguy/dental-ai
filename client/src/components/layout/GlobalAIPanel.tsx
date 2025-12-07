import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type LayoutAnalysis } from "@/lib/api";
import { usePractice } from "@/contexts/PracticeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  RefreshCw,
  Brain,
  Lightbulb,
  Activity,
  Zap,
  ArrowRight,
  PenTool,
  PlayCircle,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (safeScore / 100) * circumference;
  
  const getColor = (s: number) => {
    if (s >= 80) return { stroke: "#22c55e", bg: "from-green-500/20 to-green-500/5" };
    if (s >= 60) return { stroke: "#eab308", bg: "from-yellow-500/20 to-yellow-500/5" };
    return { stroke: "#ef4444", bg: "from-red-500/20 to-red-500/5" };
  };
  
  const colors = getColor(safeScore);
  
  return (
    <div className={cn("relative flex items-center justify-center rounded-full bg-gradient-to-b", colors.bg)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="text-center z-10">
        <div className="text-3xl font-bold" style={{ color: colors.stroke }}>{safeScore}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Score</div>
      </div>
    </div>
  );
}

function MetricBar({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  const safeValue = typeof value === 'number' && !isNaN(value) ? Math.max(0, Math.min(100, value)) : 0;
  
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className={cn("p-1 rounded", color)}>
            <Icon className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
        </div>
        <span className="text-xs font-bold">{safeValue}%</span>
      </div>
      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <motion.div 
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${safeValue}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, href, active }: { icon: React.ElementType; label: string; href: string; active?: boolean }) {
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-xs font-medium",
        active 
          ? "bg-primary/10 text-primary border border-primary/20" 
          : "hover:bg-muted text-muted-foreground hover:text-foreground"
      )}>
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
    </Link>
  );
}

function RecommendationPill({ text, priority }: { text: string; priority: "high" | "medium" | "low" }) {
  const colors = {
    high: "bg-red-50 border-red-200 text-red-700",
    medium: "bg-yellow-50 border-yellow-200 text-yellow-700",
    low: "bg-green-50 border-green-200 text-green-700"
  };
  
  const icons = {
    high: AlertCircle,
    medium: AlertTriangle,
    low: Lightbulb
  };
  
  const Icon = icons[priority];
  
  return (
    <div className={cn("flex items-start gap-2 p-2.5 rounded-lg border text-xs", colors[priority])}>
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span className="leading-relaxed">{text}</span>
    </div>
  );
}

export function GlobalAIPanel() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { practiceId } = usePractice();
  const [question, setQuestion] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  const { data: analysis, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ai-analysis", practiceId],
    queryFn: () => api.ai.analyzeLayout({ practiceId: practiceId!, operatingHours: 8 }),
    enabled: !!practiceId,
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

  const getContextualTitle = () => {
    switch (location) {
      case "/": return "Practice Overview";
      case "/editor": return "Layout Analysis";
      case "/staff": return "Staffing Insights";
      case "/simulation": return "Simulation Analysis";
      default: return "AI Insights";
    }
  };

  const getContextualTip = () => {
    switch (location) {
      case "/": 
        return "Your dashboard shows key metrics. Check the scores below to identify areas for improvement.";
      case "/editor": 
        return "I'm watching your layout changes. Position rooms strategically for optimal patient flow.";
      case "/staff": 
        return "Staff balance is key. I'll help you optimize schedules and assignments.";
      case "/simulation": 
        return "Run simulations to test different scenarios. I'll analyze the results.";
      default: 
        return "I'm here to help optimize your practice.";
    }
  };

  const getPriorityRecommendations = () => {
    if (!analysis?.recommendations) return [];
    return analysis.recommendations.slice(0, 3).map((rec, i) => ({
      text: rec,
      priority: i === 0 ? "high" as const : i === 1 ? "medium" as const : "low" as const
    }));
  };

  if (!isExpanded) {
    return (
      <div className="w-12 border-l bg-gradient-to-b from-purple-50/50 to-blue-50/50 flex flex-col items-center py-4 gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(true)}
          className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 text-white hover:opacity-90"
          data-testid="button-expand-ai"
        >
          <Brain className="h-5 w-5" />
        </Button>
        {analysis && (
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              "text-lg font-bold",
              (analysis.overallScore ?? 0) >= 80 ? "text-green-600" : 
              (analysis.overallScore ?? 0) >= 60 ? "text-yellow-600" : "text-red-600"
            )}>
              {analysis.overallScore ?? 0}
            </div>
            <Activity className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-80 border-l bg-gradient-to-b from-slate-50 to-white flex flex-col shadow-xl">
      <div className="p-4 border-b bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">{getContextualTitle()}</h3>
              <p className="text-[10px] text-white/70">Powered by AI</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-ai"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => setIsExpanded(false)}
              data-testid="button-collapse-ai"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100">
            <Sparkles className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">{getContextualTip()}</p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
                <Loader2 className="h-8 w-8 animate-spin text-purple-500 relative" />
              </div>
              <p className="text-xs text-muted-foreground">Analyzing your practice...</p>
            </div>
          ) : analysis ? (
            <>
              <div className="flex justify-center py-2">
                <ScoreRing score={analysis.overallScore ?? 0} />
              </div>

              <div className="space-y-3">
                <MetricBar 
                  label="Layout Efficiency" 
                  value={analysis.efficiencyScore ?? 0} 
                  icon={LayoutGrid} 
                  color="bg-purple-500" 
                />
                <MetricBar 
                  label="Staffing Optimization" 
                  value={analysis.staffingScore ?? 0} 
                  icon={Users} 
                  color="bg-blue-500" 
                />
                <MetricBar 
                  label="Space Utilization" 
                  value={analysis.spaceUtilizationScore ?? 0} 
                  icon={Target} 
                  color="bg-emerald-500" 
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Daily Capacity</span>
                  <span className="text-lg font-bold text-foreground">{analysis.capacityAnalysis.estimatedCapacity}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{analysis.capacityAnalysis.benchmarkComparison}</p>
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-semibold">Priority Actions</span>
                </div>
                <div className="space-y-2">
                  {getPriorityRecommendations().map((rec, i) => (
                    <RecommendationPill key={i} text={rec.text} priority={rec.priority} />
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">Quick Actions</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <QuickAction icon={LayoutDashboard} label="Dashboard" href="/" active={location === "/"} />
                  <QuickAction icon={PenTool} label="Layout" href="/editor" active={location === "/editor"} />
                  <QuickAction icon={Users} label="Staff" href="/staff" active={location === "/staff"} />
                  <QuickAction icon={PlayCircle} label="Simulate" href="/simulation" active={location === "/simulation"} />
                </div>
              </div>

              <Separator />

              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                <p className="text-xs text-purple-800 leading-relaxed" data-testid="text-ai-insights">
                  {analysis.aiInsights}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Unable to load analysis</p>
              <Button variant="link" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-white">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-purple-500" />
          <span className="text-xs font-semibold">Ask AI</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="How can I improve?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            className="text-xs h-9"
            data-testid="input-global-ask"
          />
          <Button
            size="icon"
            className="h-9 w-9 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90"
            onClick={handleAsk}
            disabled={!question.trim() || askMutation.isPending}
            data-testid="button-global-ask"
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100"
            >
              <p className="text-xs text-blue-800 leading-relaxed" data-testid="text-global-response">
                {askMutation.data.recommendation}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
