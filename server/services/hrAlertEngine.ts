/**
 * HR Alert Engine
 *
 * Rule-based alert generation from KPI snapshots.
 * Produces actionable recommendations for management decisions.
 *
 * No database access, no API calls, pure functions only.
 */

// ============================================================================
// Input Types
// ============================================================================

export interface KpiSnapshot {
  fteQuote: number;                     // 0.0 - 1.0+
  absenceRatePercent: number;           // 0 - 100
  overtimeRatePercent: number;          // 0 - 100
  laborCostRatioPercent: number | null; // 0 - 100 or null if no revenue data
  sickDaysPercent?: number;             // Subset of absence (sick only)
  vacationDaysPercent?: number;         // Subset of absence (vacation only)
  staffCount?: number;                  // Total staff count
  openPositions?: number;               // Unfilled positions
  avgTenureMonths?: number;             // Average staff tenure
  turnoverRatePercent?: number;         // Annual turnover rate
}

export interface ThresholdConfig {
  fteQuote: {
    critical: number;       // Below this = critical
    warning: number;        // Below this = warning
    overstaffed: number;    // Above this = overstaffed
  };
  absenceRate: {
    warning: number;        // Above this = warning
    critical: number;       // Above this = critical
  };
  sickRate: {
    warning: number;
    critical: number;
  };
  overtimeRate: {
    warning: number;
    critical: number;
  };
  laborCostRatio: {
    warning: number;
    critical: number;
  };
  turnoverRate: {
    warning: number;
    critical: number;
  };
}

// ============================================================================
// Output Types
// ============================================================================

export type AlertSeverity = "info" | "warn" | "critical";

export interface HRAlert {
  severity: AlertSeverity;
  code: string;                         // Stable identifier (e.g., "HR_UNDERSTAFFED_CRITICAL")
  title: string;
  explanation: string;
  recommendedActions: string[];
  metric: string;                       // Which KPI triggered this
  currentValue: number;
  thresholdValue: number;
}

// ============================================================================
// Default Thresholds
// ============================================================================

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  fteQuote: {
    critical: 0.80,
    warning: 0.95,
    overstaffed: 1.15,
  },
  absenceRate: {
    warning: 5,
    critical: 10,
  },
  sickRate: {
    warning: 4,
    critical: 8,
  },
  overtimeRate: {
    warning: 10,
    critical: 20,
  },
  laborCostRatio: {
    warning: 35,
    critical: 45,
  },
  turnoverRate: {
    warning: 15,
    critical: 25,
  },
};

// ============================================================================
// Rule Interface
// ============================================================================

type AlertRule = (
  snapshot: KpiSnapshot,
  thresholds: ThresholdConfig
) => HRAlert | null;

// ============================================================================
// Individual Alert Rules
// ============================================================================

/**
 * Rule: Critical understaffing (FTE < 80%)
 */
const ruleFteCritical: AlertRule = (snapshot, thresholds) => {
  if (snapshot.fteQuote >= thresholds.fteQuote.critical) return null;

  const deficit = ((1 - snapshot.fteQuote) * 100).toFixed(0);

  return {
    severity: "critical",
    code: "HR_UNDERSTAFFED_CRITICAL",
    title: "Kritische Unterbesetzung",
    explanation: `Die Personaldecke liegt bei nur ${(snapshot.fteQuote * 100).toFixed(0)}% des Bedarfs. Ein Defizit von ${deficit}% gefährdet den Praxisbetrieb und erhöht das Burnout-Risiko erheblich.`,
    recommendedActions: [
      "Sofortige Stellenausschreibung für kritische Positionen",
      "Zeitarbeitskräfte oder Springer als Überbrückung engagieren",
      "Nicht-essentielle Termine reduzieren bis Besetzung stabilisiert",
      "Überstunden-Budget für bestehendes Team freigeben (befristet)",
      "Prüfen: Können administrative Aufgaben ausgelagert werden?",
    ],
    metric: "fteQuote",
    currentValue: snapshot.fteQuote,
    thresholdValue: thresholds.fteQuote.critical,
  };
};

/**
 * Rule: Warning understaffing (FTE 80-95%)
 */
