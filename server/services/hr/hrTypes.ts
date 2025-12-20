/**
 * HR Types - DSGVO/ArbSchG-konforme Typdefinitionen
 *
 * WICHTIG: Dieses Modul definiert strikt datenschutzkonforme Typen.
 * - KEINE personenbezogenen IDs (staffId, employeeId) in Snapshots oder Alerts
 * - NUR aggregierte Daten auf Practice- oder Role-Level
 * - k-Anonymitaet wird durch den Compliance Guard erzwungen
 *
 * Rechtsgrundlage: DSGVO Art. 5 (Datenminimierung), Art. 25 (Privacy by Design)
 */

// ============================================================================
// Aggregation Level - NUR PRACTICE oder ROLE erlaubt
// ============================================================================

/**
 * Erlaubte Aggregationsebenen fuer HR-Analysen.
 * PERSON-Level ist VERBOTEN und wird durch den Compliance Guard blockiert.
 */
export enum HrAggregationLevel {
  /** Gesamte Praxis - immer erlaubt */
  PRACTICE = "PRACTICE",
  /** Rollenbasiert (ZFA, DH, Zahnarzt, etc.) - nur bei k >= kMin */
  ROLE = "ROLE",
}

// ============================================================================
// Whitelisted Roles - Nur diese sind als Gruppenschluessel erlaubt
// ============================================================================

/**
 * Erlaubte Rollenbezeichnungen fuer Aggregationen.
 * Verhindert Rueckschluesse auf Einzelpersonen durch exotische Rollennamen.
 */
export const ALLOWED_ROLE_KEYS = [
  "ZFA",              // Zahnmedizinische Fachangestellte
  "DH",               // Dentalhygienikerin
  "ZAHNARZT",         // Zahnarzt/Zahnaerztin
  "EMPFANG",          // Rezeption/Empfang
  "VERWALTUNG",       // Verwaltung/Administration
  "AZUBI",            // Auszubildende
  "SONSTIGE",         // Sonstige (Sammelkategorie)
] as const;

export type AllowedRoleKey = typeof ALLOWED_ROLE_KEYS[number];

// ============================================================================
// Aggregated Input Types - KEINE personenbezogenen Felder
// ============================================================================

/**
 * Voraggregierte Eingabedaten fuer eine Gruppe (Praxis oder Rolle).
 * WICHTIG: Enthaelt KEINE staffId oder individuelle Zuordnungen.
 */
export interface HrAggregatedGroupInput {
  /** Eindeutiger Schluessel: "practice" oder Rollenname */
  groupKey: string;
  /** Anzahl Personen in dieser Gruppe */
  headcount: number;
  /** Summe FTE in dieser Gruppe */
  totalFte: number;
  /** Summe Wochenstunden (vertraglich) */
  totalContractedHoursPerWeek: number;
  /** Summe Ueberstunden im Zeitraum (Minuten) */
  totalOvertimeMinutes: number;
  /** Summe Abwesenheitstage im Zeitraum */
  totalAbsenceDays: number;
  /** Abwesenheitstage nach Typ (aggregiert) */
  absenceByType: {
    sick: number;
    vacation: number;
    training: number;
    other: number;
  };
}

/**
 * Eingabedaten fuer die KPI-Berechnung auf Praxisebene.
 */
export interface HrPracticeInput {
  /** Zeitraum Start */
  periodStart: Date;
  /** Zeitraum Ende */
  periodEnd: Date;
  /** Soll-FTE fuer die Praxis */
  targetFte: number;
  /** Arbeitstage pro Woche */
  workdaysPerWeek: number;
  /** Monatsumsatz (optional, fuer Personalkostenquote) */
  monthlyRevenue?: number;
  /** Aggregierte Daten pro Gruppe */
  groups: HrAggregatedGroupInput[];
}

// ============================================================================
// KPI Snapshot - DSGVO-konform
// ============================================================================

/**
 * Metriken eines HR-KPI-Snapshots - nur aggregierte Werte.
 */
