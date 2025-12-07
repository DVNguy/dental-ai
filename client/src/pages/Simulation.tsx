import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  PlayCircle, 
  RotateCcw, 
  TrendingUp, 
  Clock, 
  Users, 
  Activity,
  Loader2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Target,
  Heart,
  Zap,
  Lightbulb,
  BarChart3
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type LayoutAnalysis } from "@/lib/api";
import { usePractice } from "@/contexts/PracticeContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface SimulationResult {
  efficiencyScore: number;
  harmonyScore: number;
  waitTime: number;
  patientCapacity: number;
}

function ScoreRing({ score, label, size = 100 }: { score: number; label: string; size?: number }) {
  const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (safeScore / 100) * circumference;
  
  const getColor = (s: number) => {
    if (s >= 80) return { stroke: "#22c55e", text: "text-green-600" };
    if (s >= 60) return { stroke: "#eab308", text: "text-yellow-600" };
    return { stroke: "#ef4444", text: "text-red-600" };
  };
  
  const colors = getColor(safeScore);
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
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
          <motion.div 
            className={cn("text-2xl font-bold", colors.text)}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {safeScore.toFixed(1)}
          </motion.div>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  unit, 
  color,
  benchmark,
  status
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  unit?: string;
  color: string;
  benchmark?: string;
  status?: "good" | "warning" | "poor";
}) {
  const statusColors = {
    good: "border-green-200 bg-green-50",
    warning: "border-yellow-200 bg-yellow-50",
    poor: "border-red-200 bg-red-50"
  };

  const statusIcons = {
    good: CheckCircle,
    warning: AlertTriangle,
    poor: AlertCircle
  };

  const StatusIcon = status ? statusIcons[status] : null;

  return (
    <motion.div 
      className={cn(
        "p-4 rounded-xl border transition-all",
        status ? statusColors[status] : "bg-white border-slate-200"
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      data-testid={`metric-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        {StatusIcon && (
          <StatusIcon className={cn(
            "h-4 w-4",
            status === "good" && "text-green-600",
            status === "warning" && "text-yellow-600",
            status === "poor" && "text-red-600"
          )} />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold">
          {value}
          {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {benchmark && (
          <p className="text-[10px] text-slate-500 mt-1">{benchmark}</p>
        )}
      </div>
    </motion.div>
  );
}

function InsightCard({ 
  icon: Icon, 
  title, 
  description, 
  priority 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
  priority: "high" | "medium" | "low";
}) {
  const colors = {
    high: "border-red-200 bg-red-50 text-red-800",
    medium: "border-yellow-200 bg-yellow-50 text-yellow-800",
    low: "border-green-200 bg-green-50 text-green-800"
  };

  return (
    <motion.div 
      className={cn("p-3 rounded-lg border", colors[priority])}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      data-testid={`insight-card-${priority}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold">{title}</p>
          <p className="text-xs mt-0.5 opacity-80">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function Simulation() {
  const { t } = useTranslation();
  const { practiceId, practice } = usePractice();
  const queryClient = useQueryClient();
  const [patientVolume, setPatientVolume] = useState([50]);
  const [operatingHours, setOperatingHours] = useState([8]);
  const [randomEvents, setRandomEvents] = useState(true);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  const { data: analysis, isLoading: isAnalysisLoading } = useQuery({
    queryKey: ["ai-analysis", practiceId],
    queryFn: () => api.ai.analyzeLayout({ practiceId: practiceId!, operatingHours: operatingHours[0] }),
    enabled: !!practiceId,
    staleTime: 30000,
  });

  const runSimulationMutation = useMutation({
    mutationFn: (params: { patientVolume: number; operatingHours: number }) => api.simulations.run({
      practiceId: practiceId!,
      patientVolume: params.patientVolume,
      operatingHours: params.operatingHours
    }),
    onSuccess: (result) => {
      setSimulationResult(result);
      queryClient.invalidateQueries({ queryKey: ["ai-analysis", practiceId] });
    }
  });

  const handleRunSimulation = () => {
    if (practiceId) {
      runSimulationMutation.mutate({
        patientVolume: patientVolume[0],
        operatingHours: operatingHours[0]
      });
    }
  };

  const handleReset = () => {
    setSimulationResult(null);
    setPatientVolume([50]);
    setOperatingHours([8]);
  };

  const getWaitTimeStatus = (waitTime: number): "good" | "warning" | "poor" => {
    if (waitTime <= 15) return "good";
    if (waitTime <= 30) return "warning";
    return "poor";
  };

  const getScoreStatus = (score: number): "good" | "warning" | "poor" => {
    if (score >= 80) return "good";
    if (score >= 60) return "warning";
    return "poor";
  };

  const generateInsights = (result: SimulationResult, analysis?: LayoutAnalysis): Array<{
    icon: React.ElementType;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }> => {
    const insights: Array<{
      icon: React.ElementType;
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
    }> = [];

    if (result.waitTime > 30) {
      insights.push({
        icon: Clock,
        title: t("sim.highWaitTimes"),
        description: t("sim.highWaitTimesDesc", { time: result.waitTime }),
        priority: "high"
      });
    } else if (result.waitTime > 15) {
      insights.push({
        icon: Clock,
        title: t("sim.waitAboveTarget"),
        description: t("sim.waitAboveTargetDesc", { time: result.waitTime }),
        priority: "medium"
      });
    }

    if (result.efficiencyScore < 60) {
      insights.push({
        icon: Activity,
        title: t("sim.layoutEfficiencyIssue"),
        description: t("sim.layoutEfficiencyIssueDesc"),
        priority: "high"
      });
    }

    if (result.harmonyScore < 70) {
      insights.push({
        icon: Heart,
        title: t("sim.staffBalanceAlert"),
        description: t("sim.staffBalanceAlertDesc"),
        priority: result.harmonyScore < 60 ? "high" : "medium"
      });
    }

    const capacityUtilization = (patientVolume[0] / Math.max(1, result.patientCapacity)) * 100;
    if (capacityUtilization > 90) {
      insights.push({
        icon: Users,
        title: t("sim.nearCapacity"),
        description: t("sim.nearCapacityDesc"),
        priority: "high"
      });
    } else if (capacityUtilization < 50) {
      insights.push({
        icon: Target,
        title: t("sim.underutilized"),
        description: t("sim.underutilizedDesc", { percent: capacityUtilization.toFixed(0) }),
        priority: "low"
      });
    }

    if (analysis?.recommendations && analysis.recommendations.length > 0 && insights.length < 4) {
      insights.push({
        icon: Lightbulb,
        title: t("sim.aiRecommendation"),
        description: analysis.recommendations[0],
        priority: "medium"
      });
    }

    return insights.slice(0, 4);
  };

  const roomCount = practice?.rooms?.length ?? 0;
  const staffCount = practice?.staff?.length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary" data-testid="text-simulation-title">
            {t("sim.title")}
          </h2>
          <p className="text-muted-foreground">{t("sim.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs" data-testid="badge-room-count">
            {roomCount} {roomCount === 1 ? t("rooms.room") : t("rooms.rooms")}
          </Badge>
          <Badge variant="outline" className="text-xs" data-testid="badge-staff-count">
            {staffCount} {t("common.staff")}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t("sim.results")}
            </CardTitle>
            <CardDescription>
              {t("sim.resultsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {runSimulationMutation.isPending ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary relative" />
                  </div>
                  <p className="mt-4 text-muted-foreground font-medium">{t("sim.running")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("sim.analyzing", { patients: patientVolume[0], hours: operatingHours[0] })}</p>
                </motion.div>
              ) : simulationResult ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex justify-center gap-8 py-4">
                    <ScoreRing score={simulationResult.efficiencyScore} label={t("sim.efficiency")} />
                    <ScoreRing score={simulationResult.harmonyScore} label={t("sim.harmony")} />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard
                      icon={Clock}
                      label={t("sim.avgWaitTime")}
                      value={simulationResult.waitTime}
                      unit={t("common.min")}
                      color="bg-blue-500"
                      status={getWaitTimeStatus(simulationResult.waitTime)}
                      benchmark={t("sim.industryTarget")}
                    />
                    <MetricCard
                      icon={Users}
                      label={t("sim.patientCapacity")}
                      value={simulationResult.patientCapacity}
                      unit={t("common.perDay")}
                      color="bg-emerald-500"
                      status={simulationResult.patientCapacity >= patientVolume[0] ? "good" : "warning"}
                      benchmark={t("sim.simulated", { count: patientVolume[0] })}
                    />
                    <MetricCard
                      icon={Activity}
                      label={t("sim.layoutScore")}
                      value={simulationResult.efficiencyScore.toFixed(1)}
                      unit="%"
                      color="bg-purple-500"
                      status={getScoreStatus(simulationResult.efficiencyScore)}
                    />
                    <MetricCard
                      icon={Heart}
                      label={t("sim.staffHarmony")}
                      value={simulationResult.harmonyScore.toFixed(1)}
                      unit="%"
                      color="bg-pink-500"
                      status={getScoreStatus(simulationResult.harmonyScore)}
                    />
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-semibold">{t("sim.aiInsights")}</span>
                    </div>
                    <div className="space-y-2">
                      {generateInsights(simulationResult, analysis).map((insight, i) => (
                        <InsightCard key={i} {...insight} />
                      ))}
                    </div>
                    {analysis?.aiInsights && (
                      <div className="mt-4 p-3 rounded-lg bg-purple-50 border border-purple-100">
                        <div className="flex items-start gap-2">
                          <Zap className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-purple-800 leading-relaxed" data-testid="text-simulation-ai-insights">
                            {analysis.aiInsights}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center mb-4 bg-primary/5">
                    <PlayCircle className="w-10 h-10 text-primary/60" />
                  </div>
                  <p className="text-muted-foreground font-medium">{t("sim.readyToSimulate")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("sim.configureParams")}
                  </p>
                  {roomCount === 0 && (
                    <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {t("sim.addRoomsHint")}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t("sim.params")}</CardTitle>
              <CardDescription className="text-xs">{t("sim.paramsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{t("sim.patientVolume")}</span>
                  <span className="text-muted-foreground font-mono">{patientVolume[0]}</span>
                </div>
                <Slider 
                  value={patientVolume} 
                  onValueChange={setPatientVolume} 
                  max={200} 
                  min={10}
                  step={5}
                  className="py-2"
                  data-testid="slider-patient-volume"
                />
                <p className="text-[10px] text-muted-foreground">{t("sim.typical")}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{t("sim.operatingHours")}</span>
                  <span className="text-muted-foreground font-mono">{operatingHours[0]}h</span>
                </div>
                <Slider 
                  value={operatingHours} 
                  onValueChange={setOperatingHours} 
                  max={12} 
                  min={4}
                  step={1}
                  className="py-2"
                  data-testid="slider-operating-hours"
                />
                <p className="text-[10px] text-muted-foreground">{t("sim.standard")}</p>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm font-medium">{t("sim.randomEvents")}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t("sim.randomEventsDesc")}</p>
                  </div>
                  <Switch 
                    checked={randomEvents} 
                    onCheckedChange={setRandomEvents}
                    data-testid="switch-random-events"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  className="flex-1"
                  onClick={handleRunSimulation}
                  disabled={runSimulationMutation.isPending || !practiceId}
                  data-testid="button-run-simulation"
                >
                  {runSimulationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  {t("sim.runSimulation")}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleReset}
                  disabled={runSimulationMutation.isPending}
                  data-testid="button-reset-simulation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-blue-900 text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t("sim.activeScenario")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-800 font-medium mb-2">
                "{patientVolume[0]} {t("sim.patientVolume")} / {operatingHours[0]}h"
              </p>
              <p className="text-xs text-blue-600">
                {t("sim.testingEfficiency", { patients: patientVolume[0], hours: operatingHours[0] })}
              </p>
              {analysis && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-700">{t("sim.currentPracticeScore")}</span>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "font-bold",
                        (analysis.overallScore ?? 0) >= 80 ? "bg-green-100 text-green-700" :
                        (analysis.overallScore ?? 0) >= 60 ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      )}
                      data-testid="badge-practice-score"
                    >
                      {analysis.overallScore ?? 0}/100
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