const ruleFteWarning: AlertRule = (snapshot, thresholds) => {
  if (
    snapshot.fteQuote < thresholds.fteQuote.critical ||
    snapshot.fteQuote >= thresholds.fteQuote.warning
  ) {
    return null;
  }

  return {
    severity: "warn",
    code: "HR_UNDERSTAFFED_WARNING",
    title: "Personaldecke unter Soll",
    explanation: `Mit ${(snapshot.fteQuote * 100).toFixed(0)}% Besetzung besteht ein leichtes Defizit. Bei Krankheitsfällen kann es zu Engpässen kommen.`,
    recommendedActions: [
      "Stellenausschreibung für offene Positionen vorbereiten",
      "Bestehende Teilzeitkräfte auf Aufstockung ansprechen",
      "Praktikanten- oder Ausbildungsprogramm prüfen",
      "Schichtplanung optimieren für bessere Abdeckung",
    ],
    metric: "fteQuote",
    currentValue: snapshot.fteQuote,
    thresholdValue: thresholds.fteQuote.warning,
  };
};

/**
 * Rule: Overstaffing (FTE > 115%)
 */
const ruleFteOverstaffed: AlertRule = (snapshot, thresholds) => {
  if (snapshot.fteQuote <= thresholds.fteQuote.overstaffed) return null;

  const surplus = ((snapshot.fteQuote - 1) * 100).toFixed(0);

  return {
    severity: "info",
    code: "HR_OVERSTAFFED",
    title: "Überbesetzung erkannt",
    explanation: `Die Personaldecke liegt ${surplus}% über dem Bedarf. Dies kann auf Wachstumspotenzial hindeuten oder Kostenoptimierung erfordern.`,
    recommendedActions: [
      "Prüfen: Steht Praxiserweiterung oder höheres Patientenaufkommen bevor?",
      "Kapazitätsplanung mit tatsächlichem Bedarf abgleichen",
      "Bei dauerhafter Überkapazität: Stundenreduzierung oder natürliche Fluktuation abwarten",
      "Alternativ: Zusätzliche Services anbieten (Prophylaxe, Ästhetik)",
    ],
    metric: "fteQuote",
    currentValue: snapshot.fteQuote,
    thresholdValue: thresholds.fteQuote.overstaffed,
  };
};

/**
 * Rule: Critical absence rate (> 10%)
 */
const ruleAbsenceCritical: AlertRule = (snapshot, thresholds) => {
  if (snapshot.absenceRatePercent <= thresholds.absenceRate.critical) return null;

  return {
    severity: "critical",
    code: "HR_ABSENCE_CRITICAL",
    title: "Kritisch hohe Abwesenheitsquote",
    explanation: `${snapshot.absenceRatePercent.toFixed(1)}% Abwesenheit bedeutet, dass mehr als jeder zehnte Arbeitstag ausfällt. Dies deutet auf strukturelle Probleme hin.`,
    recommendedActions: [
      "Sofortige Ursachenanalyse: Krankheit vs. Urlaub vs. andere Gründe",
      "Bei hohem Krankenstand: Arbeitsplatzergonomie und Belastung prüfen",
      "Mitarbeitergespräche zur Zufriedenheit führen",
      "Betriebliches Gesundheitsmanagement einführen oder verstärken",
      "Externe Vertretung für kritische Funktionen sicherstellen",
    ],
    metric: "absenceRate",
    currentValue: snapshot.absenceRatePercent,
    thresholdValue: thresholds.absenceRate.critical,
  };
};

/**
 * Rule: Warning absence rate (5-10%)
 */
const ruleAbsenceWarning: AlertRule = (snapshot, thresholds) => {
  if (
    snapshot.absenceRatePercent <= thresholds.absenceRate.warning ||
    snapshot.absenceRatePercent > thresholds.absenceRate.critical
  ) {
    return null;
  }

  return {
    severity: "warn",
    code: "HR_ABSENCE_WARNING",
    title: "Erhöhte Abwesenheitsquote",
    explanation: `Mit ${snapshot.absenceRatePercent.toFixed(1)}% liegt die Abwesenheit über dem Branchendurchschnitt von 4-5%. Frühzeitiges Gegensteuern verhindert Eskalation.`,
    recommendedActions: [
      "Abwesenheitsmuster analysieren (Wochentage, Abteilungen)",
      "Rückkehrgespräche nach Krankheit einführen",
      "Urlaubsplanung besser koordinieren",
      "Flexible Arbeitszeiten prüfen zur Verbesserung der Work-Life-Balance",
    ],
    metric: "absenceRate",
    currentValue: snapshot.absenceRatePercent,
    thresholdValue: thresholds.absenceRate.warning,
  };
};

/**
 * Rule: Critical sick rate (> 8%) - wenn separat erfasst
 */