export interface HrKpiMetrics {
  /** FTE-Quote: aktuelle FTE / Soll-FTE (0.0 - 2.0) */
  fteQuote: number;
  /** Aktuelle Gesamt-FTE */
  currentFte: number;
  /** Soll-FTE */
  targetFte: number;
  /** FTE-Differenz (negativ = Unterbesetzung) */
  fteDelta: number;
  /** Abwesenheitsquote in Prozent */
  absenceRatePercent: number;
  /** Ueberstundenquote in Prozent */
  overtimeRatePercent: number;
  /** Personalkostenquote in Prozent (null wenn kein Umsatz) */
  laborCostRatioPercent: number | null;
  /** Gesamtstatus */
  overallStatus: "critical" | "warning" | "ok";
}

/**
 * Audit-Metadaten fuer Compliance-Nachweise.
 */
export interface HrAuditMetadata {
  /** Aggregationsebene dieses Snapshots */
  aggregationLevel: HrAggregationLevel;
  /** k-Wert der Anonymitaet (Mindestgruppengroesse) */
  kUsed: number;
  /** Rechtsgrundlage der Verarbeitung */
  legalBasis: string;
  /** Timestamp der Erstellung */
  createdAt: Date;
  /** Version des Compliance-Moduls */
  complianceVersion: string;
}

/**
 * DSGVO-konformer KPI-Snapshot.
 * Enthaelt KEINE personenbezogenen Daten.
 */
export interface HrKpiSnapshot {
  /** Snapshot-ID (UUID) */
  id: string;
  /** Praxis-ID */
  practiceId: string;
  /** Zeitraum Start */
  periodStart: Date;
  /** Zeitraum Ende */
  periodEnd: Date;
  /** Aggregationsebene */
  aggregationLevel: HrAggregationLevel;
  /** Gruppenschluessel (bei ROLE: Rollenname, bei PRACTICE: "practice") */
  groupKey: string;
  /** Anzahl Personen in der Gruppe (fuer k-Anonymitaet) */
  groupSize: number;
  /** KPI-Metriken */
  metrics: HrKpiMetrics;
  /** Audit-Metadaten */
  audit: HrAuditMetadata;
}

// ============================================================================
// Thresholds - Konfigurierbare Schwellwerte
// ============================================================================

/**
 * Konfigurierbare Schwellwerte fuer HR-KPIs.
 */
export interface HrThresholds {
  /** FTE-Quote Warning-Schwelle (z.B. 0.95 = 95%) */
  fteGapWarn: number;
  /** FTE-Quote Critical-Schwelle (z.B. 0.80 = 80%) */
  fteGapCritical: number;
  /** Abwesenheitsquote Warning (Prozent) */
  absenceRateWarn: number;
  /** Abwesenheitsquote Critical (Prozent) */
  absenceRateCritical: number;
  /** Ueberstundenquote Warning (Prozent) */
  overtimeRateWarn: number;
  /** Ueberstundenquote Critical (Prozent) */
  overtimeRateCritical: number;
  /** Auslastung Warning (optional) */
  utilizationWarn?: number;
  /**
   * Minimale Gruppengroesse fuer k-Anonymitaet.
   *
   * RECHTLICHER HINTERGRUND:
   * - Default: 5 (empfohlen fuer DSGVO-Konformitaet)
   * - Minimum: 3 (nur mit dokumentierter Begruendung, z.B. Kleinstpraxis)
   * - Unter 3: NICHT ERLAUBT (Individual-Rueckschluesse moeglich)
   *
   * Bei kMin < 5 wird eine Warnung protokolliert.
   */
  kMin: number;
  /** Multiplikator fuer Critical-Level */
  criticalMultiplier: number;
}

/** Absolutes Minimum fuer k-Anonymitaet - darunter keine Analyse erlaubt */
export const K_ANONYMITY_ABSOLUTE_MIN = 3;

/** Empfohlenes Minimum fuer k-Anonymitaet (DSGVO Best Practice) */
export const K_ANONYMITY_RECOMMENDED_MIN = 5;

/**
 * Standard-Schwellwerte (branchenueblich fuer Zahnarztpraxen).
 */
export const DEFAULT_HR_THRESHOLDS: HrThresholds = {
  fteGapWarn: 0.95,
  fteGapCritical: 0.80,
  absenceRateWarn: 5,
  absenceRateCritical: 10,
  overtimeRateWarn: 10,
  overtimeRateCritical: 20,
  utilizationWarn: 85,
  kMin: K_ANONYMITY_RECOMMENDED_MIN, // 5 ist Standard
  criticalMultiplier: 2,
};

