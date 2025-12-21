/**
 * HR Alerts - DSGVO-konforme Alert-Generierung
 *
 * WICHTIG: Alle Alerts sind strikt organisatorisch formuliert.
 * - KEINE Referenzen auf einzelne Personen
 * - KEINE Begriffe wie "Stress", "Burnout", "ueberfordert"
 * - NUR neutrale, arbeitsorganisatorische Sprache
 *
 * Erlaubte Begriffe:
 * - "Systemische Ueberlastung" statt "Stress"
 * - "Kapazitaetsengpass" statt "Burnout"
 * - "Arbeitslast" statt "Belastung Person X"
 *
 * Rechtsgrundlage: DSGVO Art. 5, ArbSchG
 */

import {
  HrAggregationLevel,
  HrAlertCode,
  type HrAlert,
  type HrAlertSeverity,
  type HrKpiSnapshot,
  type HrThresholds,
  DEFAULT_HR_THRESHOLDS,
} from "./hrTypes";
import { assertTextCompliance, HrComplianceError } from "./hrComplianceGuard";

// ============================================================================
// Alert Rule Type
// ============================================================================

type AlertRule = (
  snapshot: HrKpiSnapshot,
  thresholds: HrThresholds
) => HrAlert | null;

// ============================================================================
// Individual Alert Rules - Neutral, Organisatorisch
// ============================================================================

/**
 * Regel: Kritische Kapazitaetsluecke (FTE < 80%)
 */
const ruleCapacityGapCritical: AlertRule = (snapshot, thresholds) => {
  if (snapshot.metrics.fteQuote >= thresholds.fteGapCritical) return null;

  const deficit = ((1 - snapshot.metrics.fteQuote) * 100).toFixed(0);

  return createAlert({
    code: HrAlertCode.HR_CAPACITY_GAP,
    severity: "critical",
    title: "Kritische Kapazitaetsluecke",
    explanation:
      `Die verfuegbare Personalkapazitaet liegt bei ${(snapshot.metrics.fteQuote * 100).toFixed(0)}% des Bedarfs. ` +
      `Ein Defizit von ${deficit}% erfordert sofortige organisatorische Massnahmen zur Sicherstellung des Praxisbetriebs.`,
    recommendedActions: [
      "Kapazitaetsplanung ueberpruefen und Soll-Besetzung aktualisieren",
      "Stellenausschreibungen fuer kritische Funktionsbereiche initiieren",
      "Temporaere Unterstuetzung durch externe Dienstleister pruefen",
      "Terminvolumen temporaer an verfuegbare Kapazitaet anpassen",
      "Prozessoptimierung zur Effizienzsteigerung evaluieren",
    ],
    metric: "fteQuote",
    currentValue: snapshot.metrics.fteQuote,
    thresholdValue: thresholds.fteGapCritical,
    aggregationLevel: snapshot.aggregationLevel,
    groupKey: snapshot.groupKey,
  });
};

/**
 * Regel: Kapazitaetsluecke Warning (FTE 80-95%)
 */
const ruleCapacityGapWarning: AlertRule = (snapshot, thresholds) => {
  if (
    snapshot.metrics.fteQuote < thresholds.fteGapCritical ||
    snapshot.metrics.fteQuote >= thresholds.fteGapWarn
  ) {
    return null;
  }

  return createAlert({
    code: HrAlertCode.HR_CAPACITY_GAP,
    severity: "warn",
    title: "Kapazitaetsluecke erkannt",
    explanation:
      `Mit ${(snapshot.metrics.fteQuote * 100).toFixed(0)}% Besetzungsgrad besteht ein moderates Defizit. ` +
      `Ungeplante Ausfaelle koennten zu Engpaessen fuehren.`,
    recommendedActions: [
      "Personalplanung auf mittelfristige Bedarfe ueberpruefen",
      "Aufstockungsmoeglichkeiten bei Teilzeitkraeften evaluieren",
      "Vertretungsregelungen aktualisieren",
      "Schichtplanung auf optimale Abdeckung pruefen",
    ],
    metric: "fteQuote",
    currentValue: snapshot.metrics.fteQuote,
    thresholdValue: thresholds.fteGapWarn,
    aggregationLevel: snapshot.aggregationLevel,
    groupKey: snapshot.groupKey,
  });
};

/**
 * Regel: Systemische Ueberlastung durch Ueberstunden (kritisch)
 */
