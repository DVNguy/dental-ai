/**
 * HR Overview API Contract (v1.0)
 *
 * Einheitliche Quelle der Wahrheit fuer:
 * - Backend: Response-Validierung (DEV-Mode)
 * - Frontend: Type-Safety + Runtime-Parsing
 * - Tests: Contract-Verifikation
 *
 * Endpoint: GET /api/practices/:id/hr/overview
 *
 * DSGVO-KONFORM: Keine personenbezogenen IDs (staffId, employeeId, personId)
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

/**
 * Aggregationsebene im Response (uppercase wie im Backend-Enum)
 */
export const HrAggregationLevelEnum = z.enum(["PRACTICE", "ROLE"]);
export type HrAggregationLevel = z.infer<typeof HrAggregationLevelEnum>;

/**
 * Angeforderte Ebene im Request (lowercase wie Query-Parameter)
 */
export const HrRequestedLevelEnum = z.enum(["practice", "role"]);
export type HrRequestedLevel = z.infer<typeof HrRequestedLevelEnum>;

/**
 * Alert-Severity
 */
export const HrAlertSeverityEnum = z.enum(["info", "warn", "critical"]);
export type HrAlertSeverity = z.infer<typeof HrAlertSeverityEnum>;

/**
 * KPI-Status
 */
export const HrKpiStatusEnum = z.enum(["ok", "warning", "critical"]);
export type HrKpiStatus = z.infer<typeof HrKpiStatusEnum>;

// ============================================================================
// Component Schemas
// ============================================================================

/**
 * HR Alert Schema - Neutral, ohne Personenbezug
 * Entspricht server/services/hr/hrTypes.ts HrAlert Interface
 */
export const HrAlertSchema = z.object({
  /** Alert-Code (string, z.B. "UNDERSTAFFING", "HIGH_ABSENCE") */
  code: z.string(),
  /** Schweregrad */
  severity: HrAlertSeverityEnum,
  /** Titel (neutral, organisatorisch) */
  title: z.string(),
  /** Erklaerung (ohne Personenbezug) */
  explanation: z.string(),
  /** Empfohlene Massnahmen */
  recommendedActions: z.array(z.string()),
  /** Betroffene Metrik */
  metric: z.string(),
  /** Aktueller Wert */
  currentValue: z.number(),
  /** Schwellwert */
  thresholdValue: z.number(),
  /** Aggregationsebene */
  aggregationLevel: HrAggregationLevelEnum,
  /** Gruppenschluessel */
  groupKey: z.string(),
});
export type HrAlert = z.infer<typeof HrAlertSchema>;

/**
 * Audit-Metadaten Schema
 * Entspricht server/services/hr/hrTypes.ts HrAuditMetadata Interface
 *
 * HINWEIS: createdAt ist string (ISO), da JSON.stringify Date zu string konvertiert
 */
export const HrAuditSchema = z.object({
  /** Aggregationsebene */
  aggregationLevel: HrAggregationLevelEnum,
  /** Verwendeter k-Wert fuer Anonymitaet */
  kUsed: z.number(),
  /** Rechtsgrundlage */
  legalBasis: z.string(),
  /** Erstellungszeitpunkt (ISO string - JSON serialisiert Date automatisch) */
  createdAt: z.string(),
  /** Version des Compliance-Moduls */
  complianceVersion: z.string(),
});
export type HrAudit = z.infer<typeof HrAuditSchema>;

/**
 * KPI-Metriken Schema
 * Entspricht server/services/hr/hrTypes.ts HrKpiMetrics Interface
 */
export const HrKpiMetricsSchema = z.object({
  /** FTE-Quote */
  fteQuote: z.number(),
  /** Aktuelle FTE */
  currentFte: z.number(),
  /** Ziel-FTE */
  targetFte: z.number(),
  /** FTE-Differenz */
  fteDelta: z.number(),
  /** Abwesenheitsquote in Prozent */
  absenceRatePercent: z.number(),
  /** Ueberstundenquote in Prozent */
  overtimeRatePercent: z.number(),
  /** Personalkosten-Quote (nullable - nicht immer verfuegbar) */
  laborCostRatioPercent: z.number().nullable(),
  /** Gesamt-Status */
  overallStatus: HrKpiStatusEnum,
});
export type HrKpiMetrics = z.infer<typeof HrKpiMetricsSchema>;