const ruleSickRateCritical: AlertRule = (snapshot, thresholds) => {
  if (snapshot.sickDaysPercent === undefined) return null;
  if (snapshot.sickDaysPercent <= thresholds.sickRate.critical) return null;

  return {
    severity: "critical",
    code: "HR_SICK_RATE_CRITICAL",
    title: "Alarmierend hoher Krankenstand",
    explanation: `${snapshot.sickDaysPercent.toFixed(1)}% Krankenstand deutet auf ernsthafte Probleme bei Arbeitsbelastung, Arbeitsklima oder Hygiene hin.`,
    recommendedActions: [
      "Arbeitsmedizinische Beratung einholen",
      "Anonyme Mitarbeiterbefragung zu Belastung und Zufriedenheit",
      "Infektionsschutzmaßnahmen überprüfen (besonders in Praxen wichtig)",
      "Überstunden reduzieren um Erschöpfung vorzubeugen",
      "Psychische Belastung am Arbeitsplatz evaluieren",
    ],
    metric: "sickRate",
    currentValue: snapshot.sickDaysPercent,
    thresholdValue: thresholds.sickRate.critical,
  };
};

/**
 * Rule: Critical overtime (> 20%)
 */
const ruleOvertimeCritical: AlertRule = (snapshot, thresholds) => {
  if (snapshot.overtimeRatePercent <= thresholds.overtimeRate.critical) return null;

  return {
    severity: "critical",
    code: "HR_OVERTIME_CRITICAL",
    title: "Kritische Überstundenlast",
    explanation: `${snapshot.overtimeRatePercent.toFixed(1)}% Überstunden bedeuten dauerhafte Mehrarbeit. Dies ist arbeitsrechtlich bedenklich und führt zu Burnout.`,
    recommendedActions: [
      "Sofort: Überstundenabbau durch Freizeitausgleich planen",
      "Arbeitszeit-Compliance prüfen (max. 10h/Tag lt. ArbZG)",
      "Zusätzliche Kapazität schaffen (Neueinstellung oder Zeitarbeit)",
      "Prozesse auf Effizienz prüfen: Wo geht Zeit verloren?",
      "Priorisierung: Welche Aufgaben können verschoben werden?",
    ],
    metric: "overtimeRate",
    currentValue: snapshot.overtimeRatePercent,
    thresholdValue: thresholds.overtimeRate.critical,
  };
};

/**
 * Rule: Warning overtime (10-20%)
 */
const ruleOvertimeWarning: AlertRule = (snapshot, thresholds) => {
  if (
    snapshot.overtimeRatePercent <= thresholds.overtimeRate.warning ||
    snapshot.overtimeRatePercent > thresholds.overtimeRate.critical
  ) {
    return null;
  }

  return {
    severity: "warn",
    code: "HR_OVERTIME_WARNING",
    title: "Überstunden über Normalniveau",
    explanation: `${snapshot.overtimeRatePercent.toFixed(1)}% Überstunden sind kurzfristig akzeptabel, sollten aber nicht zum Dauerzustand werden.`,
    recommendedActions: [
      "Überstunden dokumentieren und Gründe erfassen",
      "Zeitnahen Freizeitausgleich ermöglichen",
      "Schichtbesetzung und Terminplanung optimieren",
      "Prüfen ob saisonale oder strukturelle Ursache",
    ],
    metric: "overtimeRate",
    currentValue: snapshot.overtimeRatePercent,
    thresholdValue: thresholds.overtimeRate.warning,
  };
};

/**
 * Rule: Critical labor cost ratio (> 45%)
 */
const ruleLaborCostCritical: AlertRule = (snapshot, thresholds) => {
  if (snapshot.laborCostRatioPercent === null) return null;
  if (snapshot.laborCostRatioPercent <= thresholds.laborCostRatio.critical) return null;

  return {
    severity: "critical",
    code: "HR_LABOR_COST_CRITICAL",
    title: "Personalkosten kritisch hoch",
    explanation: `${snapshot.laborCostRatioPercent.toFixed(1)}% des Umsatzes für Personal gefährdet die wirtschaftliche Tragfähigkeit der Praxis.`,
    recommendedActions: [
      "Sofortige Kostenanalyse: Wo liegen die größten Kostentreiber?",
      "Umsatzsteigerung prüfen: Höhere Auslastung, neue Services",
      "Bei Neubesetzungen: Gehaltsstrukturen marktkonform prüfen",
      "Prozesseffizienz steigern um gleichen Output mit weniger Stunden",
      "Outsourcing-Optionen für nicht-medizinische Tätigkeiten prüfen",
    ],
    metric: "laborCostRatio",
    currentValue: snapshot.laborCostRatioPercent,
    thresholdValue: thresholds.laborCostRatio.critical,
  };
};