const ruleSystemOverloadCritical: AlertRule = (snapshot, thresholds) => {
  if (snapshot.metrics.overtimeRatePercent <= thresholds.overtimeRateCritical) {
    return null;
  }

  return createAlert({
    code: HrAlertCode.HR_SYSTEM_OVERLOAD,
    severity: "critical",
    title: "Systemische Ueberlastung erkannt",
    explanation:
      `Die Ueberstundenquote von ${snapshot.metrics.overtimeRatePercent.toFixed(1)}% deutet auf strukturelle Kapazitaetsengpaesse hin. ` +
      `Dauerhafte Mehrarbeit gefaehrdet die Betriebsstabilitaet und erfordert organisatorische Anpassungen.`,
    recommendedActions: [
      "Arbeitszeitanalyse: Identifikation von Prozessengpaessen",
      "Kapazitaetserweiterung durch Neueinstellungen oder Dienstleister",
      "Prozessoptimierung zur Reduzierung nicht-wertschoepfender Taetigkeiten",
      "Terminplanung anpassen: Pufferzeiten integrieren",
      "Arbeitszeitausgleich zeitnah ermoeglichen (ArbZG-Konformitaet)",
    ],
    metric: "overtimeRate",
    currentValue: snapshot.metrics.overtimeRatePercent,
    thresholdValue: thresholds.overtimeRateCritical,
    aggregationLevel: snapshot.aggregationLevel,
    groupKey: snapshot.groupKey,
  });
};

/**
 * Regel: Erhoehte Arbeitslast (Ueberstunden Warning)
 */
const ruleSystemOverloadWarning: AlertRule = (snapshot, thresholds) => {
  if (
    snapshot.metrics.overtimeRatePercent <= thresholds.overtimeRateWarn ||
    snapshot.metrics.overtimeRatePercent > thresholds.overtimeRateCritical
  ) {
    return null;
  }

  return createAlert({
    code: HrAlertCode.HR_SYSTEM_OVERLOAD,
    severity: "warn",
    title: "Erhoehte Arbeitslast",
    explanation:
      `Mit ${snapshot.metrics.overtimeRatePercent.toFixed(1)}% Ueberstundenquote liegt die Arbeitslast ueber dem Normalniveau. ` +
      `Kurzfristig akzeptabel, sollte jedoch nicht zum Dauerzustand werden.`,
    recommendedActions: [
      "Ueberstundenursachen dokumentieren (saisonal vs. strukturell)",
      "Zeitnahen Freizeitausgleich planen",
      "Aufgabenverteilung und Schichtbesetzung optimieren",
      "Terminplanung auf Lastspitzen ueberpruefen",
    ],
    metric: "overtimeRate",
    currentValue: snapshot.metrics.overtimeRatePercent,
    thresholdValue: thresholds.overtimeRateWarn,
    aggregationLevel: snapshot.aggregationLevel,
    groupKey: snapshot.groupKey,
  });
};

/**
 * Regel: Erhoehte Abwesenheit kritisch
 */
const ruleAbsenceElevatedCritical: AlertRule = (snapshot, thresholds) => {
  if (snapshot.metrics.absenceRatePercent <= thresholds.absenceRateCritical) {
    return null;
  }

  return createAlert({
    code: HrAlertCode.HR_ABSENCE_ELEVATED,
    severity: "critical",
    title: "Kritisch erhoehte Abwesenheitsquote",
    explanation:
      `Mit ${snapshot.metrics.absenceRatePercent.toFixed(1)}% Abwesenheit faellt ein signifikanter Anteil der geplanten Arbeitszeit aus. ` +
      `Dies erfordert organisatorische Massnahmen zur Sicherstellung des Betriebs.`,
    recommendedActions: [
      "Ursachenanalyse: Verteilung nach Abwesenheitsgruenden auswerten",
      "Vertretungspool und Springerkonzept evaluieren",
      "Urlaubsplanung koordinieren zur Vermeidung von Engpaessen",
      "Betriebliches Gesundheitsmanagement staerken (praeventiv)",
      "Arbeitsorganisation auf belastungsoptimierende Gestaltung pruefen",
    ],
    metric: "absenceRate",
    currentValue: snapshot.metrics.absenceRatePercent,
    thresholdValue: thresholds.absenceRateCritical,
    aggregationLevel: snapshot.aggregationLevel,
    groupKey: snapshot.groupKey,
  });
};

/**
 * Regel: Erhoehte Abwesenheit Warning
 */
