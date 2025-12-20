import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { api, type HRKpiResponse, type HRAlert } from "@/lib/api";
import { usePractice } from "@/contexts/PracticeContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Users,
  Clock,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  UserMinus,
  Timer,
} from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  status: "critical" | "warning" | "ok" | "overstaffed";
  icon: React.ReactNode;
  detail?: string;
}

function KpiCard({ title, value, subtitle, status, icon, detail }: KpiCardProps) {
  const statusColors = {
    critical: "border-red-200 bg-red-50/50",
    warning: "border-yellow-200 bg-yellow-50/50",
    ok: "border-green-200 bg-green-50/50",
    overstaffed: "border-blue-200 bg-blue-50/50",
  };

  const statusTextColors = {
    critical: "text-red-700",
    warning: "text-yellow-700",
    ok: "text-green-700",
    overstaffed: "text-blue-700",
  };

  const statusBadgeColors = {
    critical: "bg-red-100 text-red-700 border-red-200",
    warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
    ok: "bg-green-100 text-green-700 border-green-200",
    overstaffed: "bg-blue-100 text-blue-700 border-blue-200",
  };

  const statusLabels = {
    critical: "Kritisch",
    warning: "Warnung",
    ok: "OK",
    overstaffed: "Überbesetzt",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border p-4 transition-all hover:shadow-md",
        statusColors[status]
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-lg bg-white/60", statusTextColors[status])}>
            {icon}
          </div>
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
        <Badge variant="outline" className={cn("text-xs", statusBadgeColors[status])}>
          {statusLabels[status]}
        </Badge>
      </div>
      <div className={cn("text-2xl font-bold mb-1", statusTextColors[status])}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      {detail && (
        <div className="text-xs text-muted-foreground/70 mt-2 pt-2 border-t border-current/10">
          {detail}
        </div>
      )}
    </motion.div>
  );
}