/**
 * Validiert und normalisiert kMin-Wert.
 *
 * @param kMin - Gewuenschter k-Wert
 * @returns Validierter k-Wert (mindestens K_ANONYMITY_ABSOLUTE_MIN)
 * @throws Error wenn kMin < K_ANONYMITY_ABSOLUTE_MIN
 */
export function validateKMin(kMin: number): { value: number; warning?: string } {
  if (kMin < K_ANONYMITY_ABSOLUTE_MIN) {
    throw new Error(
      `k-Anonymitaet: kMin=${kMin} ist unter dem absoluten Minimum von ${K_ANONYMITY_ABSOLUTE_MIN}. ` +
      `Individual-Rueckschluesse waeren moeglich. Analyse wird blockiert.`
    );
  }

  if (kMin < K_ANONYMITY_RECOMMENDED_MIN) {
    return {
      value: kMin,
      warning: `k-Anonymitaet: kMin=${kMin} liegt unter dem empfohlenen Wert von ${K_ANONYMITY_RECOMMENDED_MIN}. ` +
        `Dies ist nur fuer Kleinstpraxen mit dokumentierter Begruendung zulaessig.`,
    };
  }

  return { value: kMin };
}

// ============================================================================
// Alert Types - Neutral, nicht personenbezogen
// ============================================================================

/**
 * Alert-Codes - organisatorisch, nicht personenbezogen.
 */
export enum HrAlertCode {
  /** Kapazitaetsluecke erkannt */
  HR_CAPACITY_GAP = "HR_CAPACITY_GAP",
  /** Systemische Ueberlastung (ersetzt "Stress") */
  HR_SYSTEM_OVERLOAD = "HR_SYSTEM_OVERLOAD",
  /** Erhoehte Abwesenheit auf Gruppenebene */
  HR_ABSENCE_ELEVATED = "HR_ABSENCE_ELEVATED",
  /** Erhoehte Ueberstunden auf Gruppenebene */
  HR_OVERTIME_ELEVATED = "HR_OVERTIME_ELEVATED",
  /** Personalkosten ueber Schwelle */
  HR_COST_ELEVATED = "HR_COST_ELEVATED",
  /** Alle KPIs im gruenen Bereich */
  HR_ALL_HEALTHY = "HR_ALL_HEALTHY",
}

/**
 * Severity-Level fuer Alerts.
 */
export type HrAlertSeverity = "info" | "warn" | "critical";

/**
 * DSGVO-konformer HR-Alert.
 * Referenziert KEINE einzelnen Personen.
 */
export interface HrAlert {
  /** Alert-Code */
  code: HrAlertCode;
  /** Severity */
  severity: HrAlertSeverity;
  /** Titel (neutral, organisatorisch) */
  title: string;
  /** Erklaerung (ohne Personenbezug) */
  explanation: string;
  /** Empfohlene Massnahmen (organisatorisch) */
  recommendedActions: string[];
  /** Betroffene Metrik */
  metric: string;
  /** Aktueller Wert */
  currentValue: number;
  /** Schwellwert */
  thresholdValue: number;
  /** Aggregationsebene */
  aggregationLevel: HrAggregationLevel;
  /** Gruppenschluessel */
  groupKey: string;
}

// ============================================================================
// Compliance Guard Result Types
// ============================================================================

/**
 * Ergebnis der k-Anonymitaetspruefung.
 */
export interface KAnonymityResult {
  /** Ist die Analyse erlaubt? */
  allowed: boolean;
  /** Falls nicht erlaubt: Fallback-Level */
  fallbackLevel?: HrAggregationLevel;
  /** Grund bei Ablehnung */
  reason?: string;
}

/**
 * Ergebnis der Compliance-Validierung.
 */
export interface ComplianceValidationResult {
  /** Ist das Input valide? */
  valid: boolean;
  /** Fehler bei Ablehnung */
  errors: string[];
  /** Warnungen */
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Aktuelle Version des Compliance-Moduls */
export const HR_COMPLIANCE_VERSION = "1.0.0";

/** Standard-Rechtsgrundlage */
export const DEFAULT_LEGAL_BASIS =
  "DSGVO Art. 6(1)(f) - Berechtigtes Interesse an betrieblicher Ressourcenplanung, " +
  "DSGVO Art. 5(1)(c) - Datenminimierung, " +
  "ArbSchG - Arbeitsschutzkonformes Monitoring auf aggregierter Ebene";