const ruleAbsenceElevatedWarning: AlertRule = (snapshot, thresholds) => {
  if (
    snapshot.metrics.absenceRatePercent <= thresholds.absenceRateWarn ||
    snapshot.metrics.absenceRatePercent > thresholds.absenceRateCritical
  ) {
    return null;
  }

  return createAlert({
    code: HrAlertCode.HR_ABSENCE_ELEVATED,
    severity: "warn",
    title: "Erhoehte Abwesenheitsquote",
    explanation:
      `Die Abwesenheitsquote von ${snapshot.metrics.absenceRatePercent.toFixed(1)}% liegt ueber dem Branchendurchschnitt. ` +
      `Fruehzeitige Massnahmen koennen eine Eskalation verhindern.`,
    recommendedActions: [
      "Abwesenheitsmuster analysieren (Wochentage, Zeitraeume)",
      "Urlaubsplanung besser koordinieren",
      "Praeventive Gesundheitsangebote evaluieren",
      "Flexible Arbeitszeitmodelle als Option pruefen",
    ],
    metric: "absenceRate",
    currentValue: snapshot.metrics.absenceRatePercent,
    thresholdValue: thresholds.absenceRateWarn,
    aggregationLevel: snapshot.aggregationLevel,
    groupKey: snapshot.groupKey,
  });
};

/**
 * Regel: Erhoehte Ueberstunden (dedizierter Alert)
 */
const ruleOvertimeElevated: AlertRule = (snapshot, thresholds) => {
  // Nur wenn bereits andere Alerts existieren und Overtime im Warning-Bereich
  if (
    snapshot.metrics.overtimeRatePercent <= thresholds.overtimeRateWarn ||
    snapshot.metrics.overtimeRatePercent > thresholds.overtimeRateCritical
  ) {
    return null;
  }

  return createAlert({
    code: HrAlertCode.HR_OVERTIME_ELEVATED,
    severity: "warn",
    title: "Ueberstundenquote ueber Normalniveau",
    explanation:
      `Die aggregierte Ueberstundenquote von ${snapshot.metrics.overtimeRatePercent.toFixed(1)}% zeigt erhoehte Arbeitslast. ` +
      `Zeitnaher Ausgleich ist empfohlen.`,
    recommendedActions: [
      "Freizeitausgleich zeitnah ermoeglichen",
      "Ursachen fuer Mehrarbeit identifizieren",
      "Terminplanung auf Kapazitaet abstimmen",
    ],
    metric: "overtimeRate",
    currentValue: snapshot.metrics.overtimeRatePercent,
    thresholdValue: thresholds.overtimeRateWarn,
    aggregationLevel: snapshot.aggregationLevel,
    groupKey: snapshot.groupKey,
  });
};

/**
 * Regel: Alle KPIs im gruenen Bereich
 */
const ruleAllHealthy: AlertRule = (snapshot, thresholds) => {
  const isFteOk =
    snapshot.metrics.fteQuote >= thresholds.fteGapWarn;
  const isAbsenceOk =
    snapshot.metrics.absenceRatePercent <= thresholds.absenceRateWarn;
  const isOvertimeOk =
    snapshot.metrics.overtimeRatePercent <= thresholds.overtimeRateWarn;

  if (!isFteOk || !isAbsenceOk || !isOvertimeOk) return null;

  return createAlert({
    code: HrAlertCode.HR_ALL_HEALTHY,
    severity: "info",
    title: "Personalbereich stabil",
    explanation:
      "Alle aggregierten HR-Kennzahlen liegen im Normalbereich. " +
      "Die Personalkapazitaet entspricht dem Bedarf.",
    recommendedActions: [
      "Regelmaessiges Monitoring fortsetzen",
      "Kapazitaetsplanung quartalsweise ueberpruefen",
      "Praeventive Massnahmen zur Stabilitaetssicherung beibehalten",
    ],
    metric: "overall",
    currentValue: 1,
    thresholdValue: 1,
    aggregationLevel: snapshot.aggregationLevel,
    groupKey: snapshot.groupKey,
  });
};

// ============================================================================
// Rule Registry
// ============================================================================

/**
 * Alle registrierten Alert-Regeln.
 * Reihenfolge: Critical vor Warning vor Info.
 */
