/**
 * HR KPI Service Module
 *
 * Pure, deterministic functions for HR key performance indicator calculations.
 * No side effects, no database writes, no logging.
 * All time values in hours unless otherwise specified.
 */

// ============================================================================
// Input Types (Plain Objects - No ORM Dependency)
// ============================================================================

export interface StaffMember {
  id: string;
  role: string;
  fte: number;              // 0.0 - 1.0 (Full-Time Equivalent)
  weeklyHours: number;      // Contracted hours per week
  hourlyCost?: number;      // Cost per hour in EUR
}

export interface AbsenceRecord {
  staffId: string;
  type: "sick" | "vacation" | "training" | "other";
  startDate: Date;
  endDate: Date;
}

export interface OvertimeRecord {
  staffId: string;
  date: Date;
  overtimeHours: number;    // Hours worked beyond contract
}

export interface PracticeConfig {
  targetFte: number;                    // Target FTE for the practice
  workdaysPerWeek: number;              // Typically 5 or 6
  standardWeeklyHours: number;          // Standard full-time hours (e.g., 40)
  revenuePerMonth?: number;             // Monthly revenue in EUR (for cost ratio)
}

// ============================================================================
// Output Types
// ============================================================================

export interface FteDemandResult {
  currentFte: number;                   // Sum of all staff FTE
  targetFte: number;                    // Required FTE
  fteDelta: number;                     // currentFte - targetFte (negative = understaffed)
  fteQuote: number;                     // currentFte / targetFte (0.0 - 1.0+)
  status: "critical" | "warning" | "ok" | "overstaffed";
  byRole: Record<string, { count: number; fte: number }>;
}

export interface AbsenceRateResult {
  totalAbsenceDays: number;             // Total days absent in period
  totalWorkdays: number;                // Total possible workdays (staff × days)
  absenceRate: number;                  // 0.0 - 1.0 (percentage as decimal)
  absenceRatePercent: number;           // 0 - 100
  byType: Record<string, number>;       // Days per absence type
  status: "critical" | "warning" | "ok";
}

export interface OvertimeRateResult {
  totalOvertimeHours: number;           // Sum of all overtime
  totalContractHours: number;           // Sum of all contracted hours in period
  overtimeRate: number;                 // 0.0 - 1.0 (percentage as decimal)
  overtimeRatePercent: number;          // 0 - 100
  averageOvertimePerStaff: number;      // Hours per staff member
  status: "critical" | "warning" | "ok";
}

export interface LaborCostRatioResult {
  totalLaborCost: number;               // Total personnel cost in EUR
  revenue: number;                      // Revenue in EUR
  laborCostRatio: number;               // 0.0 - 1.0 (percentage as decimal)
  laborCostRatioPercent: number;        // 0 - 100
  costPerFte: number;                   // Average cost per FTE
  status: "critical" | "warning" | "ok";
}

// ============================================================================
// Threshold Constants
// ============================================================================

const THRESHOLDS = {
  fteQuote: {
    critical: 0.8,    // < 80% = critically understaffed
    warning: 0.95,    // < 95% = understaffed warning
    overstaffed: 1.1, // > 110% = overstaffed
  },
  absenceRate: {
    warning: 0.05,    // > 5% = warning
    critical: 0.10,   // > 10% = critical
  },
  overtimeRate: {
    warning: 0.10,    // > 10% = warning
    critical: 0.20,   // > 20% = critical
  },
  laborCostRatio: {
    warning: 0.35,    // > 35% = warning
    critical: 0.45,   // > 45% = critical
  },
} as const;

// ============================================================================
// Core KPI Functions
// ============================================================================

/**
 * Computes FTE demand and staffing status.
 *
 * Formula:
 *   currentFte = Σ(staff[i].fte)
 *   fteQuote = currentFte / targetFte
 *
 * @param staff - Array of staff members with FTE values
 * @param config - Practice configuration with target FTE
 * @returns FTE demand analysis with status
 */
