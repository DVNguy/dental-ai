/**
 * HR Module - DSGVO/ArbSchG-konforme HR-Analytics (v2.0)
 *
 * Dieses Modul exportiert alle DSGVO-konformen HR-Funktionen.
 *
 * ============================================================================
 * COMPLIANCE-UEBERSICHT (v2.0 - Praezisiert)
 * ============================================================================
 *
 * STRIKT VERBOTEN:
 * - Individual-Analytics (staffId, employeeId in KPI-Daten)
 * - Personenbezogene Gesundheits-/Risikoprofile
 * - Korrelation Krankheit <-> Ueberstunden auf Personenebene
 *
 * VERBOTEN IN HR-ANALYTICS (nicht global):
 * - Personenstammdaten (name, email, phone) in KPI-Strukturen
 * - Einzelperson-Referenzen in Alerts ("Mitarbeiter X hat...")
 *
 * ERLAUBT:
 * - Aggregierte Analysen auf Praxisebene (PRACTICE) - immer
 * - Aggregierte Analysen auf Rollenebene (ROLE) - wenn k >= kMin
 * - Organisatorische KPIs: FTE-Quote, Abwesenheitsquote, Ueberstundenquote
 * - Neutrale Alerts: "Kapazitaetsengpass", "Systemische Ueberlastung"
 * - SYSTEMISCHE Verwendung von "Stress/Burnout" (z.B. "Stresspraevention")
 *
 * k-ANONYMITAET:
 * - Default: 5 (empfohlen)
 * - Minimum: 3 (nur mit Begruendung fuer Kleinstpraxen)
 * - Unter 3: BLOCKIERT
 *
 * ============================================================================
 */

// Types
export {
  HrAggregationLevel,
  ALLOWED_ROLE_KEYS,
  type AllowedRoleKey,
  type HrAggregatedGroupInput,
  type HrPracticeInput,
  type HrKpiSnapshot,
  type HrKpiMetrics,
  type HrAuditMetadata,
  type HrThresholds,
  DEFAULT_HR_THRESHOLDS,
  HrAlertCode,
  type HrAlertSeverity,
  type HrAlert,
  type KAnonymityResult,
  type ComplianceValidationResult,
  HR_COMPLIANCE_VERSION,
  DEFAULT_LEGAL_BASIS,
  // k-Anonymitaet Konstanten
  K_ANONYMITY_ABSOLUTE_MIN,
  K_ANONYMITY_RECOMMENDED_MIN,
  validateKMin,
} from "./hrTypes";

// Compliance Guard
export {
  assertNoPersonLevel,
  enforceKAnonymity,
  sanitizeGroupKey,
  validateAggregatedInput,
  assertTextCompliance,
  filterAndAggregateByKAnonymity,
  withComplianceGuard,
  HrComplianceError,
  // Kombinierte Liste (Rueckwaertskompatibilitaet)
  FORBIDDEN_FIELDS,
  FORBIDDEN_TERMS_IN_TEXT,
  // Differenzierte Listen (v2.0)
  FORBIDDEN_ID_FIELDS,
  FORBIDDEN_IN_HR_ANALYTICS,
  FORBIDDEN_PERSONAL_TERMS,
  CONTEXT_SENSITIVE_TERMS,
} from "./hrComplianceGuard";

// KPI Engine
export {
  computePracticeSnapshot,
  computeRoleSnapshots,
  calculateFteQuote,
  calculateAbsenceRate,
  calculateOvertimeRate,
  determineOverallStatus,
  aggregateGroups,
} from "./hrKpi";

// Alerts
export {
  generateHrAlerts,
  filterAlertsBySeverity,
  hasCriticalAlerts,
  getHighestSeverity,
  groupAlertsByCode,
} from "./hrAlerts";
