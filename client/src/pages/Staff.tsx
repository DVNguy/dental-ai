import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Star, Zap, Users, TrendingUp, AlertTriangle, CheckCircle, Lightbulb, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api, type LayoutAnalysis, type StaffingAnalysis } from "@/lib/api";
import { usePractice } from "@/contexts/PracticeContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const STAFF_DATA = [
  { 
    id: 1, 
    name: "Dr. Sarah Weber", 
    roleKey: "roles.generalPractitioner", 
    stress: 25, 
    efficiency: 95, 
    avatar: "SW",
    traitKeys: ["traits.empathetic", "traits.fast"]
  },
  { 
    id: 2, 
    name: "Dr. James Chen", 
    roleKey: "roles.specialist", 
    stress: 65, 
    efficiency: 88, 
    avatar: "JC",
    traitKeys: ["traits.detailOriented"]
  },
  { 
    id: 3, 
    name: "Maria Rodriguez", 
    roleKey: "roles.nurse", 
    stress: 40, 
    efficiency: 92, 
    avatar: "MR",
    traitKeys: ["traits.multitasker", "traits.friendly"]
  },
  { 
    id: 4, 
    name: "David Kim", 
    roleKey: "roles.receptionist", 
    stress: 80, 
    efficiency: 75, 
    avatar: "DK",
    traitKeys: ["traits.organized"]
  },
];

function StaffingScoreRing({ score, size = 80 }: { score: number; size?: number }) {
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
      <div className={cn("text-xl font-bold", colors.text)}>{safeScore}</div>
    </div>
  );
}