function AlertCard({ alert }: { alert: HRAlert }) {
  const severityConfig = {
    critical: {
      icon: <AlertTriangle className="h-4 w-4" />,
      bg: "bg-red-50 border-red-200",
      text: "text-red-800",
      badge: "bg-red-100 text-red-700",
    },
    warn: {
      icon: <Info className="h-4 w-4" />,
      bg: "bg-yellow-50 border-yellow-200",
      text: "text-yellow-800",
      badge: "bg-yellow-100 text-yellow-700",
    },
    info: {
      icon: <CheckCircle className="h-4 w-4" />,
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-800",
      badge: "bg-blue-100 text-blue-700",
    },
  };

  const config = severityConfig[alert.severity];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn("rounded-lg border p-3", config.bg)}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5", config.text)}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("font-medium text-sm", config.text)}>{alert.title}</span>
            <Badge variant="outline" className={cn("text-xs", config.badge)}>
              {alert.severity === "critical" ? "Kritisch" : alert.severity === "warn" ? "Warnung" : "Info"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            {alert.explanation}
          </p>
          {alert.recommendedActions.length > 0 && (
            <div className="text-xs text-muted-foreground/80">
              <span className="font-medium">Empfehlung: </span>
              {alert.recommendedActions[0]}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function KpiDashboardSkeleton() {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-4">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border p-4 bg-slate-50">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function HRKpiDashboard() {
  const { practiceId } = usePractice();

  const { data: kpis, isLoading, error } = useQuery({
    queryKey: ["hr-kpis", practiceId],
    queryFn: () => api.hr.getKpis(practiceId!),
    enabled: !!practiceId,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });

  if (isLoading) {
    return <KpiDashboardSkeleton />;
  }

  if (error) {
    console.error("HR KPI error:", error);
    return null; // Silently fail - the existing staffing insights will show
  }

  if (!kpis) {
    return null;
  }

  // Show helpful message when there are no staff members
  if (kpis.fte.current === 0) {
    return (
      <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">HR-Effizienz</CardTitle>
              <p className="text-sm text-muted-foreground">
                Keine Mitarbeiterdaten vorhanden
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Fügen Sie Mitarbeiter hinzu
              </p>
              <p className="text-xs text-blue-700">
                Sobald Sie Mitarbeiter zu Ihrem Team hinzufügen, werden hier die HR-Kennzahlen angezeigt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ftePercent = Math.round(kpis.fte.quote * 100);
  const activeAlerts = kpis.alerts.filter((a) => a.severity !== "info");

  return (
    <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">HR-Effizienz</CardTitle>
              <p className="text-sm text-muted-foreground">
                Kennzahlen für {new Date(kpis.periodStart).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-sm px-3 py-1",
              kpis.overallStatus === "critical"
                ? "bg-red-100 text-red-700 border-red-200"
                : kpis.overallStatus === "warning"
                  ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                  : "bg-green-100 text-green-700 border-green-200"
            )}
          >
            {kpis.overallStatus === "critical"
              ? "Handlungsbedarf"
              : kpis.overallStatus === "warning"
                ? "Beobachten"
                : "Stabil"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <KpiCard
            title="VZK-Quote"
            value={`${ftePercent}%`}
            subtitle={`${kpis.fte.current.toFixed(1)} / ${kpis.fte.target.toFixed(1)} VZK`}
            status={kpis.fte.status}
            icon={<Users className="h-4 w-4" />}
            detail={
              kpis.fte.delta >= 0
                ? `+${kpis.fte.delta.toFixed(1)} VZK Überschuss`
                : `${kpis.fte.delta.toFixed(1)} VZK Defizit`
            }
          />
          <KpiCard
            title="Überstunden"
            value={`${kpis.overtime.rate.toFixed(1)}%`}
            subtitle={`${kpis.overtime.totalHours.toFixed(0)}h gesamt`}
            status={kpis.overtime.status}
            icon={<Timer className="h-4 w-4" />}
            detail={`Ø ${kpis.overtime.avgPerStaff.toFixed(1)}h pro MA`}
          />
          <KpiCard
            title="Abwesenheit"
            value={`${kpis.absence.rate.toFixed(1)}%`}
            subtitle={`${kpis.absence.totalDays.toFixed(0)} Tage`}
            status={kpis.absence.status}
            icon={<UserMinus className="h-4 w-4" />}
            detail={
              kpis.absence.byType.sick > 0
                ? `davon ${kpis.absence.byType.sick.toFixed(0)} Krankheitstage`
                : undefined
            }
          />
          {kpis.laborCost ? (
            <KpiCard
              title="Personalkosten"
              value={`${kpis.laborCost.ratio.toFixed(1)}%`}
              subtitle={`vom Umsatz`}
              status={kpis.laborCost.status}
              icon={<TrendingDown className="h-4 w-4" />}
              detail={`Ø ${kpis.laborCost.costPerFte.toFixed(0)}€ pro VZK`}
            />
          ) : (
            <KpiCard
              title="Personalkosten"
              value="—"
              subtitle="Keine Umsatzdaten"
              status="ok"
              icon={<TrendingDown className="h-4 w-4" />}
            />
          )}
        </div>

        {/* Alerts Section */}
        {activeAlerts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">
                Aktive Hinweise ({activeAlerts.length})
              </h4>
            </div>
            <div className="space-y-3">
              {activeAlerts.slice(0, 3).map((alert, i) => (
                <AlertCard key={`${alert.code}-${i}`} alert={alert} />
              ))}
              {activeAlerts.length > 3 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  +{activeAlerts.length - 3} weitere Hinweise
                </p>
              )}
            </div>
          </div>
        )}

        {/* All healthy message */}
        {kpis.overallStatus === "ok" && activeAlerts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200"
          >
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Alle Kennzahlen im grünen Bereich
              </p>
              <p className="text-xs text-green-700">
                Weiter so! Die Personalstruktur ist ausgewogen.
              </p>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