/**
 * KPI-Snapshot Schema - Ein aggregierter Datenpunkt
 * Entspricht server/services/hr/hrTypes.ts HrKpiSnapshot Interface
 *
 * HINWEIS:
 * - practiceId ist required (Controller setzt es immer)
 * - periodStart/periodEnd sind strings (JSON serialisiert Date automatisch)
 */
export const HrKpiSnapshotSchema = z.object({
  /** Eindeutige ID */
  id: z.string(),
  /** Praxis-ID (Controller setzt dies immer) */
  practiceId: z.string(),
  /** Zeitraum Start (ISO string - JSON serialisiert Date automatisch) */
  periodStart: z.string(),
  /** Zeitraum Ende (ISO string - JSON serialisiert Date automatisch) */
  periodEnd: z.string(),
  /** Aggregationsebene */
  aggregationLevel: HrAggregationLevelEnum,
  /** Gruppen-Key (z.B. "practice", "ZFA", "DH") */
  groupKey: z.string(),
  /** Gruppengroesse (fuer k-Anonymitaet) */
  groupSize: z.number(),
  /** KPI-Metriken */
  metrics: HrKpiMetricsSchema,
  /** Audit-Informationen */
  audit: HrAuditSchema,
});
export type HrKpiSnapshot = z.infer<typeof HrKpiSnapshotSchema>;

/**
 * Alerts gruppiert nach Snapshot
 */
export const SnapshotAlertsSchema = z.object({
  /** GroupKey des Snapshots (z.B. "practice", "ZFA") */
  groupKey: z.string(),
  /** Aggregationsebene des Snapshots */
  aggregationLevel: HrAggregationLevelEnum,
  /** Alerts fuer diesen Snapshot */
  alerts: z.array(HrAlertSchema),
});
export type SnapshotAlerts = z.infer<typeof SnapshotAlertsSchema>;

/**
 * Compliance-Informationen im Response
 */
export const HrComplianceInfoSchema = z.object({
  /** Version des Compliance-Moduls */
  version: z.string(),
  /** Verwendeter k-Wert */
  kMin: z.number(),
  /** Rechtsgrundlage */
  legalBasis: z.string(),
});
export type HrComplianceInfo = z.infer<typeof HrComplianceInfoSchema>;

// ============================================================================
// Main Response Schema
// ============================================================================

/**
 * Vollstaendiges Response-Schema fuer GET /api/practices/:id/hr/overview
 *
 * DSGVO-konform: Keine personenbezogenen Daten
 */
export const DsgvoHrOverviewResponseSchema = z.object({
  /** Zeitstempel der Abfrage (ISO string) */
  timestamp: z.string(),
  /** Zeitraum Start (ISO string) */
  periodStart: z.string(),
  /** Zeitraum Ende (ISO string) */
  periodEnd: z.string(),
  /** Angefragte Aggregationsebene */
  requestedLevel: HrRequestedLevelEnum,
  /** Effektive Aggregationsebene (kann bei Fallback abweichen) */
  aggregationLevel: HrRequestedLevelEnum,
  /** KPI-Snapshots (DSGVO-konform) */
  snapshots: z.array(HrKpiSnapshotSchema),
  /** Alerts pro Snapshot (neutral, ohne Personenbezug) */
  alertsBySnapshot: z.array(SnapshotAlertsSchema),
  /** Compliance-Metadaten */
  compliance: HrComplianceInfoSchema,
  /** Warnungen (z.B. bei kMin < 5, Fallback auf PRACTICE) */
  warnings: z.array(z.string()),
});
export type DsgvoHrOverviewResponse = z.infer<typeof DsgvoHrOverviewResponseSchema>;

// ============================================================================
// Request Parameter Schema (fuer Frontend-Validierung)
// ============================================================================

/**
 * Query-Parameter Schema fuer den Endpoint
 */
export const HrOverviewQueryParamsSchema = z.object({
  /** Aggregationsebene */
  level: HrRequestedLevelEnum.optional(),
  /** k-Anonymitaet Minimum */
  kMin: z.coerce.number().min(3).optional(),
  /** Zeitraum Start (YYYY-MM-DD) */
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Zeitraum Ende (YYYY-MM-DD) */
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type HrOverviewQueryParams = z.infer<typeof HrOverviewQueryParamsSchema>;

// ============================================================================
// Error Response Schema
// ============================================================================

/**
 * Error Response Schema
 */
export const HrOverviewErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  code: z.string().optional(),
});
export type HrOverviewErrorResponse = z.infer<typeof HrOverviewErrorResponseSchema>;
