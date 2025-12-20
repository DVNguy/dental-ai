import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Star, Users, TrendingUp, AlertTriangle, CheckCircle, Lightbulb, Loader2, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api, type LayoutAnalysis } from "@/lib/api";
import { usePractice } from "@/contexts/PracticeContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Staff as StaffType } from "@shared/schema";
import { HRKpiDashboard } from "@/components/HRKpiDashboard";
import { AddStaffDialog } from "@/components/AddStaffDialog";
import { EditStaffDialog } from "@/components/EditStaffDialog";

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
  headcountActual,
  isFteValue,
  t
}: {
  role: string;
  actual: number;
  optimal: number;
  score: number;
  recommendation: string;
  headcountActual?: number;  // Show headcount as secondary info when FTE is primary
  isFteValue?: boolean;      // Indicates if actual is an FTE value
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
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {isOptimal ? (
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          ) : needsAttention ? (
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          ) : (
            <Lightbulb className="h-4 w-4 text-yellow-600 shrink-0" />
          )}
          <span className="font-semibold text-xs capitalize truncate">{role}</span>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "text-[9px] px-1.5 py-0.5 shrink-0 text-center leading-tight",
            isOptimal ? "bg-green-100 text-green-700" :
            needsAttention ? "bg-red-100 text-red-700" :
            "bg-yellow-100 text-yellow-700"
          )}
        >
          <span className="block font-bold">{score}%</span>
          <span className="block font-normal">{t("staff.match")}</span>
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="text-center p-2 rounded-lg bg-white/60">
          <div className="text-lg font-bold text-foreground">{actual.toFixed(2)}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {isFteValue ? t("staff.currentFte") : t("staff.current")}
          </div>
          {/* Show headcount as secondary info when FTE is displayed */}
          {isFteValue && headcountActual !== undefined && (
            <div className="text-[9px] text-muted-foreground mt-0.5">
              ({headcountActual.toFixed(1)} {t("staff.headcount")})
            </div>
          )}
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
      <CardContent className="py-6">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm text-muted-foreground">{t("staff.loadingInsights")}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function StaffingInsightsSection({ analysis, t }: { analysis: LayoutAnalysis | null; t: (key: string) => string }) {
  const staffingAnalysis = analysis?.staffingAnalysis || { overallScore: 0, ratios: {} };
  const staffingScore = analysis?.staffingScore ?? 50;
  const ratios = staffingAnalysis.ratios || {};
  const hasRooms = (analysis?.roomAnalyses?.length ?? 0) > 0;
  const hasRatioData = Object.keys(ratios).length > 0;

  // Default benchmarks when no data available
  const BENCHMARK_RATIOS: Array<{
    role: string;
    actual: number;
    optimal: number;
    score: number;
    recommendation: string;
    headcountActual?: number;
    isFteValue?: boolean;
  }> = [
    {
      role: t("benchmarks.clinicalAssistantRatio"),
      actual: 0,
      optimal: 1.5,
      score: 0,
      recommendation: t("benchmarks.nurseToDoctorDesc")
    },
    {
      role: t("benchmarks.frontdeskRatio"),
      actual: 0,
      optimal: 0.4,
      score: 0,
      recommendation: t("benchmarks.frontdeskRatioDesc")
    },
    {
      role: t("benchmarks.supportTotalRatio"),
      actual: 0,
      optimal: 2.0,
      score: 0,
      recommendation: t("benchmarks.supportStaffDesc")
    },
    {
      role: t("benchmarks.examRoomsPerProvider"),
      actual: 0,
      optimal: 3.0,
      score: 0,
      recommendation: t("benchmarks.examRoomsPerProviderDesc")
    }
  ];

  // Deprecated keys to hide (they are aliases, would cause duplicates)
  const deprecatedKeys = ["nurseRatio", "supportStaffRatio"];

  // Mapping from base ratio key to its FTE variant key
  const fteKeyMapping: Record<string, string> = {
    "clinicalAssistantRatio": "clinicalAssistantFteRatio",
    "frontdeskRatio": "frontdeskFteRatio",
    "supportTotalRatio": "supportTotalFteRatio"
  };

  // Preferred display order for ratio keys
  const ratioDisplayOrder = [
    "clinicalAssistantRatio",
    "frontdeskRatio",
    "supportTotalRatio",
    "examRoomRatio"
  ];

  // Map backend ratio keys to translated labels
  const getRatioLabel = (key: string, isFte: boolean): string => {
    // Use FTE label if available and isFte is true
    const labelKey = isFte ? `benchmarks.ratioLabels.${fteKeyMapping[key] || key}` : `benchmarks.ratioLabels.${key}`;
    const label = t(labelKey);
    // If translation exists, use it; otherwise fall back to base key
    if (!label.startsWith("benchmarks.ratioLabels.")) {
      return label;
    }
    // Fallback to base key label
    const baseLabel = t(`benchmarks.ratioLabels.${key}`);
    return baseLabel.startsWith("benchmarks.ratioLabels.") ? key : baseLabel;
  };

  // Build display ratios with FTE-first logic
  const displayRatios = hasRatioData
    ? ratioDisplayOrder
        .filter(key => ratios[key] !== undefined)
        .map(key => {
          const baseData = ratios[key];
          const fteKey = fteKeyMapping[key];
          const fteData = fteKey ? ratios[fteKey] : undefined;

          // Use FTE as primary value if available and > 0
          const useFte = fteData !== undefined && fteData.actual > 0;

          return {
            role: getRatioLabel(key, useFte),
            actual: useFte ? fteData.actual : baseData.actual,
            optimal: baseData.optimal,
            score: baseData.score,
            recommendation: useFte ? fteData.recommendation : baseData.recommendation,
            headcountActual: useFte ? baseData.actual : undefined,
            isFteValue: useFte
          };
        })
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
              headcountActual={data.headcountActual}
              isFteValue={data.isFteValue}
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

function ExperienceStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-4 w-4",
            star <= level ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function getRoleLabel(role: string, t: (key: string) => string): string {
  const roleMap: Record<string, string> = {
    doctor: t("roles.generalPractitioner"),
    dentist: t("roles.dentist"),
    nurse: t("roles.nurse"),
    receptionist: t("roles.receptionist"),
    assistant: t("roles.assistant"),
  };
  return roleMap[role] || role;
}

function StaffCard({
  member,
  t,
  onEdit
}: {
  member: StaffType;
  t: (key: string) => string;
  onEdit: (member: StaffType) => void;
}) {
  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all duration-300 border-t-4 border-t-transparent hover:border-t-primary group"
      data-testid={`staff-card-${member.id}`}
    >
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {member.avatar || getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle className="text-lg">{member.name}</CardTitle>
          <CardDescription>{getRoleLabel(member.role, t)}</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onEdit(member)}
          data-testid={`edit-staff-${member.id}`}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">{t("common.edit")}</span>
        </Button>
      </CardHeader>
      <CardContent>
        {/* HR Info */}
        <div className="flex flex-wrap gap-2 mb-3 text-xs text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="font-normal cursor-help">
                  {(t as (key: string, opts?: Record<string, unknown>) => string)("staff.fteLabel", { value: member.fte ?? 1.0 })}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("staff.fteTooltip")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge variant="outline" className="font-normal">
            {(t as (key: string, opts?: Record<string, unknown>) => string)("staff.hoursPerWeek", { value: member.weeklyHours ?? 40 })}
          </Badge>
          {member.contractType && (
            <Badge variant="outline" className="font-normal">
              {t(`staff.contractTypes.${member.contractType}`)}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {member.specializations.map(spec => (
            <Badge key={spec} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none font-normal">
              {spec}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("staff.experience")}</span>
          <ExperienceStars level={member.experienceLevel} />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyStaffState({ t }: { t: (key: string) => string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
      <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground mb-2">{t("staff.noStaff")}</h3>
      <p className="text-sm text-muted-foreground/70 max-w-md">
        {t("staff.addStaffHint")}
      </p>
    </div>
  );
}

export default function Staff() {
  const { t } = useTranslation();
  const { practiceId, practice } = usePractice();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffType | null>(null);

  const handleEditStaff = (member: StaffType) => {
    setSelectedStaff(member);
    setIsEditDialogOpen(true);
  };

  const { data: analysis, isLoading } = useQuery({
    queryKey: ["ai-analysis", practiceId],
    queryFn: () => api.ai.analyzeLayout({ practiceId: practiceId!, operatingHours: 8 }),
    enabled: !!practiceId,
    staleTime: 30000,
  });

  const staffMembers = practice?.staff || [];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary" data-testid="text-staff-title">{t("staff.title")}</h2>
          <p className="text-sm md:text-base text-muted-foreground">{t("staff.subtitle")}</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
          data-testid="button-add-staff"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> {t("staff.add")}
        </Button>
      </div>

      {/* HR KPI Dashboard - Shows FTE, Overtime, Absence, Labor Cost */}
      <div className="mb-8">
        <HRKpiDashboard />
      </div>

      {/* AI Staffing Insights - Shows role ratios and benchmarks */}
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
        {staffMembers.length > 0 ? (
          staffMembers.map((member) => (
            <StaffCard key={member.id} member={member} t={t} onEdit={handleEditStaff} />
          ))
        ) : (
          <EmptyStaffState t={t} />
        )}
      </div>

      <AddStaffDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <EditStaffDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        staff={selectedStaff}
      />
    </div>
  );
}
