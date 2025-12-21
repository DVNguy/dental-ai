/**
 * HR KPI Engine - DSGVO-konforme KPI-Berechnung
 *
 * WICHTIG: Diese Engine akzeptiert NUR voraggregierte Daten.
 * - KEINE Arrays mit staffId/employeeId
 * - KEINE individuellen Zuordnungen
 * - Alle Berechnungen auf Gruppen-/Praxisebene
 *
 * Zeiten: Alle internen Berechnungen in MINUTEN (nicht Stunden).
 *
 * Rechtsgrundlage:
 * - DSGVO Art. 5(1)(c) - Datenminimierung
 * - DSGVO Art. 25 - Privacy by Design
 */

import { randomUUID } from "crypto";
import {
  HrAggregationLevel,
  type HrPracticeInput,
  type HrAggregatedGroupInput,
  type HrKpiSnapshot,
  type HrKpiMetrics,
  type HrThresholds,
  DEFAULT_HR_THRESHOLDS,
  HR_COMPLIANCE_VERSION,
  DEFAULT_LEGAL_BASIS,
} from "./hrTypes";
import {
  assertNoPersonLevel,
  validateAggregatedInput,
  filterAndAggregateByKAnonymity,
  HrComplianceError,
} from "./hrComplianceGuard";

// ============================================================================
// Constants
// ============================================================================

const MINUTES_PER_HOUR = 60;
const DAYS_PER_WEEK = 7;

// ============================================================================
// Core KPI Calculation Functions
// ============================================================================

/**
 * Berechnet die FTE-Quote aus aggregierten Daten.
 *
 * @param currentFte - Aktuelle Gesamt-FTE
 * @param targetFte - Soll-FTE
 * @returns FTE-Quote (0.0 - 2.0+)
 */
function calculateFteQuote(currentFte: number, targetFte: number): number {
  if (targetFte <= 0) return 0;
  return round(currentFte / targetFte, 3);
}

/**
 * Berechnet die Abwesenheitsquote.
 *
 * @param totalAbsenceDays - Summe Abwesenheitstage
 * @param headcount - Anzahl Personen
 * @param workdaysInPeriod - Arbeitstage im Zeitraum
 * @returns Abwesenheitsquote in Prozent
 */
function calculateAbsenceRate(
  totalAbsenceDays: number,
  headcount: number,
  workdaysInPeriod: number
): number {
  const totalPossibleDays = headcount * workdaysInPeriod;
  if (totalPossibleDays <= 0) return 0;
  return round((totalAbsenceDays / totalPossibleDays) * 100, 2);
}

/**
 * Berechnet die Ueberstundenquote.
 *
 * @param totalOvertimeMinutes - Summe Ueberstunden in Minuten
 * @param totalContractMinutes - Summe Vertragsstunden in Minuten
 * @returns Ueberstundenquote in Prozent
 */
function calculateOvertimeRate(
  totalOvertimeMinutes: number,
  totalContractMinutes: number
): number {
  if (totalContractMinutes <= 0) return 0;
  return round((totalOvertimeMinutes / totalContractMinutes) * 100, 2);
}

/**
 * Bestimmt den Gesamtstatus basierend auf Schwellwerten.
 */
function determineOverallStatus(
  fteQuote: number,
  absenceRatePercent: number,
  overtimeRatePercent: number,
  thresholds: HrThresholds
): "critical" | "warning" | "ok" {
  // Critical wenn einer der Werte kritisch ist
  if (
    fteQuote < thresholds.fteGapCritical ||
    absenceRatePercent >= thresholds.absenceRateCritical ||
    overtimeRatePercent >= thresholds.overtimeRateCritical
  ) {
    return "critical";
  }

  // Warning wenn einer der Werte im Warning-Bereich
  if (
    fteQuote < thresholds.fteGapWarn ||
    absenceRatePercent >= thresholds.absenceRateWarn ||
    overtimeRatePercent >= thresholds.overtimeRateWarn
  ) {
    return "warning";
  }

  return "ok";
}

// ============================================================================
// Main KPI Engine Functions
// ============================================================================

/**
 * Berechnet KPI-Snapshot fuer die gesamte Praxis.
 * Dies ist die primaere und sicherste Aggregationsebene.
 *
 * @param input - Voraggregierte Praxisdaten
 * @param thresholds - Optionale Schwellwerte
 * @returns DSGVO-konformer KPI-Snapshot
 * @throws HrComplianceError bei personenbezogenen Daten im Input
 */
