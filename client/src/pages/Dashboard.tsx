import { StatsCards } from "@/components/dashboard/StatsCards";
import { EfficiencyChart } from "@/components/dashboard/EfficiencyChart";
import medicalHero from "@assets/generated_images/isometric_medical_practice_floor_plan_vector_art.png";
import { Button } from "@/components/ui/button";
import { Play, Brain, LayoutGrid, Users, Target, AlertCircle, AlertTriangle, Lightbulb, TrendingUp, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePractice } from "@/contexts/PracticeContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function AIHealthScore({ score, isLoading, t }: { score: number; isLoading: boolean; t: (key: string) => string }) {
  const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
  const strokeWidth = 10;
  const size = 140;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (safeScore / 100) * circumference;
  
  const getColor = (s: number) => {
    if (s >= 80) return { stroke: "#22c55e", text: "text-green-600", bg: "from-green-500/20 to-green-500/5", badge: "bg-green-100", label: t("dashboard.excellent") };
    if (s >= 60) return { stroke: "#eab308", text: "text-yellow-600", bg: "from-yellow-500/20 to-yellow-500/5", badge: "bg-yellow-100", label: t("dashboard.good") };
    return { stroke: "#ef4444", text: "text-red-600", bg: "from-red-500/20 to-red-500/5", badge: "bg-red-100", label: t("dashboard.needsWork") };
  };
  
  const colors = getColor(safeScore);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
        <p className="mt-3 text-sm text-muted-foreground">{t("dashboard.analyzing")}</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center">
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
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="text-center z-10">
          <motion.div 
            className={cn("text-4xl font-bold", colors.text)}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            {safeScore}
          </motion.div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t("dashboard.healthScore")}</div>
        </div>
      </div>
      <motion.div 
        className={cn("mt-3 px-3 py-1 rounded-full text-xs font-semibold", colors.text, colors.badge)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {colors.label}
      </motion.div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, trend }: { label: string; value: number; icon: React.ElementType; color: string; trend?: string }) {
  const safeValue = typeof value === 'number' && !isNaN(value) ? Math.max(0, Math.min(100, value)) : 0;
  
  return (
    <motion.div 
      className="p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-shadow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-bold">{safeValue}%</div>
        {trend && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </div>
        )}
      </div>
      <div className="mt-2 h-2 bg-muted/50 rounded-full overflow-hidden">
        <motion.div 
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${safeValue}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        />
      </div>
    </motion.div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-card border shadow-sm animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-muted h-8 w-8" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
      <div className="h-8 w-16 bg-muted rounded mb-2" />
      <div className="h-2 bg-muted rounded-full" />
    </div>
  );
}

