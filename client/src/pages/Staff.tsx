import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Star, Users, TrendingUp, AlertTriangle, CheckCircle, Lightbulb, Loader2, Pencil, RefreshCw, Bug } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type LayoutAnalysis, type StaffingDebugInfo } from "@/lib/api";
import { usePractice } from "@/contexts/PracticeContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Staff as StaffType } from "@shared/schema";
import { HRKpiDashboard } from "@/components/HRKpiDashboard";
import { AddStaffDialog } from "@/components/AddStaffDialog";
import { EditStaffDialog } from "@/components/EditStaffDialog";

// Staffing ratio benchmarks (mirrored from server/ai/benchmarks.ts for client-side defaults)
const STAFFING_RATIOS = {
  nursePerDoctor: { optimal: 1.5 },
  receptionistPerProvider: { optimal: 0.4 },
  supportStaffPerDentist: { optimal: 2.0 },
  examRoomsPerProvider: { optimal: 3.0 }
} as const;

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

// Mapping from ratio key to unit translation keys (using new i18n keys)
const RATIO_UNIT_MAPPING: Record<string, { unit: string; unitFte: string }> = {
  clinicalAssistantRatio: { unit: "staff.ratioLegend.units.clinicalAssistant", unitFte: "staff.ratioLegend.units.clinicalAssistantFte" },
  clinicalAssistantFteRatio: { unit: "staff.ratioLegend.units.clinicalAssistantFte", unitFte: "staff.ratioLegend.units.clinicalAssistantFte" },
  frontdeskRatio: { unit: "staff.ratioLegend.units.frontdesk", unitFte: "staff.ratioLegend.units.frontdeskFte" },
  frontdeskFteRatio: { unit: "staff.ratioLegend.units.frontdeskFte", unitFte: "staff.ratioLegend.units.frontdeskFte" },
  supportTotalRatio: { unit: "staff.ratioLegend.units.supportTotal", unitFte: "staff.ratioLegend.units.supportTotalFte" },
  supportTotalFteRatio: { unit: "staff.ratioLegend.units.supportTotalFte", unitFte: "staff.ratioLegend.units.supportTotalFte" },
  examRoomRatio: { unit: "staff.ratioLegend.units.examRooms", unitFte: "staff.ratioLegend.units.examRooms" }, // rooms don't have FTE
};

/**
 * Format a number for ratio display: max 1 decimal, handle NaN/Infinity/undefined/null
 * Examples: 3 -> "3", 2.5 -> "2.5", NaN -> "—"
 */
function formatRatioNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  // Round to 1 decimal place
  const rounded = Math.round(value * 10) / 10;
  // Show integer if no decimal needed
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

/**
 * Format a short ratio string like "1:3" or "1:2.5"
 * Returns "—" if value is invalid
 */
function formatShortRatio(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return `1:${formatRatioNumber(value)}`;
}