export function computePracticeSnapshot(
  input: HrPracticeInput,
  thresholds: HrThresholds = DEFAULT_HR_THRESHOLDS
): HrKpiSnapshot {
  // COMPLIANCE CHECK: Keine personenbezogenen Daten
  assertNoPersonLevel(input);

  // Validierung
  const validation = validateAggregatedInput(input.groups, thresholds.kMin);
  if (!validation.valid) {
    throw new HrComplianceError(
      `Compliance-Validierung fehlgeschlagen: ${validation.errors.join("; ")}`
    );
  }

  // Aggregiere alle Gruppen zu Praxis-Totals
  const totals = aggregateGroups(input.groups);

  // Zeitraum-Berechnungen
  const periodDays = daysBetween(input.periodStart, input.periodEnd);
  const weeksInPeriod = periodDays / DAYS_PER_WEEK;
  const workdaysInPeriod = Math.round(weeksInPeriod * input.workdaysPerWeek);

  // Vertragsstunden im Zeitraum (Minuten)
  const totalContractMinutesInPeriod =
    totals.totalContractedHoursPerWeek * MINUTES_PER_HOUR * weeksInPeriod;

  // KPI-Berechnungen
  const fteQuote = calculateFteQuote(totals.totalFte, input.targetFte);
  const fteDelta = round(totals.totalFte - input.targetFte, 2);
  const absenceRatePercent = calculateAbsenceRate(
    totals.totalAbsenceDays,
    totals.headcount,
    workdaysInPeriod
  );
  const overtimeRatePercent = calculateOvertimeRate(
    totals.totalOvertimeMinutes,
    totalContractMinutesInPeriod
  );

  // Personalkostenquote (optional)
  let laborCostRatioPercent: number | null = null;
  if (input.monthlyRevenue && input.monthlyRevenue > 0) {
    // Vereinfachte Schaetzung: 30 EUR/Stunde durchschnittlich
    const avgHourlyRate = 30;
    const monthlyHours = (totals.totalContractedHoursPerWeek * 52) / 12;
    const estimatedMonthlyCost = monthlyHours * avgHourlyRate;
    laborCostRatioPercent = round(
      (estimatedMonthlyCost / input.monthlyRevenue) * 100,
      2
    );
  }

  // Gesamtstatus
  const overallStatus = determineOverallStatus(
    fteQuote,
    absenceRatePercent,
    overtimeRatePercent,
    thresholds
  );

  // Metrics zusammenstellen
  const metrics: HrKpiMetrics = {
    fteQuote,
    currentFte: round(totals.totalFte, 2),
    targetFte: round(input.targetFte, 2),
    fteDelta,
    absenceRatePercent,
    overtimeRatePercent,
    laborCostRatioPercent,
    overallStatus,
  };

  // Snapshot erstellen - practiceId bleibt leer, wird vom Controller gesetzt
  // DESIGN: Core-Services liefern neutrale Ergebnisse ohne Kontext-Bindung
  const snapshot: Omit<HrKpiSnapshot, "practiceId"> & { practiceId?: string } = {
    id: randomUUID(),
    // practiceId wird vom Caller gesetzt - Core kennt keinen Kontext
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    aggregationLevel: HrAggregationLevel.PRACTICE,
    groupKey: "practice",
    groupSize: totals.headcount,
    metrics,
    audit: {
      aggregationLevel: HrAggregationLevel.PRACTICE,
      kUsed: thresholds.kMin,
      legalBasis: DEFAULT_LEGAL_BASIS,
      createdAt: new Date(),
      complianceVersion: HR_COMPLIANCE_VERSION,
    },
  };

  return snapshot as HrKpiSnapshot;
}

/**
 * Berechnet KPI-Snapshots pro Rolle (mit k-Anonymitaet).
 * Kleine Gruppen werden automatisch zusammengefasst.
 *
 * @param input - Voraggregierte Praxisdaten
 * @param thresholds - Optionale Schwellwerte
 * @returns Array von DSGVO-konformen KPI-Snapshots
 * @throws HrComplianceError bei personenbezogenen Daten im Input
 */
