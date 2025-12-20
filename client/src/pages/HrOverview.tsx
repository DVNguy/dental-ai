/**
 * HR Overview Page
 *
 * DSGVO-konforme HR-Kennzahlen-Uebersicht.
 * Route: /hr
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Users,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Calendar,
  Shield,
  Building2,
  Briefcase,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { usePractice } from "@/contexts/PracticeContext";
import { cn } from "@/lib/utils";
import { fetchHrOverview, type DsgvoHrOverviewResponse, type HrKpiSnapshot, HrAlertSeverityEnum, HrKpiStatusEnum } from "@/api/hrOverview";
import { StaffingDemandCard } from "@/components/StaffingDemandCard";

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// Types
// ============================================================================

type AggregationLevel = "practice" | "role";

interface DateRange {
  start: string;
  end: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "ok":
      return "text-green-600";
    case "warning":
      return "text-yellow-600";
    case "critical":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ok":
      return "default";
    case "warning":
      return "secondary";
    case "critical":
      return "destructive";
    default:
      return "outline";
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical":
      return AlertCircle;
    case "warn":
      return AlertTriangle;
    case "info":
    default:
      return Info;
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "border-red-200 bg-red-50";
    case "warn":
      return "border-yellow-200 bg-yellow-50";
    case "info":
    default:
      return "border-blue-200 bg-blue-50";
  }
}

function getQuickDateRange(preset: "week" | "month" | "quarter" | "year"): DateRange {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case "week":
      start.setDate(end.getDate() - 7);
      break;
    case "month":
      start.setMonth(end.getMonth() - 1);
      break;
    case "quarter":
      start.setMonth(end.getMonth() - 3);
      break;
    case "year":
      start.setFullYear(end.getFullYear() - 1);
      break;
  }

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

// ============================================================================
// Sub-Components
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Fehler beim Laden</h3>
      <p className="text-sm text-gray-500 mb-4 text-center max-w-md">
        {error.message || "Die HR-Daten konnten nicht geladen werden."}
      </p>
      <Button onClick={onRetry} variant="outline">
        <RefreshCw className="h-4 w-4 mr-2" />
        Erneut versuchen
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Users className="h-16 w-16 text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Keine Daten verfuegbar</h3>
      <p className="text-sm text-gray-500 text-center max-w-md">
        Fuer den ausgewaehlten Zeitraum liegen keine HR-Kennzahlen vor.
        Bitte waehlen Sie einen anderen Zeitraum.
      </p>
    </div>
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  status?: string;
  trend?: "up" | "down" | "neutral";
  delay?: number;
}

function KpiCard({ title, value, subtitle, icon: Icon, status, trend, delay = 0 }: KpiCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-gray-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={cn("p-2 rounded-lg", status ? getStatusColor(status) : "bg-primary/10")}>
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold">{value}</div>
              {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            </div>
            {trend && (
              <TrendIcon className={cn("h-5 w-5", trendColor)} />
            )}
          </div>
          {status && (
            <Badge variant={getStatusBadgeVariant(status)} className="mt-2">
              {status === "ok" ? "Gut" : status === "warning" ? "Warnung" : "Kritisch"}
            </Badge>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface RoleTableProps {
  snapshots: HrKpiSnapshot[];
}

function RoleTable({ snapshots }: RoleTableProps) {
  // Filter out practice-level snapshots, show only role-level
  const roleSnapshots = snapshots.filter((s) => s.aggregationLevel === "ROLE");

  if (roleSnapshots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Kennzahlen nach Rolle
          </CardTitle>
          <CardDescription>
            Keine rollen-spezifischen Daten verfuegbar (k-Anonymitaet nicht erreicht)
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Kennzahlen nach Rolle
        </CardTitle>
        <CardDescription>
          Aggregierte HR-Metriken pro Berufsgruppe (DSGVO-konform)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rolle</TableHead>
              <TableHead className="text-right">Gruppen-gr.</TableHead>
              <TableHead className="text-right">FTE Quote</TableHead>
              <TableHead className="text-right">FTE Delta</TableHead>
              <TableHead className="text-right">Abwesenheit</TableHead>
              <TableHead className="text-right">Ueberstunden</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleSnapshots.map((snapshot) => (
              <TableRow key={snapshot.id}>
                <TableCell className="font-medium">{snapshot.groupKey}</TableCell>
                <TableCell className="text-right">{snapshot.groupSize}</TableCell>
                <TableCell className="text-right">{formatPercent(snapshot.metrics.fteQuote)}</TableCell>
                <TableCell className={cn("text-right", snapshot.metrics.fteDelta >= 0 ? "text-green-600" : "text-red-600")}>
                  {snapshot.metrics.fteDelta >= 0 ? "+" : ""}{snapshot.metrics.fteDelta.toFixed(1)}
                </TableCell>
                <TableCell className="text-right">{formatPercent(snapshot.metrics.absenceRatePercent)}</TableCell>
                <TableCell className="text-right">{formatPercent(snapshot.metrics.overtimeRatePercent)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(snapshot.metrics.overallStatus)}>
                    {snapshot.metrics.overallStatus === "ok" ? "OK" : snapshot.metrics.overallStatus === "warning" ? "Warnung" : "Kritisch"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface AlertsListProps {
  alertsBySnapshot: DsgvoHrOverviewResponse["alertsBySnapshot"];
}

function AlertsList({ alertsBySnapshot }: AlertsListProps) {
  const allAlerts = alertsBySnapshot.flatMap((s) => s.alerts);

  if (allAlerts.length === 0) {
    return null;
  }

  // Sort by severity
  const sortedAlerts = [...allAlerts].sort((a, b) => {
    const order = { critical: 0, warn: 1, info: 2 };
    return (order[a.severity as keyof typeof order] ?? 2) - (order[b.severity as keyof typeof order] ?? 2);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Handlungsempfehlungen
        </CardTitle>
        <CardDescription>
          Automatisch erkannte Optimierungspotenziale
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedAlerts.map((alert, index) => {
          const Icon = getSeverityIcon(alert.severity);
          return (
            <motion.div
              key={`${alert.code}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Alert className={getSeverityColor(alert.severity)}>
                <Icon className="h-4 w-4" />
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">{alert.explanation}</p>
                  {alert.recommendedActions.length > 0 && (
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {alert.recommendedActions.map((action, i) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Metrik: {alert.metric} | Aktuell: {alert.currentValue.toFixed(1)} | Schwelle: {alert.thresholdValue.toFixed(1)}
                  </p>
                </AlertDescription>
              </Alert>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface ComplianceInfoProps {
  compliance: DsgvoHrOverviewResponse["compliance"];
  warnings: string[];
}

function ComplianceInfo({ compliance, warnings }: ComplianceInfoProps) {
  return (
    <Card className="bg-slate-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4" />
          DSGVO-Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-1">
        <p>k-Anonymitaet: k = {compliance.kMin}</p>
        <p>Rechtsgrundlage: {compliance.legalBasis}</p>
        <p>Version: {compliance.version}</p>
        {warnings.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="font-medium text-yellow-700">Hinweise:</p>
            <ul className="list-disc list-inside text-yellow-600">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function HrOverview() {
  const { t } = useTranslation();
  const { practiceId } = usePractice();

  // State for controls
  const [level, setLevel] = useState<AggregationLevel>("practice");
  const [kMin, setKMin] = useState(5);
  const [dateRange, setDateRange] = useState<DateRange>(() => getQuickDateRange("month"));

  // Fetch HR data
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["hr-overview", practiceId, level, kMin, dateRange.start, dateRange.end],
    queryFn: () =>
      fetchHrOverview(practiceId!, {
        level,
        kMin,
        periodStart: dateRange.start,
        periodEnd: dateRange.end,
      }),
    enabled: !!practiceId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Get practice-level snapshot for KPI cards
  const practiceSnapshot = useMemo(() => {
    if (!data?.snapshots) return null;
    return data.snapshots.find((s) => s.aggregationLevel === "PRACTICE") ?? data.snapshots[0];
  }, [data?.snapshots]);

  // Handlers
  const handleQuickDateRange = (preset: "week" | "month" | "quarter" | "year") => {
    setDateRange(getQuickDateRange(preset));
  };

  const handleKMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 3) {
      setKMin(value);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
            HR-Uebersicht
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            DSGVO-konforme Personal-Kennzahlen
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Aktualisieren
        </Button>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6">
            {/* Level Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Aggregationsebene</Label>
              <ToggleGroup
                type="single"
                value={level}
                onValueChange={(v) => v && setLevel(v as AggregationLevel)}
                className="justify-start"
              >
                <ToggleGroupItem value="practice" aria-label="Praxis-Ebene">
                  <Building2 className="h-4 w-4 mr-2" />
                  Praxis
                </ToggleGroupItem>
                <ToggleGroupItem value="role" aria-label="Rollen-Ebene">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Nach Rolle
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* k-Min Input */}
            <div className="space-y-2">
              <Label htmlFor="kMin" className="text-sm font-medium">
                k-Anonymitaet (min. 3)
              </Label>
              <Input
                id="kMin"
                type="number"
                min={3}
                max={20}
                value={kMin}
                onChange={handleKMinChange}
                className="w-20"
              />
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Zeitraum</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDateRange("week")}
                >
                  7 Tage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDateRange("month")}
                >
                  30 Tage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDateRange("quarter")}
                >
                  90 Tage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDateRange("year")}
                >
                  1 Jahr
                </Button>
              </div>
            </div>

            {/* Date Inputs */}
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-sm font-medium">Von</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                  className="w-36"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-sm font-medium">Bis</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                  className="w-36"
                />
              </div>
            </div>
          </div>

          {/* Current Selection Info */}
          <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              k = {kMin}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Staffing Demand - always show if practice exists */}
      {practiceId && (
        <div className="mb-6">
          <StaffingDemandCard />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      ) : !data || data.snapshots.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          {practiceSnapshot && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                title="FTE-Quote"
                value={formatPercent(practiceSnapshot.metrics.fteQuote)}
                subtitle={`${practiceSnapshot.metrics.currentFte.toFixed(1)} / ${practiceSnapshot.metrics.targetFte.toFixed(1)} FTE`}
                icon={Users}
                status={practiceSnapshot.metrics.overallStatus}
                trend={practiceSnapshot.metrics.fteDelta >= 0 ? "up" : "down"}
                delay={0}
              />
              <KpiCard
                title="Abwesenheitsquote"
                value={formatPercent(practiceSnapshot.metrics.absenceRatePercent)}
                icon={Clock}
                status={practiceSnapshot.metrics.absenceRatePercent > 10 ? "warning" : "ok"}
                delay={0.1}
              />
              <KpiCard
                title="Ueberstundenquote"
                value={formatPercent(practiceSnapshot.metrics.overtimeRatePercent)}
                icon={TrendingUp}
                status={practiceSnapshot.metrics.overtimeRatePercent > 15 ? "warning" : "ok"}
                delay={0.2}
              />
              {practiceSnapshot.metrics.laborCostRatioPercent !== null && (
                <KpiCard
                  title="Personalkostenquote"
                  value={formatPercent(practiceSnapshot.metrics.laborCostRatioPercent)}
                  icon={Briefcase}
                  delay={0.3}
                />
              )}
            </div>
          )}

          {/* Role Table (only if level is "role") */}
          {level === "role" && <RoleTable snapshots={data.snapshots} />}

          {/* Alerts */}
          <AlertsList alertsBySnapshot={data.alertsBySnapshot} />

          {/* Compliance Info */}
          <ComplianceInfo compliance={data.compliance} warnings={data.warnings} />
        </div>
      )}
    </div>
  );
}