export function computeFteDemand(
  staff: StaffMember[],
  config: Pick<PracticeConfig, "targetFte">
): FteDemandResult {
  const { targetFte } = config;

  // Aggregate by role
  const byRole: Record<string, { count: number; fte: number }> = {};
  let currentFte = 0;

  for (const member of staff) {
    const fte = Math.max(0, Math.min(1, member.fte)); // Clamp to 0-1
    currentFte += fte;

    if (!byRole[member.role]) {
      byRole[member.role] = { count: 0, fte: 0 };
    }
    byRole[member.role].count += 1;
    byRole[member.role].fte += fte;
  }

  const fteDelta = currentFte - targetFte;
  const fteQuote = targetFte > 0 ? currentFte / targetFte : 0;

  // Determine status
  let status: FteDemandResult["status"];
  if (fteQuote < THRESHOLDS.fteQuote.critical) {
    status = "critical";
  } else if (fteQuote < THRESHOLDS.fteQuote.warning) {
    status = "warning";
  } else if (fteQuote > THRESHOLDS.fteQuote.overstaffed) {
    status = "overstaffed";
  } else {
    status = "ok";
  }

  return {
    currentFte: round(currentFte, 2),
    targetFte: round(targetFte, 2),
    fteDelta: round(fteDelta, 2),
    fteQuote: round(fteQuote, 3),
    status,
    byRole,
  };
}

/**
 * Computes absence rate for a given period.
 *
 * Formula:
 *   totalAbsenceDays = Σ(workdays within each absence period)
 *   totalWorkdays = staffCount × workdaysInPeriod
 *   absenceRate = totalAbsenceDays / totalWorkdays
 *
 * @param staff - Array of staff members
 * @param absences - Array of absence records
 * @param periodStart - Start date of analysis period
 * @param periodEnd - End date of analysis period
 * @param config - Practice configuration
 * @returns Absence rate analysis with breakdown by type
 */
export function computeAbsenceRate(
  staff: StaffMember[],
  absences: AbsenceRecord[],
  periodStart: Date,
  periodEnd: Date,
  config: Pick<PracticeConfig, "workdaysPerWeek">
): AbsenceRateResult {
  const { workdaysPerWeek } = config;

  // Calculate workdays in period
  const totalDaysInPeriod = daysBetween(periodStart, periodEnd);
  const weeksInPeriod = totalDaysInPeriod / 7;
  const workdaysInPeriod = Math.round(weeksInPeriod * workdaysPerWeek);
  const totalWorkdays = staff.length * workdaysInPeriod;

  // Count absence days by type
  const byType: Record<string, number> = {
    sick: 0,
    vacation: 0,
    training: 0,
    other: 0,
  };

  let totalAbsenceDays = 0;

  for (const absence of absences) {
    // Only count absences that overlap with the period
    const effectiveStart = maxDate(absence.startDate, periodStart);
    const effectiveEnd = minDate(absence.endDate, periodEnd);

    if (effectiveStart <= effectiveEnd) {
      const absenceDays = countWorkdays(
        effectiveStart,
        effectiveEnd,
        workdaysPerWeek
      );
      totalAbsenceDays += absenceDays;
      byType[absence.type] = (byType[absence.type] || 0) + absenceDays;
    }
  }

  const absenceRate = totalWorkdays > 0 ? totalAbsenceDays / totalWorkdays : 0;

  // Determine status
  let status: AbsenceRateResult["status"];
  if (absenceRate >= THRESHOLDS.absenceRate.critical) {
    status = "critical";
  } else if (absenceRate >= THRESHOLDS.absenceRate.warning) {
    status = "warning";
  } else {
    status = "ok";
  }

  return {
    totalAbsenceDays: round(totalAbsenceDays, 1),
    totalWorkdays,
    absenceRate: round(absenceRate, 4),
    absenceRatePercent: round(absenceRate * 100, 2),
    byType,
    status,
  };
}

/**
 * Computes overtime rate for a given period.
 *
 * Formula:
 *   totalContractHours = Σ(staff[i].weeklyHours × weeksInPeriod)
 *   totalOvertimeHours = Σ(overtimeRecords[i].overtimeHours)
 *   overtimeRate = totalOvertimeHours / totalContractHours
 *
 * @param staff - Array of staff members with weekly hours
 * @param overtime - Array of overtime records
 * @param periodStart - Start date of analysis period
 * @param periodEnd - End date of analysis period
 * @returns Overtime rate analysis
 */