function RatioCard({
  role,
  ratioKey,
  actual,
  optimal,
  score,
  recommendation,
  headcountActual,
  isFteValue,
  t
}: {
  role: string;
  ratioKey: string;
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

  // Get unit for this ratio
  const unitMapping = RATIO_UNIT_MAPPING[ratioKey] || { unit: ratioKey, unitFte: ratioKey };
  const unitKey = isFteValue ? unitMapping.unitFte : unitMapping.unit;
  const unitLabel = t(unitKey) || unitKey;
  const providerLabel = isFteValue ? t("staff.ratioLegend.units.providerFte") : t("staff.ratioLegend.units.provider");

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

      {/* Ratio Legend - human readable interpretation */}
      <div className="mb-3 p-2 rounded-lg bg-white/40 text-[10px] space-y-1">
        <div className="flex justify-between text-muted-foreground">
          <span className="font-medium">{t("staff.ratioLegend.actual")}</span>
          <span>{formatShortRatio(actual)} (1 {providerLabel} : {formatRatioNumber(actual)} {unitLabel})</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span className="font-medium">{t("staff.ratioLegend.target")}</span>
          <span>{formatShortRatio(optimal)} (1 {providerLabel} : {formatRatioNumber(optimal)} {unitLabel})</span>
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

function StaffingDebugPanel({ debug, meta, t }: {
  debug: StaffingDebugInfo;
  meta?: { computedAt: string; fromCache: boolean; forceApplied: boolean; debugEnabled: boolean };
  t: (key: string) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className="mt-4 p-3 rounded-lg bg-slate-100 border border-slate-300 text-xs"
      open={isOpen}
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer font-medium text-slate-700 flex items-center gap-2">
        <Bug className="h-4 w-4" />
        {t("staff.debugInfo") || "Debug Info"}
        {meta && (
          <span className="ml-auto text-slate-500">
            {meta.fromCache ? "Cache" : "Fresh"} | {new Date(meta.computedAt).toLocaleTimeString()}
          </span>
        )}
      </summary>
      <div className="mt-3 space-y-3">
        {/* Counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2 bg-white rounded border">
            <div className="text-slate-500">Providers</div>
            <div className="font-bold text-lg">{debug.providersCount}</div>
            <div className="text-slate-400">FTE: {debug.providersFte.toFixed(1)}</div>
          </div>
          <div className="p-2 bg-white rounded border">
            <div className="text-slate-500">Clinical</div>
            <div className="font-bold text-lg">{debug.clinicalAssistantsCount}</div>
            <div className="text-slate-400">FTE: {debug.clinicalAssistantsFte.toFixed(1)}</div>
          </div>
          <div className="p-2 bg-white rounded border">
            <div className="text-slate-500">Frontdesk</div>
            <div className="font-bold text-lg">{debug.frontdeskCount}</div>
            <div className="text-slate-400">FTE: {debug.frontdeskFte.toFixed(1)}</div>
          </div>
          <div className="p-2 bg-white rounded border">
            <div className="text-slate-500">Excluded</div>
            <div className="font-bold text-lg">{debug.excludedCount}</div>
          </div>
        </div>

        {/* Role Histogram */}
        {Object.keys(debug.roleHistogram).length > 0 && (
          <div>
            <div className="font-medium text-slate-600 mb-1">{t("staff.roleHistogram") || "Role Histogram"}</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(debug.roleHistogram).map(([role, count]) => (
                <Badge key={role} variant="outline" className="text-xs">
                  {role}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Unknown Roles */}
        {debug.unknownRoles.length > 0 && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded">
            <div className="font-medium text-amber-700 mb-1">{t("staff.unknownRoles") || "Unknown Roles"}</div>
            <div className="flex flex-wrap gap-1">
              {debug.unknownRoles.map((role) => (
                <Badge key={role} variant="outline" className="text-xs bg-amber-100 border-amber-300 text-amber-800">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function StaffingInsightsSection({
  analysis,
  t,
  onForceRefresh,
  isRefreshing
}: {
  analysis: LayoutAnalysis | null;
  t: (key: string) => string;
  onForceRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const staffingAnalysis = analysis?.staffingAnalysis || { overallScore: 0, ratios: {} };
  const staffingScore = analysis?.staffingScore ?? 50;
  const ratios = staffingAnalysis.ratios || {};
  const hasRooms = (analysis?.roomAnalyses?.length ?? 0) > 0;
  const hasRatioData = Object.keys(ratios).length > 0;
  const debug = staffingAnalysis.debug;
  const meta = analysis?.analysisMeta;

  // Check if we have providers - if not, ratios will be 0
  const noProviders = debug?.providersCount === 0;

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

  // Default fallback values for each ratio key (used when backend doesn't return a key)
  const ratioDefaults: Record<string, { actual: number; optimal: number; score: number; recommendation: string }> = {
    clinicalAssistantRatio: {
      actual: 0,
      optimal: STAFFING_RATIOS.nursePerDoctor.optimal,
      score: 0,
      recommendation: t("benchmarks.nurseToDoctorDesc")
    },
    frontdeskRatio: {
      actual: 0,
      optimal: STAFFING_RATIOS.receptionistPerProvider.optimal,
      score: 0,
      recommendation: t("benchmarks.frontdeskRatioDesc")
    },
    supportTotalRatio: {
      actual: 0,
      optimal: STAFFING_RATIOS.supportStaffPerDentist.optimal,
      score: 0,
      recommendation: t("benchmarks.supportStaffDesc")
    },
    examRoomRatio: {
      actual: 0,
      optimal: STAFFING_RATIOS.examRoomsPerProvider.optimal,
      score: 0,
      recommendation: t("benchmarks.examRoomsPerProviderDesc")
    }
  };

  // Build display ratios - ALWAYS show all 4 primary ratios in fixed order
  // Use backend data when available, fallback to defaults otherwise
  const displayRatios = ratioDisplayOrder.map(key => {
    // Use backend data if available, otherwise use defaults
    const baseData = ratios[key] ?? ratioDefaults[key];
    const fteKey = fteKeyMapping[key];
    const fteData = fteKey ? ratios[fteKey] : undefined;

    // Use FTE as primary value if available and > 0
    const useFte = fteData !== undefined && fteData.actual > 0;

    return {
      ratioKey: key,  // Keep the original key for unit mapping
      role: getRatioLabel(key, useFte),
      actual: useFte ? fteData.actual : baseData.actual,
      optimal: baseData.optimal,
      score: baseData.score,
      recommendation: useFte ? fteData.recommendation : baseData.recommendation,
      headcountActual: useFte ? baseData.actual : undefined,
      isFteValue: useFte
    };
  });
  
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
          <div className="flex items-center gap-3">
            {onForceRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onForceRefresh}
                disabled={isRefreshing}
                className="text-white hover:bg-white/20"
                data-testid="force-refresh-button"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")} />
                {t("staff.refreshAnalysis") || "Neu berechnen"}
              </Button>
            )}
            <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
              <StaffingScoreRing score={staffingScore} size={60} />
              <div className="text-right">
                <div className="text-xs text-blue-100">{t("staff.staffingOptimization")}</div>
              </div>
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
              key={data.ratioKey}
              ratioKey={data.ratioKey}
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

        {/* Warning when no providers detected */}
        {noProviders && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3"
            data-testid="no-providers-warning"
          >
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 mb-1">
                {t("staff.noProvidersWarning") || "Kein Behandler erkannt"}
              </p>
              <p className="text-xs text-red-700">
                {t("staff.noProvidersHint") ||
                  "Kein Behandler (Zahnarzt/Arzt) in Staff-Daten erkannt – Ratios pro Behandler bleiben 0. Legen Sie mindestens einen Staff mit Rolle 'dentist', 'zahnarzt' oder 'arzt' an."}
              </p>
            </div>
          </motion.div>
        )}

        {/* Debug panel (only shown when debug data is present) */}
        {debug && <StaffingDebugPanel debug={debug} meta={meta} t={t} />}
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
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffType | null>(null);
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);

  const handleEditStaff = (member: StaffType) => {
    setSelectedStaff(member);
    setIsEditDialogOpen(true);
  };

  const { data: analysis, isLoading, refetch } = useQuery({
    queryKey: ["ai-analysis", practiceId],
    queryFn: () => api.ai.analyzeLayout({ practiceId: practiceId!, operatingHours: 8 }, { debug: true }),
    enabled: !!practiceId,
    staleTime: 30000,
  });

  // Force refresh with force=1 and debug=1
  const handleForceRefresh = async () => {
    if (!practiceId) return;
    setIsForceRefreshing(true);
    try {
      const freshAnalysis = await api.ai.analyzeLayout(
        { practiceId, operatingHours: 8 },
        { force: true, debug: true }
      );
      // Update the cache with the fresh result
      queryClient.setQueryData(["ai-analysis", practiceId], freshAnalysis);
    } catch (error) {
      console.error("Force refresh failed:", error);
    } finally {
      setIsForceRefreshing(false);
    }
  };

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
          <StaffingInsightsSection
            analysis={analysis ?? null}
            t={t}
            onForceRefresh={handleForceRefresh}
            isRefreshing={isForceRefreshing}
          />
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