/**
 * Rule: Warning labor cost ratio (35-45%)
 */
const ruleLaborCostWarning: AlertRule = (snapshot, thresholds) => {
  if (snapshot.laborCostRatioPercent === null) return null;
  if (
    snapshot.laborCostRatioPercent <= thresholds.laborCostRatio.warning ||
    snapshot.laborCostRatioPercent > thresholds.laborCostRatio.critical
  ) {
    return null;
  }

  return {
    severity: "warn",
    code: "HR_LABOR_COST_WARNING",
    title: "Personalkosten im oberen Bereich",
    explanation: `Mit ${snapshot.laborCostRatioPercent.toFixed(1)}% Personalkostenquote bleibt wenig Spielraum. Branchenschnitt liegt bei 25-35%.`,
    recommendedActions: [
      "Regelmäßiges Controlling der Personalkosten einführen",
      "Bei Gehaltserhöhungen: Produktivitätssteigerung einplanen",
      "Digitalisierung zur Effizienzsteigerung nutzen",
      "Umsatz pro Mitarbeiter als KPI tracken",
    ],
    metric: "laborCostRatio",
    currentValue: snapshot.laborCostRatioPercent,
    thresholdValue: thresholds.laborCostRatio.warning,
  };
};

/**
 * Rule: High turnover rate (> 25%)
 */
const ruleTurnoverCritical: AlertRule = (snapshot, thresholds) => {
  if (snapshot.turnoverRatePercent === undefined) return null;
  if (snapshot.turnoverRatePercent <= thresholds.turnoverRate.critical) return null;

  return {
    severity: "critical",
    code: "HR_TURNOVER_CRITICAL",
    title: "Kritisch hohe Fluktuation",
    explanation: `${snapshot.turnoverRatePercent.toFixed(0)}% jährliche Fluktuation bedeutet hohe Rekrutierungs- und Einarbeitungskosten sowie Wissensverlust.`,
    recommendedActions: [
      "Exit-Interviews systematisch auswerten",
      "Gehalts- und Benefits-Struktur mit Markt vergleichen",
      "Karrierepfade und Entwicklungsmöglichkeiten aufzeigen",
      "Führungskultur evaluieren (360°-Feedback)",
      "Onboarding-Prozess verbessern für bessere Integration",
    ],
    metric: "turnoverRate",
    currentValue: snapshot.turnoverRatePercent,
    thresholdValue: thresholds.turnoverRate.critical,
  };
};

/**
 * Rule: Elevated turnover rate (15-25%)
 */
const ruleTurnoverWarning: AlertRule = (snapshot, thresholds) => {
  if (snapshot.turnoverRatePercent === undefined) return null;
  if (
    snapshot.turnoverRatePercent <= thresholds.turnoverRate.warning ||
    snapshot.turnoverRatePercent > thresholds.turnoverRate.critical
  ) {
    return null;
  }

  return {
    severity: "warn",
    code: "HR_TURNOVER_WARNING",
    title: "Erhöhte Mitarbeiterfluktuation",
    explanation: `${snapshot.turnoverRatePercent.toFixed(0)}% Fluktuation liegt über dem Branchendurchschnitt. Jede Neubesetzung kostet ca. 6-9 Monatsgehälter.`,
    recommendedActions: [
      "Mitarbeiterzufriedenheit regelmäßig erfassen",
      "Bleibeprämien für Schlüsselpositionen erwägen",
      "Flexible Arbeitszeitmodelle anbieten",
      "Teambuilding und Unternehmenskultur stärken",
    ],
    metric: "turnoverRate",
    currentValue: snapshot.turnoverRatePercent,
    thresholdValue: thresholds.turnoverRate.warning,
  };
};

/**
 * Rule: Positive - All KPIs in healthy range
 */