function PriorityAlert({ text, priority, index }: { text: string; priority: "high" | "medium" | "low"; index: number }) {
  const configs = {
    high: { 
      bg: "bg-red-50 border-red-200 hover:bg-red-100", 
      text: "text-red-700",
      icon: AlertCircle,
      badge: "bg-red-100 text-red-700"
    },
    medium: { 
      bg: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100", 
      text: "text-yellow-700",
      icon: AlertTriangle,
      badge: "bg-yellow-100 text-yellow-700"
    },
    low: { 
      bg: "bg-green-50 border-green-200 hover:bg-green-100", 
      text: "text-green-700",
      icon: Lightbulb,
      badge: "bg-green-100 text-green-700"
    }
  };
  
  const config = configs[priority];
  const Icon = config.icon;
  
  return (
    <motion.div 
      className={cn("flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer", config.bg)}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      data-testid={`alert-priority-${index}`}
    >
      <div className={cn("p-1.5 rounded-lg shrink-0", config.badge)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className={cn("text-sm leading-relaxed", config.text)}>{text}</p>
      </div>
      <ArrowRight className={cn("h-4 w-4 shrink-0 mt-1", config.text)} />
    </motion.div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { practiceId } = usePractice();

  const { data: analysis, isLoading } = useQuery({
    queryKey: ["ai-analysis", practiceId],
    queryFn: () => api.ai.analyzeLayout({ practiceId: practiceId!, operatingHours: 8 }),
    enabled: !!practiceId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const getPriorityRecommendations = () => {
    if (!analysis?.recommendations) return [];
    return analysis.recommendations.slice(0, 3).map((rec, i) => {
      const cleanText = rec.split('[')[0].trim();
      const truncated = cleanText.length > 150 ? cleanText.slice(0, 150) + '...' : cleanText;
      return {
        text: truncated,
        priority: i === 0 ? "high" as const : i === 1 ? "medium" as const : "low" as const
      };
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary" data-testid="text-dashboard-title">{t("dashboard.title")}</h2>
          <p className="text-sm md:text-base text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Link href="/simulation">
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 w-full sm:w-auto" data-testid="button-run-simulation">
              <Play className="mr-2 h-4 w-4" /> {t("dashboard.runSim")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <motion.div 
            className="lg:col-span-1 rounded-2xl border bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("dashboard.aiPracticeHealth")}</h3>
                <p className="text-xs text-muted-foreground">{t("dashboard.poweredByAI")}</p>
              </div>
            </div>
            
            <AIHealthScore score={analysis?.overallScore ?? 0} isLoading={isLoading} t={t} />
            
            {analysis && (
              <motion.div 
                className="mt-6 p-4 rounded-xl bg-white/60 border"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground">{t("dashboard.estDailyCapacity")}</span>
                  <span className="text-xl font-bold text-foreground" data-testid="text-daily-capacity">{analysis.capacityAnalysis.estimatedCapacity}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{analysis.capacityAnalysis.benchmarkComparison}</p>
              </motion.div>
            )}
          </motion.div>

          <div className="lg:col-span-2 grid gap-4 sm:grid-cols-3">
            {isLoading ? (
              <>
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </>
            ) : (
              <>
                <MetricCard 
                  label={t("dashboard.layoutEfficiency")} 
                  value={analysis?.efficiencyScore ?? 0} 
                  icon={LayoutGrid} 
                  color="bg-purple-500"
                />
                <MetricCard 
                  label={t("dashboard.staffOptimization")} 
                  value={analysis?.staffingScore ?? 0} 
                  icon={Users} 
                  color="bg-blue-500"
                />
                <MetricCard 
                  label={t("dashboard.spaceUtilization")} 
                  value={analysis?.spaceUtilizationScore ?? 0} 
                  icon={Target} 
                  color="bg-emerald-500"
                />
              </>
            )}
          </div>
        </div>

        {analysis && getPriorityRecommendations().length > 0 && (
          <motion.div 
            className="rounded-2xl border bg-card p-6 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Zap className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{t("dashboard.priorityActions")}</h3>
                  <p className="text-xs text-muted-foreground">{t("dashboard.aiRecommendedImprovements")}</p>
                </div>
              </div>
              <Link href="/editor">
                <Button variant="outline" size="sm" className="text-xs" data-testid="button-view-layout">
                  {t("dashboard.openLayoutEditor")}
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {getPriorityRecommendations().map((rec, i) => (
                <PriorityAlert key={i} text={rec.text} priority={rec.priority} index={i} />
              ))}
            </div>
          </motion.div>
        )}

        <StatsCards />
        
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
          <EfficiencyChart />
          
          <div className="lg:col-span-3 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 flex flex-col space-y-1.5">
              <h3 className="font-semibold leading-none tracking-tight">{t("dashboard.liveView")}</h3>
              <p className="text-sm text-muted-foreground">{t("dashboard.liveViewDesc")}</p>
            </div>
            <div className="flex-1 relative bg-muted/20 min-h-[200px]">
              <img 
                src={medicalHero} 
                alt={t("images.simulationView")} 
                className="absolute inset-0 h-full w-full object-cover opacity-90 hover:opacity-100 transition-opacity duration-500"
              />
              <div className="absolute inset-0 bg-linear-to-t from-background/50 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>

        {analysis?.aiInsights && (
          <motion.div 
            className="rounded-2xl border bg-gradient-to-r from-purple-50 to-blue-50 p-6 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 shrink-0">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">{t("dashboard.aiInsights")}</h3>
                <p className="text-sm text-slate-600 leading-relaxed" data-testid="text-dashboard-ai-insights">
                  {analysis.aiInsights}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