export function computeOvertimeRate(
  staff: StaffMember[],
  overtime: OvertimeRecord[],
  periodStart: Date,
  periodEnd: Date
): OvertimeRateResult {
  // Calculate weeks in period
  const totalDaysInPeriod = daysBetween(periodStart, periodEnd);
  const weeksInPeriod = totalDaysInPeriod / 7;

  // Calculate total contract hours for the period
  let totalContractHours = 0;
  for (const member of staff) {
    totalContractHours += member.weeklyHours * weeksInPeriod;
  }

  // Sum overtime hours within period
  let totalOvertimeHours = 0;
  for (const record of overtime) {
    if (record.date >= periodStart && record.date <= periodEnd) {
      totalOvertimeHours += record.overtimeHours;
    }
  }

  const overtimeRate =
    totalContractHours > 0 ? totalOvertimeHours / totalContractHours : 0;
  const averageOvertimePerStaff =
    staff.length > 0 ? totalOvertimeHours / staff.length : 0;

  // Determine status
  let status: OvertimeRateResult["status"];
  if (overtimeRate >= THRESHOLDS.overtimeRate.critical) {
    status = "critical";
  } else if (overtimeRate >= THRESHOLDS.overtimeRate.warning) {
    status = "warning";
  } else {
    status = "ok";
  }

  return {
    totalOvertimeHours: round(totalOvertimeHours, 1),
    totalContractHours: round(totalContractHours, 1),
    overtimeRate: round(overtimeRate, 4),
    overtimeRatePercent: round(overtimeRate * 100, 2),
    averageOvertimePerStaff: round(averageOvertimePerStaff, 1),
    status,
  };
}

/**
 * Computes labor cost ratio relative to revenue.
 *
 * Formula:
 *   totalLaborCost = Σ(staff[i].hourlyCost × staff[i].weeklyHours × weeksInMonth)
 *   laborCostRatio = totalLaborCost / revenue
 *
 * @param staff - Array of staff members with hourly cost
 * @param monthlyRevenue - Monthly revenue in EUR
 * @param weeksInMonth - Number of weeks in the month (default: 4.33)
 * @returns Labor cost ratio analysis
 */
export function computeLaborCostRatio(
  staff: StaffMember[],
  monthlyRevenue: number,
  weeksInMonth: number = 4.33
): LaborCostRatioResult {
  let totalLaborCost = 0;
  let totalFte = 0;

  for (const member of staff) {
    const hourlyCost = member.hourlyCost ?? 0;
    const monthlyCost = hourlyCost * member.weeklyHours * weeksInMonth;
    totalLaborCost += monthlyCost;
    totalFte += member.fte;
  }

  const laborCostRatio =
    monthlyRevenue > 0 ? totalLaborCost / monthlyRevenue : 0;
  const costPerFte = totalFte > 0 ? totalLaborCost / totalFte : 0;

  // Determine status
  let status: LaborCostRatioResult["status"];
  if (laborCostRatio >= THRESHOLDS.laborCostRatio.critical) {
    status = "critical";
  } else if (laborCostRatio >= THRESHOLDS.laborCostRatio.warning) {
    status = "warning";
  } else {
    status = "ok";
  }

  return {
    totalLaborCost: round(totalLaborCost, 2),
    revenue: round(monthlyRevenue, 2),
    laborCostRatio: round(laborCostRatio, 4),
    laborCostRatioPercent: round(laborCostRatio * 100, 2),
    costPerFte: round(costPerFte, 2),
    status,
  };
}

// ============================================================================
// Composite KPI Function
// ============================================================================

export interface HRKpiSnapshot {
  timestamp: Date;
  fteQuote: number;
  absenceRatePercent: number;
  overtimeRatePercent: number;
  laborCostRatioPercent: number | null;
  overallStatus: "critical" | "warning" | "ok";
  alerts: Array<{
    type: string;
    severity: "critical" | "warning";
    message: string;
    currentValue: number;
    thresholdValue: number;
  }>;
}

/**
 * Computes all HR KPIs and generates alerts.
 *
 * @param staff - Array of staff members
 * @param absences - Array of absence records
 * @param overtime - Array of overtime records
 * @param periodStart - Start date of analysis period
 * @param periodEnd - End date of analysis period
 * @param config - Practice configuration
 * @returns Complete HR KPI snapshot with alerts
 */