const ruleAllHealthy: AlertRule = (snapshot, thresholds) => {
  const isFteOk =
    snapshot.fteQuote >= thresholds.fteQuote.warning &&
    snapshot.fteQuote <= thresholds.fteQuote.overstaffed;
  const isAbsenceOk = snapshot.absenceRatePercent <= thresholds.absenceRate.warning;
  const isOvertimeOk = snapshot.overtimeRatePercent <= thresholds.overtimeRate.warning;
  const isLaborCostOk =
    snapshot.laborCostRatioPercent === null ||
    snapshot.laborCostRatioPercent <= thresholds.laborCostRatio.warning;

  if (!isFteOk || !isAbsenceOk || !isOvertimeOk || !isLaborCostOk) return null;

  return {
    severity: "info",
    code: "HR_ALL_HEALTHY",
    title: "Personalbereich im grünen Bereich",
    explanation: "Alle HR-Kennzahlen liegen im Normalbereich. Weiter so!",
    recommendedActions: [
      "Monatliches Monitoring beibehalten",
      "Mitarbeiter-Feedback einholen zur kontinuierlichen Verbesserung",
      "Best Practices dokumentieren für Krisenzeiten",
    ],
    metric: "overall",
    currentValue: 1,
    thresholdValue: 1,
  };
};

// ============================================================================
// Rule Registry
// ============================================================================

/**
 * All registered alert rules.
 * Order matters: Critical rules are checked before warnings.
 * Add new rules here to extend the engine.
 */
const ALERT_RULES: AlertRule[] = [
  // FTE Rules
  ruleFteCritical,
  ruleFteWarning,
  ruleFteOverstaffed,

  // Absence Rules
  ruleAbsenceCritical,
  ruleAbsenceWarning,
  ruleSickRateCritical,

  // Overtime Rules
  ruleOvertimeCritical,
  ruleOvertimeWarning,

  // Cost Rules
  ruleLaborCostCritical,
  ruleLaborCostWarning,

  // Turnover Rules
  ruleTurnoverCritical,
  ruleTurnoverWarning,

  // Positive Rule (always last)
  ruleAllHealthy,
];

// ============================================================================
// Main Engine Function
// ============================================================================

/**
 * Generates HR alerts from a KPI snapshot.
 *
 * @param snapshot - Current KPI values
 * @param thresholds - Optional custom thresholds (uses defaults if not provided)
 * @returns Array of alerts sorted by severity (critical first)
 */
export function generateHRAlerts(
  snapshot: KpiSnapshot,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): HRAlert[] {
  const alerts: HRAlert[] = [];

  for (const rule of ALERT_RULES) {
    const alert = rule(snapshot, thresholds);
    if (alert !== null) {
      alerts.push(alert);
    }
  }

  // Sort by severity: critical > warn > info
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    warn: 1,
    info: 2,
  };

  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Remove "all healthy" if there are other alerts
  if (alerts.length > 1) {
    const healthyIndex = alerts.findIndex((a) => a.code === "HR_ALL_HEALTHY");
    if (healthyIndex !== -1) {
      alerts.splice(healthyIndex, 1);
    }
  }

  return alerts;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Filters alerts by severity.
 */
export function filterAlertsBySeverity(
  alerts: HRAlert[],
  severity: AlertSeverity
): HRAlert[] {
  return alerts.filter((a) => a.severity === severity);
}

/**
 * Checks if any critical alerts exist.
 */
export function hasCriticalAlerts(alerts: HRAlert[]): boolean {
  return alerts.some((a) => a.severity === "critical");
}

/**
 * Gets the highest severity level from alerts.
 */
export function getHighestSeverity(alerts: HRAlert[]): AlertSeverity | null {
  if (alerts.length === 0) return null;
  if (alerts.some((a) => a.severity === "critical")) return "critical";
  if (alerts.some((a) => a.severity === "warn")) return "warn";
  return "info";
}

/**
 * Groups alerts by metric for dashboard display.
 */
export function groupAlertsByMetric(
  alerts: HRAlert[]
): Record<string, HRAlert[]> {
  const grouped: Record<string, HRAlert[]> = {};

  for (const alert of alerts) {
    if (!grouped[alert.metric]) {
      grouped[alert.metric] = [];
    }
    grouped[alert.metric].push(alert);
  }

  return grouped;
}

// ============================================================================
// Export Individual Rules for Testing
// ============================================================================

export const alertRules = {
  ruleFteCritical,
  ruleFteWarning,
  ruleFteOverstaffed,
  ruleAbsenceCritical,
  ruleAbsenceWarning,
  ruleSickRateCritical,
  ruleOvertimeCritical,
  ruleOvertimeWarning,
  ruleLaborCostCritical,
  ruleLaborCostWarning,
  ruleTurnoverCritical,
  ruleTurnoverWarning,
  ruleAllHealthy,
};
