/**
 * Staffing Demand Card
 *
 * Zeigt den berechneten Personalbedarf (Soll) aus der Staffing Engine.
 * Verhindert Double-Counting durch Nutzung von meta.totalFromRoundedParts.
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users,
  AlertCircle,
  Info,
  RefreshCw,
  Calculator,
  UserCheck,
  Stethoscope,
  ClipboardList,
  Building,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { usePractice } from "@/contexts/PracticeContext";
import { cn } from "@/lib/utils";
import {
  fetchStaffingDemand,
  type StaffingDemandResponse,
  type StaffingResult,
} from "@/api/hrOverview";

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// Types
// ============================================================================

interface RoleDisplayProps {
  label: string;
  sollFte: number;
  istFte?: number;
  icon: React.ReactNode;
  delay?: number;
}

interface CoverageBarProps {
  label: string;
  coverage: number; // 0-2+ (1 = 100%)
  sollFte: number;
  istFte: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatFte(value: number): string {
  return value.toFixed(1);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function getCoverageStatus(coverage: number): "critical" | "warning" | "ok" | "overstaffed" {
  if (coverage < 0.7) return "critical";
  if (coverage < 0.9) return "warning";
  if (coverage <= 1.1) return "ok";
  return "overstaffed";
}

function getCoverageColor(status: "critical" | "warning" | "ok" | "overstaffed"): string {
  switch (status) {
    case "critical":
      return "bg-red-500";
    case "warning":
      return "bg-yellow-500";
    case "ok":
      return "bg-green-500";
    case "overstaffed":
      return "bg-blue-500";
  }
}

function getCoverageTextColor(status: "critical" | "warning" | "ok" | "overstaffed"): string {
  switch (status) {
    case "critical":
      return "text-red-700";
    case "warning":
      return "text-yellow-700";
    case "ok":
      return "text-green-700";
    case "overstaffed":
      return "text-blue-700";
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border p-4 bg-slate-50">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RoleCard({ label, sollFte, istFte, icon, delay = 0 }: RoleDisplayProps) {
  const hasCoverage = istFte !== undefined && sollFte > 0;
  const coverage = hasCoverage ? istFte / sollFte : undefined;
  const status = coverage !== undefined ? getCoverageStatus(coverage) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "rounded-xl border p-4 transition-all hover:shadow-md",
        status === "critical" && "border-red-200 bg-red-50/50",
        status === "warning" && "border-yellow-200 bg-yellow-50/50",
        status === "ok" && "border-green-200 bg-green-50/50",
        status === "overstaffed" && "border-blue-200 bg-blue-50/50",
        !status && "border-slate-200 bg-slate-50/50"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-2 rounded-lg",
            status ? getCoverageTextColor(status) : "text-slate-600",
            "bg-white/60"
          )}>
            {icon}
          </div>
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        {status && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              status === "critical" && "bg-red-100 text-red-700 border-red-200",
              status === "warning" && "bg-yellow-100 text-yellow-700 border-yellow-200",
              status === "ok" && "bg-green-100 text-green-700 border-green-200",
              status === "overstaffed" && "bg-blue-100 text-blue-700 border-blue-200"
            )}
          >
            {formatPercent(coverage!)}
          </Badge>
        )}
      </div>

      <div className={cn(
        "text-2xl font-bold mb-1",
        status ? getCoverageTextColor(status) : "text-slate-900"
      )}>
        {formatFte(sollFte)} VZÄ
      </div>

      {hasCoverage && (
        <div className="text-xs text-muted-foreground">
          Ist: {formatFte(istFte)} / Soll: {formatFte(sollFte)}
        </div>
      )}

      {!hasCoverage && sollFte > 0 && (
        <div className="text-xs text-muted-foreground">
          Soll-Bedarf
        </div>
      )}
    </motion.div>
  );
}

function CoverageBar({ label, coverage, sollFte, istFte }: CoverageBarProps) {
  const status = getCoverageStatus(coverage);
  // Skala: 0% bis 150% (maxScale = 1.5)
  const maxScale = 1.5;
  const clampedCoverage = Math.max(0, Math.min(coverage, maxScale));
  const widthPct = (clampedCoverage / maxScale) * 100;
  const markerPct = (1 / maxScale) * 100; // 100%-Marker Position

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", getCoverageTextColor(status))}>
          {formatFte(istFte)} / {formatFte(sollFte)} ({formatPercent(coverage)})
        </span>
      </div>
      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all", getCoverageColor(status))}
          style={{ width: `${widthPct}%` }}
        />
        {/* 100% marker */}
        <div
          className="absolute top-0 w-0.5 h-full bg-slate-400"
          style={{ left: `${markerPct}%`, transform: "translateX(-50%)" }}
        />
      </div>
    </div>
  );
}