export function computeHRKpiSnapshot(
  staff: StaffMember[],
  absences: AbsenceRecord[],
  overtime: OvertimeRecord[],
  periodStart: Date,
  periodEnd: Date,
  config: PracticeConfig
): HRKpiSnapshot {
  const fteDemand = computeFteDemand(staff, config);
  const absenceRate = computeAbsenceRate(
    staff,
    absences,
    periodStart,
    periodEnd,
    config
  );
  const overtimeRate = computeOvertimeRate(staff, overtime, periodStart, periodEnd);

  let laborCostRatioPercent: number | null = null;
  let laborCostStatus: LaborCostRatioResult["status"] = "ok";

  if (config.revenuePerMonth && config.revenuePerMonth > 0) {
    const laborCost = computeLaborCostRatio(staff, config.revenuePerMonth);
    laborCostRatioPercent = laborCost.laborCostRatioPercent;
    laborCostStatus = laborCost.status;
  }

  // Generate alerts
  const alerts: HRKpiSnapshot["alerts"] = [];

  if (fteDemand.status === "critical") {
    alerts.push({
      type: "understaffed",
      severity: "critical",
      message: `FTE-Quote kritisch niedrig: ${(fteDemand.fteQuote * 100).toFixed(1)}%`,
      currentValue: fteDemand.fteQuote,
      thresholdValue: THRESHOLDS.fteQuote.critical,
    });
  } else if (fteDemand.status === "warning") {
    alerts.push({
      type: "understaffed",
      severity: "warning",
      message: `FTE-Quote unter Ziel: ${(fteDemand.fteQuote * 100).toFixed(1)}%`,
      currentValue: fteDemand.fteQuote,
      thresholdValue: THRESHOLDS.fteQuote.warning,
    });
  }

  if (absenceRate.status === "critical") {
    alerts.push({
      type: "high_absence",
      severity: "critical",
      message: `Abwesenheitsquote kritisch: ${absenceRate.absenceRatePercent.toFixed(1)}%`,
      currentValue: absenceRate.absenceRate,
      thresholdValue: THRESHOLDS.absenceRate.critical,
    });
  } else if (absenceRate.status === "warning") {
    alerts.push({
      type: "high_absence",
      severity: "warning",
      message: `Abwesenheitsquote erhöht: ${absenceRate.absenceRatePercent.toFixed(1)}%`,
      currentValue: absenceRate.absenceRate,
      thresholdValue: THRESHOLDS.absenceRate.warning,
    });
  }

  if (overtimeRate.status === "critical") {
    alerts.push({
      type: "overtime_warning",
      severity: "critical",
      message: `Überstundenquote kritisch: ${overtimeRate.overtimeRatePercent.toFixed(1)}%`,
      currentValue: overtimeRate.overtimeRate,
      thresholdValue: THRESHOLDS.overtimeRate.critical,
    });
  } else if (overtimeRate.status === "warning") {
    alerts.push({
      type: "overtime_warning",
      severity: "warning",
      message: `Überstundenquote erhöht: ${overtimeRate.overtimeRatePercent.toFixed(1)}%`,
      currentValue: overtimeRate.overtimeRate,
      thresholdValue: THRESHOLDS.overtimeRate.warning,
    });
  }

  if (laborCostStatus === "critical") {
    alerts.push({
      type: "cost_overrun",
      severity: "critical",
      message: `Personalkostenquote kritisch: ${laborCostRatioPercent?.toFixed(1)}%`,
      currentValue: laborCostRatioPercent! / 100,
      thresholdValue: THRESHOLDS.laborCostRatio.critical,
    });
  } else if (laborCostStatus === "warning") {
    alerts.push({
      type: "cost_overrun",
      severity: "warning",
      message: `Personalkostenquote erhöht: ${laborCostRatioPercent?.toFixed(1)}%`,
      currentValue: laborCostRatioPercent! / 100,
      thresholdValue: THRESHOLDS.laborCostRatio.warning,
    });
  }

  // Determine overall status
  const hasCritical = alerts.some((a) => a.severity === "critical");
  const hasWarning = alerts.some((a) => a.severity === "warning");
  const overallStatus: HRKpiSnapshot["overallStatus"] = hasCritical
    ? "critical"
    : hasWarning
      ? "warning"
      : "ok";

  return {
    timestamp: new Date(),
    fteQuote: fteDemand.fteQuote,
    absenceRatePercent: absenceRate.absenceRatePercent,
    overtimeRatePercent: overtimeRate.overtimeRatePercent,
    laborCostRatioPercent,
    overallStatus,
    alerts,
  };
}

// ============================================================================
// Helper Functions (Pure, No Side Effects)
// ============================================================================

/**
 * Rounds a number to specified decimal places.
 */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculates days between two dates (inclusive).
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1;
}

/**
 * Returns the later of two dates.
 */
function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

/**
 * Returns the earlier of two dates.
 */
function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}

/**
 * Counts workdays between two dates based on workdays per week.
 * Simplified calculation assuming even distribution.
 */
function countWorkdays(
  start: Date,
  end: Date,
  workdaysPerWeek: number
): number {
  const totalDays = daysBetween(start, end);
  const workdayRatio = workdaysPerWeek / 7;
  return Math.round(totalDays * workdayRatio);
}

// ============================================================================
// Export Thresholds for External Use
// ============================================================================

export { THRESHOLDS as HR_KPI_THRESHOLDS };