function RatioCard({ 
  role, 
  actual, 
  optimal, 
  score, 
  recommendation,
  t 
}: { 
  role: string; 
  actual: number; 
  optimal: number; 
  score: number; 
  recommendation: string;
  t: (key: string) => string;
}) {
  const isOptimal = score >= 80;
  const needsAttention = score < 60;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl border transition-all",
        isOptimal ? "bg-green-50/50 border-green-200" :
        needsAttention ? "bg-red-50/50 border-red-200" :
        "bg-yellow-50/50 border-yellow-200"
      )}
      data-testid={`ratio-card-${role.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isOptimal ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : needsAttention ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : (
            <Lightbulb className="h-4 w-4 text-yellow-600" />
          )}
          <span className="font-semibold text-sm capitalize">{role}</span>
        </div>
        <Badge 
          variant="secondary" 
          className={cn(
            "text-xs",
            isOptimal ? "bg-green-100 text-green-700" :
            needsAttention ? "bg-red-100 text-red-700" :
            "bg-yellow-100 text-yellow-700"
          )}
        >
          {score}% {t("staff.match")}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="text-center p-2 rounded-lg bg-white/60">
          <div className="text-lg font-bold text-foreground">{actual}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("staff.current")}</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/60">
          <div className="text-lg font-bold text-primary">{optimal}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("staff.optimal")}</div>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground leading-relaxed">{recommendation}</p>
    </motion.div>
  );
}

function StaffingInsightsSkeleton({ t }: { t: (key: string) => string }) {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-xl border bg-white/50">
              <Skeleton className="h-5 w-32 mb-3" />
              <div className="grid grid-cols-2 gap-4 mb-3">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StaffingInsightsSection({ analysis, t }: { analysis: LayoutAnalysis | null; t: (key: string) => string }) {
  const staffingAnalysis = analysis?.staffingAnalysis || { overallScore: 0, ratios: {} };
  const staffingScore = analysis?.staffingScore ?? 50;
  const ratioEntries = Object.entries(staffingAnalysis.ratios || {});
  const hasRooms = (analysis?.roomAnalyses?.length ?? 0) > 0;
  const hasRatioData = ratioEntries.length > 0;
  
  const BENCHMARK_RATIOS = [
    {
      role: t("benchmarks.supportStaffRatio"),
      actual: 0,
      optimal: 2.0,
      score: 0,
      recommendation: t("benchmarks.supportStaffDesc")
    },
    {
      role: t("benchmarks.nurseToDoctor"),
      actual: 0,
      optimal: 1.5,
      score: 0,
      recommendation: t("benchmarks.nurseToDoctorDesc")
    },
    {
      role: t("benchmarks.examRoomsPerProvider"),
      actual: 0,
      optimal: 2.5,
      score: 0,
      recommendation: t("benchmarks.examRoomsPerProviderDesc")
    }
  ];
  
  const displayRatios = hasRatioData 
    ? ratioEntries.map(([role, data]) => ({ role, ...data }))
    : BENCHMARK_RATIOS;
  
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 overflow-hidden" data-testid="staffing-insights-card">
      <CardHeader className="border-b border-blue-100/50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("staff.aiRecommendations")}</CardTitle>
              <CardDescription className="text-blue-100">
                {t("staff.optimalRatios")}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
            <StaffingScoreRing score={staffingScore} size={60} />
            <div className="text-right">
              <div className="text-xs text-blue-100">{t("staff.staffingOptimization")}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {!hasRatioData && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-blue-50/80 border border-blue-200 flex items-start gap-3"
          >
            <Lightbulb className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 mb-1">{t("staff.industryBenchmarks")}</p>
              <p className="text-xs text-blue-700">
                {!hasRooms 
                  ? t("staff.addRoomsHint")
                  : t("staff.addStaffHint")
                }
              </p>
            </div>
          </motion.div>
        )}
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayRatios.map((data) => (
            <RatioCard
              key={data.role}
              role={data.role}
              actual={data.actual}
              optimal={data.optimal}
              score={data.score}
              recommendation={data.recommendation}
              t={t}
            />
          ))}
        </div>
        
        {hasRatioData && staffingScore < 70 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3"
            data-testid="staffing-alert"
          >
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 mb-1">{t("staff.optimizationNeeded")}</p>
              <p className="text-xs text-amber-700">
                {t("staff.optimizationNeededDesc")}
              </p>
            </div>
          </motion.div>
        )}
        
        {hasRatioData && staffingScore >= 80 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 rounded-xl bg-green-50 border border-green-200 flex items-start gap-3"
            data-testid="staffing-success"
          >
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800 mb-1">{t("staff.excellentBalance")}</p>
              <p className="text-xs text-green-700">
                {t("staff.excellentBalanceDesc")}
              </p>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Staff() {
  const { t } = useTranslation();
  const { practiceId } = usePractice();

  const { data: analysis, isLoading } = useQuery({
    queryKey: ["ai-analysis", practiceId],
    queryFn: () => api.ai.analyzeLayout({ practiceId: practiceId!, operatingHours: 8 }),
    enabled: !!practiceId,
    staleTime: 30000,
  });

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary" data-testid="text-staff-title">{t("staff.title")}</h2>
          <p className="text-muted-foreground">{t("staff.subtitle")}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-staff">
          <Plus className="mr-2 h-4 w-4" /> {t("staff.add")}
        </Button>
      </div>

      <div className="mb-8">
        {isLoading ? (
          <StaffingInsightsSkeleton t={t} />
        ) : (
          <StaffingInsightsSection analysis={analysis ?? null} t={t} />
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {t("staff.currentTeam")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("staff.manageStaff")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {STAFF_DATA.map((member) => (
          <Card 
            key={member.id} 
            className="overflow-hidden hover:shadow-lg transition-all duration-300 border-t-4 border-t-transparent hover:border-t-primary"
            data-testid={`staff-card-${member.id}`}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                <AvatarFallback className="bg-primary/10 text-primary font-bold">{member.avatar}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-lg">{member.name}</CardTitle>
                <CardDescription>{t(member.roleKey)}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-6">
                {member.traitKeys.map(traitKey => (
                  <Badge key={traitKey} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none font-normal">
                    {t(traitKey)}
                  </Badge>
                ))}
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Zap className="w-3 h-3" /> {t("staff.efficiency")}
                    </span>
                    <span className="font-medium">{member.efficiency}%</span>
                  </div>
                  <Progress value={member.efficiency} className="h-2 bg-slate-100" indicatorClassName="bg-primary" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Star className="w-3 h-3" /> {t("staff.stress")}
                    </span>
                    <span className={member.stress > 70 ? "text-destructive font-bold" : "font-medium"}>
                      {member.stress}%
                    </span>
                  </div>
                  <Progress 
                    value={member.stress} 
                    className="h-2 bg-slate-100" 
                    indicatorClassName={member.stress > 70 ? "bg-destructive" : "bg-secondary"} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