function WarningsDisplay({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-800">Hinweise zur Berechnung</p>
          <ul className="text-xs text-amber-700 space-y-0.5">
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

function FlagsDisplay({ flags }: { flags: StaffingResult["flags"] }) {
  const criticalFlags = flags.filter((f) => f.severity === "red");
  const warningFlags = flags.filter((f) => f.severity === "yellow");

  if (criticalFlags.length === 0 && warningFlags.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 space-y-2"
    >
      {criticalFlags.map((flag) => (
        <div
          key={flag.id}
          className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50"
        >
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800">{flag.message}</p>
        </div>
      ))}
      {warningFlags.map((flag) => (
        <div
          key={flag.id}
          className="flex items-start gap-2 p-3 rounded-lg border border-yellow-200 bg-yellow-50"
        >
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-800">{flag.message}</p>
        </div>
      ))}
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StaffingDemandCard() {
  const { practiceId } = usePractice();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["staffing-demand", practiceId],
    queryFn: () => fetchStaffingDemand(practiceId!),
    enabled: !!practiceId,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-lg text-red-800">Fehler</CardTitle>
              <CardDescription className="text-red-600">
                Personalbedarf konnte nicht berechnet werden
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => refetch()} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { result, engineVersion } = data;
  const { roundedFte, meta, derived, coverage, flags } = result;

  // === KORREKTE Total-Coverage-Berechnung ===
  // totalSollUi: UI-konsistenter Soll-Wert (Summe der gerundeten Teile)
  const totalSollUi = meta.totalFromRoundedParts ?? (
    roundedFte.zfaTotal + roundedFte.prophy + roundedFte.frontdesk + roundedFte.pm
  );
  // totalIst: coverage.total ist gegen roundedFte.total berechnet, NICHT gegen totalSollUi!
  const totalIst = coverage?.total !== undefined
    ? roundedFte.total * coverage.total
    : undefined;
  // totalCoverageUi: Korrigierte Coverage für UI-Anzeige
  const totalCoverageUi = totalIst !== undefined && totalSollUi > 0
    ? totalIst / totalSollUi
    : undefined;

  // Inactive practice check
  if (!meta.isPracticeActive) {
    return (
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100">
              <Calculator className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Personalbedarf (Soll)</CardTitle>
              <CardDescription>
                Keine aktive Praxis erkannt
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-100 border border-slate-200">
            <Info className="h-5 w-5 text-slate-500 flex-shrink-0" />
            <p className="text-sm text-slate-600">
              Bitte füge Zahnärzte oder Behandlungsstühle hinzu, um den Personalbedarf zu berechnen.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Personalbedarf (Soll)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Berechneter optimaler Personalbedarf basierend auf Praxisstruktur.
                        <br /><br />
                        <strong>Wichtig:</strong> ZFA gesamt = Stuhlassistenz + Sterilisation.
                        Nicht doppelt zählen!
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>
                Staffing Engine v{engineVersion}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-muted-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Main Role Cards - KEINE Double-Counting! */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <RoleCard
            label="ZFA gesamt"
            sollFte={roundedFte.zfaTotal}
            istFte={coverage?.zfaTotal !== undefined ? roundedFte.zfaTotal * coverage.zfaTotal : undefined}
            icon={<UserCheck className="h-4 w-4" />}
            delay={0}
          />
          <RoleCard
            label="Prophylaxe"
            sollFte={roundedFte.prophy}
            istFte={coverage?.prophy !== undefined ? roundedFte.prophy * coverage.prophy : undefined}
            icon={<Stethoscope className="h-4 w-4" />}
            delay={0.05}
          />
          <RoleCard
            label="Empfang"
            sollFte={roundedFte.frontdesk}
            istFte={coverage?.frontdesk !== undefined ? roundedFte.frontdesk * coverage.frontdesk : undefined}
            icon={<ClipboardList className="h-4 w-4" />}
            delay={0.1}
          />
          <RoleCard
            label="Praxismanagement"
            sollFte={roundedFte.pm}
            istFte={coverage?.pm !== undefined ? roundedFte.pm * coverage.pm : undefined}
            icon={<Building className="h-4 w-4" />}
            delay={0.15}
          />
        </div>

        {/* Total - using meta.totalFromRoundedParts for UI consistency */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 mb-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-medium">Gesamtbedarf</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Summe: ZFA gesamt + Prophylaxe + Empfang + PM
                      <br />
                      (keine Doppelzählung von Stuhlassistenz/Sterilisation)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {formatFte(totalSollUi)} VZÄ
              </div>
              {totalIst !== undefined && totalCoverageUi !== undefined && (
                <div className="text-xs text-muted-foreground">
                  Ist: {formatFte(totalIst)} ({formatPercent(totalCoverageUi)})
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Coverage Breakdown (if available) */}
        {coverage && Object.keys(coverage).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Besetzungsquote (Ist/Soll)
              </span>
            </div>

            {coverage.zfaTotal !== undefined && roundedFte.zfaTotal > 0 && (
              <CoverageBar
                label="ZFA gesamt"
                coverage={coverage.zfaTotal}
                sollFte={roundedFte.zfaTotal}
                istFte={roundedFte.zfaTotal * coverage.zfaTotal}
              />
            )}
            {coverage.prophy !== undefined && roundedFte.prophy > 0 && (
              <CoverageBar
                label="Prophylaxe"
                coverage={coverage.prophy}
                sollFte={roundedFte.prophy}
                istFte={roundedFte.prophy * coverage.prophy}
              />
            )}
            {coverage.frontdesk !== undefined && roundedFte.frontdesk > 0 && (
              <CoverageBar
                label="Empfang"
                coverage={coverage.frontdesk}
                sollFte={roundedFte.frontdesk}
                istFte={roundedFte.frontdesk * coverage.frontdesk}
              />
            )}
            {totalIst !== undefined && totalCoverageUi !== undefined && totalSollUi > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <CoverageBar
                  label="Gesamt"
                  coverage={totalCoverageUi}
                  sollFte={totalSollUi}
                  istFte={totalIst}
                />
              </div>
            )}
          </motion.div>
        )}

        {/* Ampel-Flags */}
        <FlagsDisplay flags={flags} />

        {/* Warnings from derived values */}
        <WarningsDisplay warnings={derived.warnings} />

        {/* Detail-Info Collapsible */}
        <motion.details
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 group"
        >
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
            <Info className="h-3 w-3" />
            Details anzeigen (Stuhlassistenz/Sterilisation separat)
          </summary>
          <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-muted-foreground space-y-2">
            <div className="flex justify-between">
              <span>Stuhlassistenz (Teil von ZFA):</span>
              <span className="font-mono">{formatFte(roundedFte.chairside)} VZÄ</span>
            </div>
            <div className="flex justify-between">
              <span>Sterilisation (Teil von ZFA):</span>
              <span className="font-mono">{formatFte(roundedFte.steri)} VZÄ</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 font-medium">
              <span>= ZFA gesamt:</span>
              <span className="font-mono">{formatFte(roundedFte.zfaTotal)} VZÄ</span>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <div className="flex justify-between text-muted-foreground/70">
                <span>Gleichzeitige Stühle (C):</span>
                <span className="font-mono">{derived.C}</span>
              </div>
              <div className="flex justify-between text-muted-foreground/70">
                <span>Patienten/Tag (N):</span>
                <span className="font-mono">{derived.N}</span>
              </div>
            </div>
          </div>
        </motion.details>
      </CardContent>
    </Card>
  );
}

export default StaffingDemandCard;