export function computeRoleSnapshots(
  input: HrPracticeInput,
  thresholds: HrThresholds = DEFAULT_HR_THRESHOLDS
): HrKpiSnapshot[] {
  // COMPLIANCE CHECK: Keine personenbezogenen Daten
  assertNoPersonLevel(input);

  // k-Anonymitaet anwenden
  const compliantGroups = filterAndAggregateByKAnonymity(
    input.groups,
    thresholds.kMin
  );

  if (compliantGroups.length === 0) {
    // Fallback auf Practice-Level wenn keine Gruppe k-anonym ist
    return [computePracticeSnapshot(input, thresholds)];
  }

  // Zeitraum-Berechnungen
  const periodDays = daysBetween(input.periodStart, input.periodEnd);
  const weeksInPeriod = periodDays / DAYS_PER_WEEK;
  const workdaysInPeriod = Math.round(weeksInPeriod * input.workdaysPerWeek);

  const snapshots: HrKpiSnapshot[] = [];

  for (const group of compliantGroups) {
    // Vertragsstunden im Zeitraum (Minuten)
    const totalContractMinutesInPeriod =
      group.totalContractedHoursPerWeek * MINUTES_PER_HOUR * weeksInPeriod;

    // Ziel-FTE pro Rolle (proportional)
    const totalHeadcount = input.groups.reduce((sum, g) => sum + g.headcount, 0);
    const roleTargetFte =
      totalHeadcount > 0
        ? (group.headcount / totalHeadcount) * input.targetFte
        : 0;

    // KPI-Berechnungen
    const fteQuote = calculateFteQuote(group.totalFte, roleTargetFte);
    const fteDelta = round(group.totalFte - roleTargetFte, 2);
    const absenceRatePercent = calculateAbsenceRate(
      group.totalAbsenceDays,
      group.headcount,
      workdaysInPeriod
    );
    const overtimeRatePercent = calculateOvertimeRate(
      group.totalOvertimeMinutes,
      totalContractMinutesInPeriod
    );

    // Gesamtstatus
    const overallStatus = determineOverallStatus(
      fteQuote,
      absenceRatePercent,
      overtimeRatePercent,
      thresholds
    );

    // Metrics
    const metrics: HrKpiMetrics = {
      fteQuote,
      currentFte: round(group.totalFte, 2),
      targetFte: round(roleTargetFte, 2),
      fteDelta,
      absenceRatePercent,
      overtimeRatePercent,
      laborCostRatioPercent: null, // Nicht auf Rollenebene berechnet
      overallStatus,
    };

    // Snapshot erstellen - practiceId bleibt leer, wird vom Controller gesetzt
    const snapshot: Omit<HrKpiSnapshot, "practiceId"> & { practiceId?: string } = {
      id: randomUUID(),
      // practiceId wird vom Caller gesetzt - Core kennt keinen Kontext
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      aggregationLevel: HrAggregationLevel.ROLE,
      groupKey: group.groupKey,
      groupSize: group.headcount,
      metrics,
      audit: {
        aggregationLevel: HrAggregationLevel.ROLE,
        kUsed: thresholds.kMin,
        legalBasis: DEFAULT_LEGAL_BASIS,
        createdAt: new Date(),
        complianceVersion: HR_COMPLIANCE_VERSION,
      },
    };

    snapshots.push(snapshot as HrKpiSnapshot);
  }

  return snapshots;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Aggregiert mehrere Gruppen zu Totals.
 */
function aggregateGroups(groups: HrAggregatedGroupInput[]): HrAggregatedGroupInput {
  return groups.reduce(
    (acc, group) => ({
      groupKey: "practice",
      headcount: acc.headcount + group.headcount,
      totalFte: acc.totalFte + group.totalFte,
      totalContractedHoursPerWeek:
        acc.totalContractedHoursPerWeek + group.totalContractedHoursPerWeek,
      totalOvertimeMinutes:
        acc.totalOvertimeMinutes + group.totalOvertimeMinutes,
      totalAbsenceDays: acc.totalAbsenceDays + group.totalAbsenceDays,
      absenceByType: {
        sick: acc.absenceByType.sick + group.absenceByType.sick,
        vacation: acc.absenceByType.vacation + group.absenceByType.vacation,
        training: acc.absenceByType.training + group.absenceByType.training,
        other: acc.absenceByType.other + group.absenceByType.other,
      },
    }),
    {
      groupKey: "practice",
      headcount: 0,
      totalFte: 0,
      totalContractedHoursPerWeek: 0,
      totalOvertimeMinutes: 0,
      totalAbsenceDays: 0,
      absenceByType: { sick: 0, vacation: 0, training: 0, other: 0 },
    }
  );
}

/**
 * Berechnet Tage zwischen zwei Daten.
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1;
}

/**
 * Rundet auf Dezimalstellen.
 */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ============================================================================
// Exports
// ============================================================================

export {
  calculateFteQuote,
  calculateAbsenceRate,
  calculateOvertimeRate,
  determineOverallStatus,
  aggregateGroups,
};