const ALERT_RULES: AlertRule[] = [
  // Kapazitaet
  ruleCapacityGapCritical,
  ruleCapacityGapWarning,

  // Systemische Ueberlastung
  ruleSystemOverloadCritical,
  ruleSystemOverloadWarning,

  // Abwesenheit
  ruleAbsenceElevatedCritical,
  ruleAbsenceElevatedWarning,

  // Ueberstunden (dediziert)
  ruleOvertimeElevated,

  // Positiv (immer zuletzt)
  ruleAllHealthy,
];

// ============================================================================
// Main Alert Generation Function
// ============================================================================

/**
 * Generiert DSGVO-konforme Alerts aus einem KPI-Snapshot.
 *
 * @param snapshot - KPI-Snapshot
 * @param thresholds - Optionale Schwellwerte
 * @returns Array von Alerts, sortiert nach Severity
 */
export function generateHrAlerts(
  snapshot: HrKpiSnapshot,
  thresholds: HrThresholds = DEFAULT_HR_THRESHOLDS
): HrAlert[] {
  const alerts: HrAlert[] = [];

  for (const rule of ALERT_RULES) {
    const alert = rule(snapshot, thresholds);
    if (alert !== null) {
      alerts.push(alert);
    }
  }

  // Sortiere nach Severity: critical > warn > info
  const severityOrder: Record<HrAlertSeverity, number> = {
    critical: 0,
    warn: 1,
    info: 2,
  };

  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Entferne "all healthy" wenn andere Alerts existieren
  if (alerts.length > 1) {
    const healthyIndex = alerts.findIndex(
      (a) => a.code === HrAlertCode.HR_ALL_HEALTHY
    );
    if (healthyIndex !== -1) {
      alerts.splice(healthyIndex, 1);
    }
  }

  return alerts;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Erstellt einen Alert und validiert die Texte auf Compliance.
 */
function createAlert(params: {
  code: HrAlertCode;
  severity: HrAlertSeverity;
  title: string;
  explanation: string;
  recommendedActions: string[];
  metric: string;
  currentValue: number;
  thresholdValue: number;
  aggregationLevel: HrAggregationLevel;
  groupKey: string;
}): HrAlert {
  // Compliance-Check fuer alle Texte
  try {
    assertTextCompliance(params.title);
    assertTextCompliance(params.explanation);
    for (const action of params.recommendedActions) {
      assertTextCompliance(action);
    }
  } catch (e) {
    if (e instanceof HrComplianceError) {
      throw new HrComplianceError(
        `Alert-Text Compliance-Fehler in ${params.code}: ${e.message}`
      );
    }
    throw e;
  }

  return {
    code: params.code,
    severity: params.severity,
    title: params.title,
    explanation: params.explanation,
    recommendedActions: params.recommendedActions,
    metric: params.metric,
    currentValue: params.currentValue,
    thresholdValue: params.thresholdValue,
    aggregationLevel: params.aggregationLevel,
    groupKey: params.groupKey,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Filtert Alerts nach Severity.
 */
export function filterAlertsBySeverity(
  alerts: HrAlert[],
  severity: HrAlertSeverity
): HrAlert[] {
  return alerts.filter((a) => a.severity === severity);
}

/**
 * Prueft ob kritische Alerts existieren.
 */
export function hasCriticalAlerts(alerts: HrAlert[]): boolean {
  return alerts.some((a) => a.severity === "critical");
}

/**
 * Ermittelt die hoechste Severity.
 */
export function getHighestSeverity(alerts: HrAlert[]): HrAlertSeverity | null {
  if (alerts.length === 0) return null;
  if (alerts.some((a) => a.severity === "critical")) return "critical";
  if (alerts.some((a) => a.severity === "warn")) return "warn";
  return "info";
}

/**
 * Gruppiert Alerts nach Code.
 */
export function groupAlertsByCode(
  alerts: HrAlert[]
): Record<HrAlertCode, HrAlert[]> {
  const grouped: Partial<Record<HrAlertCode, HrAlert[]>> = {};

  for (const alert of alerts) {
    if (!grouped[alert.code]) {
      grouped[alert.code] = [];
    }
    grouped[alert.code]!.push(alert);
  }

  return grouped as Record<HrAlertCode, HrAlert[]>;
}

// ============================================================================
// Exports
// ============================================================================

export {
  ALERT_RULES,
  ruleCapacityGapCritical,
  ruleCapacityGapWarning,
  ruleSystemOverloadCritical,
  ruleSystemOverloadWarning,
  ruleAbsenceElevatedCritical,
  ruleAbsenceElevatedWarning,
  ruleOvertimeElevated,
  ruleAllHealthy,
};
