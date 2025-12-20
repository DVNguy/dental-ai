import type { Request, Response } from "express";

// Contract Types - Single Source of Truth
import {
  type DsgvoHrOverviewResponse,
  type SnapshotAlerts,
  DsgvoHrOverviewResponseSchema,
} from "@shared/contracts/hrOverview.contract";

// Staffing Engine - FTE/VZÄ Bedarfsberechnung
import {
  computeStaffing,
  type StaffingInput,
  type CurrentStaffingFte,
  type StaffingResult,
  STAFFING_ENGINE_VERSION,
} from "@shared/staffingEngine";

// Re-export Contract Types fuer externe Nutzung
export type { DsgvoHrOverviewResponse, SnapshotAlerts };

import {
  computeFteDemand,
  computeAbsenceRate,
  computeOvertimeRate,
  computeLaborCostRatio,
  type StaffMember,
  type AbsenceRecord,
  type OvertimeRecord,
} from "../services/hrKpi";
import {
  generateHRAlerts,
  type KpiSnapshot,
  type HRAlert,
} from "../services/hrAlertEngine";

// DSGVO-konformes HR-Modul (v2.0)
import {
  computePracticeSnapshot,
  computeRoleSnapshots,
  generateHrAlerts as generateDsgvoAlerts,
  validateAggregatedInput,
  HrAggregationLevel,
  type HrPracticeInput,
  type HrAggregatedGroupInput,
  type HrKpiSnapshot,
  type HrAlert as DsgvoHrAlert,
  type HrThresholds,
  DEFAULT_HR_THRESHOLDS,
  ALLOWED_ROLE_KEYS,
  type AllowedRoleKey,
  HrComplianceError,
  validateKMin,
} from "../services/hr";

// ============================================================================
// Types (Legacy + DI)
// ============================================================================

/**
 * Legacy Response Type fuer /api/practices/:id/hr/kpis
 */
export interface HRKpiResponse {
  timestamp: string;
  periodStart: string;
  periodEnd: string;
  fte: {
    current: number;
    target: number;
    quote: number;
    delta: number;
    status: "critical" | "warning" | "ok" | "overstaffed";
  };
  absence: {
    rate: number;
    totalDays: number;
    byType: Record<string, number>;
    status: "critical" | "warning" | "ok";
  };
  overtime: {
    rate: number;
    totalHours: number;
    avgPerStaff: number;
    status: "critical" | "warning" | "ok";
  };
  laborCost: {
    ratio: number;
    totalCost: number;
    costPerFte: number;
    status: "critical" | "warning" | "ok";
  } | null;
  overallStatus: "critical" | "warning" | "ok";
  alerts: HRAlert[];
}

/**
 * Storage-Interface fuer Dependency Injection.
 * Ermoeglicht Tests ohne echte DB-Verbindung.
 * Verwendet minimale Typen, die sowohl mit echtem Storage als auch mit Mocks kompatibel sind.
 */
export interface HrControllerStorage {
  getStaffByPracticeId(practiceId: string): Promise<Array<{
    id: string;
    role: string;
    fte: number | null;
    weeklyHours: number | null;
    [key: string]: unknown; // Erlaubt zusaetzliche Felder
  }>>;
  getStaffAbsences(practiceId: string, periodStart: Date, periodEnd: Date): Promise<Array<{
    staffId: string;
    absenceType: string;
    days: number;
    [key: string]: unknown;
  }>>;
  getStaffOvertime(practiceId: string, periodStart: Date, periodEnd: Date): Promise<Array<{
    staffId: string;
    hours: number;
    [key: string]: unknown;
  }>>;
}

// Lazy storage import - nur fuer Default-Controller und Legacy-Endpunkt
// Tests koennen createHrController mit eigenem Storage aufrufen
let _storage: HrControllerStorage | null = null;
async function getStorage(): Promise<HrControllerStorage> {
  if (!_storage) {
    const { storage } = await import("../storage");
    _storage = storage;
  }
  return _storage;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapAbsenceType(type: string): "sick" | "vacation" | "training" | "other" {
  switch (type) {
    case "sick": return "sick";
    case "vacation": return "vacation";
    case "training": return "training";
    default: return "other";
  }
}

/**
 * Normalisiert Rollennamen auf erlaubte Werte.
 * Unbekannte Rollen werden zu "SONSTIGE".
 */
function normalizeRole(role: string): AllowedRoleKey {
  const normalized = role.toUpperCase().trim();

  // Direkte Treffer
  if ((ALLOWED_ROLE_KEYS as readonly string[]).includes(normalized)) {
    return normalized as AllowedRoleKey;
  }

  // Mapping von Varianten
  const roleMap: Record<string, AllowedRoleKey> = {
    "ZAHNMEDIZINISCHE FACHANGESTELLTE": "ZFA",
    "DENTALHYGIENIKERIN": "DH",
    "DENTAL HYGIENIST": "DH",
    "DENTIST": "ZAHNARZT",
    "ARZT": "ZAHNARZT",
    "RECEPTION": "EMPFANG",
    "REZEPTION": "EMPFANG",
    "ADMIN": "VERWALTUNG",
    "ADMINISTRATION": "VERWALTUNG",
    "APPRENTICE": "AZUBI",
    "AUSZUBILDENDER": "AZUBI",
    "AUSZUBILDENDE": "AZUBI",
  };

  return roleMap[normalized] || "SONSTIGE";
}

/**
 * Aggregiert personenbezogene Daten zu DSGVO-konformen Gruppen.
 *
 * WICHTIG: Diese Funktion ENTFERNT alle personenbezogenen IDs und
 * aggregiert die Daten auf Rollenebene, bevor sie ans HR-Modul gehen.
 */
function aggregateStaffToGroups(
  staffList: Array<{
    id: string;
    role: string;
    fte: number | null;
    weeklyHours: number | null;
  }>,
  absences: Array<{
    staffId: string;
    absenceType: string;
    days: number;
  }>,
  overtimeRecords: Array<{
    staffId: string;
    hours: number;
  }>
): HrAggregatedGroupInput[] {
  // Erstelle Map: staffId -> role (fuer spaeteren Lookup)
  const staffRoleMap = new Map<string, AllowedRoleKey>();
  staffList.forEach((s) => {
    staffRoleMap.set(s.id, normalizeRole(s.role));
  });

  // Aggregiere pro Rolle
  const roleGroups = new Map<AllowedRoleKey, {
    headcount: number;
    totalFte: number;
    totalContractedHoursPerWeek: number;
    totalOvertimeMinutes: number;
    absenceByType: { sick: number; vacation: number; training: number; other: number };
  }>();

  // Initialisiere Gruppen mit Staff-Daten
  for (const staff of staffList) {
    const role = normalizeRole(staff.role);
    const existing = roleGroups.get(role) || {
      headcount: 0,
      totalFte: 0,
      totalContractedHoursPerWeek: 0,
      totalOvertimeMinutes: 0,
      absenceByType: { sick: 0, vacation: 0, training: 0, other: 0 },
    };

    existing.headcount += 1;
    existing.totalFte += staff.fte ?? 1.0;
    existing.totalContractedHoursPerWeek += staff.weeklyHours ?? 40;

    roleGroups.set(role, existing);
  }

  // Aggregiere Abwesenheiten (nach Rolle, NICHT nach staffId)
  for (const absence of absences) {
    const role = staffRoleMap.get(absence.staffId);
    if (!role) continue; // Staff nicht gefunden

    const group = roleGroups.get(role);
    if (!group) continue;

    const absenceType = mapAbsenceType(absence.absenceType);
    group.absenceByType[absenceType] += absence.days;
  }

  // Aggregiere Ueberstunden (nach Rolle, NICHT nach staffId)
  for (const ot of overtimeRecords) {
    const role = staffRoleMap.get(ot.staffId);
    if (!role) continue;

    const group = roleGroups.get(role);
    if (!group) continue;

    // Umrechnung: Stunden -> Minuten
    group.totalOvertimeMinutes += ot.hours * 60;
  }

  // Konvertiere zu Array (ohne personenbezogene IDs!)
  const result: HrAggregatedGroupInput[] = [];
  Array.from(roleGroups.entries()).forEach(([role, data]) => {
    const totalAbsenceDays =
      data.absenceByType.sick +
      data.absenceByType.vacation +
      data.absenceByType.training +
      data.absenceByType.other;

    result.push({
      groupKey: role,
      headcount: data.headcount,
      totalFte: data.totalFte,
      totalContractedHoursPerWeek: data.totalContractedHoursPerWeek,
      totalOvertimeMinutes: data.totalOvertimeMinutes,
      totalAbsenceDays,
      absenceByType: data.absenceByType,
    });
  });

  return result;
}

/**
 * Parst ein ISO-Datum (YYYY-MM-DD) zu Date.
 * @returns Date oder null bei ungueltigem Format
 */
function parseIsoDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  // Validiere dass das Datum gueltig ist
  if (isNaN(date.getTime())) return null;
  return date;
}

// ============================================================================
// Controller Factory mit Dependency Injection
// ============================================================================

/**
 * Factory-Funktion fuer HR-Controller mit Dependency Injection.
 * Ermoeglicht Tests ohne echte DB-Verbindung.
 *
 * @param deps - Dependencies (KEIN Default - muss explizit uebergeben werden)
 * @returns Controller-Objekt mit getHrOverview
 */
export function createHrController(deps: { storage: HrControllerStorage }) {
  const { storage: storageImpl } = deps;

  /**
   * GET /api/practices/:id/hr/overview
   *
   * DSGVO-konformer HR-Overview-Endpunkt.
   *
   * Query-Parameter:
   * - level: "practice" | "role" (default: "practice")
   * - kMin: number (default: 5, minimum: 3)
   * - periodStart: YYYY-MM-DD (default: erster Tag des aktuellen Monats)
   * - periodEnd: YYYY-MM-DD (default: letzter Tag des aktuellen Monats)
   *
   * Die Aggregation erfolgt im Controller, sodass das HR-Modul
   * niemals personenbezogene Daten sieht.
   */
  async function getHrOverview(req: Request, res: Response) {
    try {
      const practiceId = req.params.id;
      const requestedLevel = (req.query.level as string) || "practice";
      const requestedKMin = req.query.kMin ? parseInt(req.query.kMin as string, 10) : undefined;

      // Warnungen sammeln
      const warnings: string[] = [];

      // k-Anonymitaet validieren
      let thresholds: HrThresholds = { ...DEFAULT_HR_THRESHOLDS };
      if (requestedKMin !== undefined) {
        try {
          const validation = validateKMin(requestedKMin);
          thresholds.kMin = validation.value;
          if (validation.warning) {
            warnings.push(validation.warning);
          }
        } catch (error) {
          return res.status(400).json({
            error: "Invalid kMin parameter",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Zeitraum parsen (mit Fallback auf aktuellen Monat)
      const now = new Date();
      let periodStart = parseIsoDate(req.query.periodStart as string);
      let periodEnd = parseIsoDate(req.query.periodEnd as string);

      // Fallback: aktueller Monat
      if (!periodStart) {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      if (!periodEnd) {
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      // Validiere: periodStart <= periodEnd
      if (periodStart > periodEnd) {
        return res.status(400).json({
          error: "Invalid period",
          message: "periodStart muss vor oder gleich periodEnd sein",
        });
      }

      // 1. Hole personenbezogene Daten aus Storage
      const staffList = await storageImpl.getStaffByPracticeId(practiceId);

      if (staffList.length === 0) {
        const emptyResponse: DsgvoHrOverviewResponse = {
          timestamp: now.toISOString(),
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          requestedLevel: requestedLevel as "practice" | "role",
          aggregationLevel: requestedLevel as "practice" | "role",
          snapshots: [],
          alertsBySnapshot: [],
          compliance: {
            version: "1.0.0",
            kMin: thresholds.kMin,
            legalBasis: "Keine Daten vorhanden",
          },
          warnings: ["Keine Mitarbeiterdaten fuer diese Praxis vorhanden"],
        };
        return res.json(emptyResponse);
      }

      // Abwesenheiten und Ueberstunden holen
      const absenceRecords = await storageImpl.getStaffAbsences(practiceId, periodStart, periodEnd);
      const overtimeRecords = await storageImpl.getStaffOvertime(practiceId, periodStart, periodEnd);

      // 2. AGGREGATION: Entferne personenbezogene IDs, gruppiere nach Rolle
      const aggregatedGroups = aggregateStaffToGroups(
        staffList.map((s) => ({
          id: s.id,
          role: s.role,
          fte: s.fte,
          weeklyHours: s.weeklyHours,
        })),
        absenceRecords.map((a) => ({
          staffId: a.staffId,
          absenceType: a.absenceType,
          days: a.days,
        })),
        overtimeRecords.map((o) => ({
          staffId: o.staffId,
          hours: o.hours,
        }))
      );

      // 3. Validiere aggregierte Daten mit validateAggregatedInput
      const inputValidation = validateAggregatedInput(aggregatedGroups, thresholds.kMin);
      if (!inputValidation.valid) {
        return res.status(400).json({
          error: "Aggregated input validation failed",
          message: inputValidation.errors.join("; "),
          code: "HR_INPUT_VALIDATION_ERROR",
        });
      }
      // Merge warnings aus validateAggregatedInput
      warnings.push(...inputValidation.warnings);

      // 4. Erstelle DSGVO-konformes Input (KEINE staffIds mehr!)
      const totalFte = aggregatedGroups.reduce((sum, g) => sum + g.totalFte, 0);
      const targetFte = Math.max(totalFte * 0.9, 3); // 90% als Ziel oder mindestens 3

      // monthlyRevenue: Nur setzen wenn aus Practice-Settings verfuegbar
      // TODO: Practice-Settings laden wenn verfuegbar
      const monthlyRevenue: number | undefined = undefined;

      const hrInput: HrPracticeInput = {
        periodStart,
        periodEnd,
        targetFte,
        workdaysPerWeek: 5,
        monthlyRevenue,
        groups: aggregatedGroups,
      };

      // 5. Berechne KPIs mit dem DSGVO-konformen Modul
      let snapshots: HrKpiSnapshot[];
      let effectiveLevel: "practice" | "role" = requestedLevel as "practice" | "role";

      if (requestedLevel === "role") {
        snapshots = computeRoleSnapshots(hrInput, thresholds);

        // Pruefe ob Fallback auf PRACTICE stattgefunden hat
        // computeRoleSnapshots gibt Practice-Snapshot zurueck wenn keine Rolle k-anonym ist
        const hasPracticeFallback = snapshots.length === 1 &&
          snapshots[0].aggregationLevel === HrAggregationLevel.PRACTICE;

        if (hasPracticeFallback) {
          effectiveLevel = "practice";
          warnings.push(
            "ROLE-Level nicht moeglich wegen k-Anonymitaet (keine Gruppe erreicht kMin=" +
            thresholds.kMin + "), Fallback auf PRACTICE."
          );
        }
      } else {
        snapshots = [computePracticeSnapshot(hrInput, thresholds)];
      }

      // 6. Setze practiceId (wird vom Controller gesetzt, nicht vom Core-Service)
      // 7. Konvertiere Date-Objekte zu ISO-Strings fuer JSON-Serialisierung
      const serializedSnapshots = snapshots.map((s) => ({
        ...s,
        practiceId,
        periodStart: s.periodStart instanceof Date ? s.periodStart.toISOString() : s.periodStart,
        periodEnd: s.periodEnd instanceof Date ? s.periodEnd.toISOString() : s.periodEnd,
        audit: {
          ...s.audit,
          createdAt: s.audit.createdAt instanceof Date ? s.audit.createdAt.toISOString() : s.audit.createdAt,
        },
      }));

      // 8. Generiere Alerts fuer JEDEN Snapshot
      const alertsBySnapshot: SnapshotAlerts[] = snapshots.map((snapshot) => ({
        groupKey: snapshot.groupKey,
        aggregationLevel: snapshot.aggregationLevel as "PRACTICE" | "ROLE",
        alerts: generateDsgvoAlerts(snapshot, thresholds),
      }));

      // 9. Response erstellen
      const response: DsgvoHrOverviewResponse = {
        timestamp: now.toISOString(),
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        requestedLevel: requestedLevel as "practice" | "role",
        aggregationLevel: effectiveLevel,
        snapshots: serializedSnapshots,
        alertsBySnapshot,
        compliance: {
          version: snapshots[0]?.audit.complianceVersion || "1.0.0",
          kMin: thresholds.kMin,
          legalBasis: snapshots[0]?.audit.legalBasis || "N/A",
        },
        warnings,
      };

      // DEV-Guard: Contract-Validierung nur wenn explizit aktiviert oder in development
      if (process.env.NODE_ENV === "development" || process.env.VALIDATE_API_CONTRACT === "1") {
        DsgvoHrOverviewResponseSchema.parse(response);
      }

      res.json(response);
    } catch (error) {
      // Compliance-Fehler separat behandeln
      if (error instanceof HrComplianceError) {
        console.error("HR Compliance Error:", error.message);
        return res.status(400).json({
          error: "Compliance violation",
          message: error.message,
          code: "HR_COMPLIANCE_ERROR",
        });
      }

      console.error("HR Overview error:", error);
      res.status(500).json({ error: "Failed to compute HR overview" });
    }
  }

  return { getHrOverview };
}

// ============================================================================
// Backwards-Compatible Exports
// ============================================================================

/**
 * GET /api/practices/:id/hr/overview
 * Backwards-Compatible Export fuer bestehende Routes.
 *
 * Laedt Storage lazy, um Tests ohne DB zu ermoeglichen.
 */
export async function getHrOverview(req: Request, res: Response) {
  const storageImpl = await getStorage();
  const controller = createHrController({ storage: storageImpl });
  return controller.getHrOverview(req, res);
}

// ============================================================================
// Legacy Endpoint (getHRKpis) - Unchanged
// ============================================================================

/**
 * GET /api/practices/:id/hr/kpis
 *
 * Returns HR KPI dashboard data for the current month
 */
export async function getHRKpis(req: Request, res: Response) {
  try {
    const practiceId = req.params.id;

    // Lazy load storage
    const storage = await getStorage();

    // Get staff data
    const staffList = await storage.getStaffByPracticeId(practiceId);

    // Map DB staff to KPI service format
    const staff: StaffMember[] = staffList.map((s: any) => ({
      id: s.id,
      role: s.role,
      fte: s.fte ?? 1.0,
      weeklyHours: s.weeklyHours ?? 40,
      hourlyCost: s.hourlyCost ?? 25,
    }));

    // Calculate period (current month)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get absences for the period
    const absenceRecords = await storage.getStaffAbsences(practiceId, periodStart, periodEnd);
    const absences: AbsenceRecord[] = absenceRecords.map((a: any) => ({
      staffId: a.staffId,
      type: mapAbsenceType(a.absenceType),
      startDate: new Date(a.startDate),
      endDate: new Date(a.endDate),
    }));

    // Get overtime for the period
    const overtimeRecords = await storage.getStaffOvertime(practiceId, periodStart, periodEnd);
    const overtime: OvertimeRecord[] = overtimeRecords.map((o: any) => ({
      staffId: o.staffId,
      date: new Date(o.date),
      overtimeHours: o.hours,
    }));

    // Target FTE based on practice size (can be configurable later)
    // For now, use staff count as target (assumed fully staffed)
    const targetFte = Math.max(staff.length * 0.9, 3); // At least 3 FTE or 90% of current

    // Compute KPIs
    const fteDemand = computeFteDemand(staff, { targetFte });
    const absenceRate = computeAbsenceRate(staff, absences, periodStart, periodEnd, { workdaysPerWeek: 5 });
    const overtimeRate = computeOvertimeRate(staff, overtime, periodStart, periodEnd);

    // Labor cost (needs monthly revenue - for now we'll skip or estimate)
    // In a real scenario, this would come from practice configuration
    const monthlyRevenue = 50000; // Placeholder - should come from practice settings
    const laborCost = monthlyRevenue > 0
      ? computeLaborCostRatio(staff, monthlyRevenue)
      : null;

    // Generate alerts
    const kpiSnapshot: KpiSnapshot = {
      fteQuote: fteDemand.fteQuote,
      absenceRatePercent: absenceRate.absenceRatePercent,
      overtimeRatePercent: overtimeRate.overtimeRatePercent,
      laborCostRatioPercent: laborCost?.laborCostRatioPercent ?? null,
      staffCount: staff.length,
    };

    const alerts = generateHRAlerts(kpiSnapshot);

    // Determine overall status
    const hasCritical = alerts.some((a) => a.severity === "critical");
    const hasWarning = alerts.some((a) => a.severity === "warn");
    const overallStatus = hasCritical ? "critical" : hasWarning ? "warning" : "ok";

    const response: HRKpiResponse = {
      timestamp: now.toISOString(),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      fte: {
        current: fteDemand.currentFte,
        target: fteDemand.targetFte,
        quote: fteDemand.fteQuote,
        delta: fteDemand.fteDelta,
        status: fteDemand.status,
      },
      absence: {
        rate: absenceRate.absenceRatePercent,
        totalDays: absenceRate.totalAbsenceDays,
        byType: absenceRate.byType,
        status: absenceRate.status,
      },
      overtime: {
        rate: overtimeRate.overtimeRatePercent,
        totalHours: overtimeRate.totalOvertimeHours,
        avgPerStaff: overtimeRate.averageOvertimePerStaff,
        status: overtimeRate.status,
      },
      laborCost: laborCost ? {
        ratio: laborCost.laborCostRatioPercent,
        totalCost: laborCost.totalLaborCost,
        costPerFte: laborCost.costPerFte,
        status: laborCost.status,
      } : null,
      overallStatus,
      alerts,
    };

    res.json(response);
  } catch (error) {
    console.error("HR KPI error:", error);
    res.status(500).json({ error: "Failed to compute HR KPIs" });
  }
}

// ============================================================================
// Staffing Engine Endpoint
// ============================================================================

/**
 * Response Type fuer Staffing Engine Endpoint.
 */
export interface StaffingDemandResponse {
  timestamp: string;
  engineVersion: string;
  input: StaffingInput;
  result: StaffingResult;
}

/**
 * POST /api/practices/:id/hr/staffing-demand
 *
 * Berechnet den optimalen Personalbedarf basierend auf Praxisstruktur.
 *
 * Request Body:
 * - dentistsFte: number (required) - FTE der Zahnärzte
 * - chairsSimultaneous?: number - Gleichzeitig betriebene Stühle
 * - treatmentRooms?: number - Anzahl Behandlungsräume (Fallback)
 * - prophylaxisChairs?: number - Anzahl Prophylaxe-Stühle
 * - patientsPerDay?: number - Patienten pro Tag
 * - complexityLevel?: -1|0|1|2 - Komplexitätslevel
 * - current?: CurrentStaffingFte - Aktuelle Ist-Werte für Coverage
 *
 * Response:
 * - StaffingDemandResponse mit berechneten Soll-FTE, Ratios, Ampeln
 */
export async function computeStaffingDemand(req: Request, res: Response) {
  try {
    const practiceId = req.params.id;

    // Parse input from request body
    const {
      dentistsFte,
      chairsSimultaneous,
      treatmentRooms,
      prophylaxisChairs,
      patientsPerDay,
      complexityLevel,
      clinicalBuffer,
      adminBuffer,
      roundingStepFte,
      defaultPatientsPerChair,
      avgContractFraction,
      current,
    } = req.body;

    // Validate required field
    if (dentistsFte === undefined || dentistsFte === null) {
      return res.status(400).json({
        error: "Missing required field",
        message: "dentistsFte ist ein Pflichtfeld",
        code: "STAFFING_MISSING_DENTISTS_FTE",
      });
    }

    // Build input object
    const input: StaffingInput = {
      dentistsFte: Number(dentistsFte),
      chairsSimultaneous: chairsSimultaneous !== undefined ? Number(chairsSimultaneous) : undefined,
      treatmentRooms: treatmentRooms !== undefined ? Number(treatmentRooms) : undefined,
      prophylaxisChairs: prophylaxisChairs !== undefined ? Number(prophylaxisChairs) : undefined,
      patientsPerDay: patientsPerDay !== undefined ? Number(patientsPerDay) : undefined,
      complexityLevel: complexityLevel !== undefined ? Number(complexityLevel) : undefined,
      clinicalBuffer: clinicalBuffer !== undefined ? Number(clinicalBuffer) : undefined,
      adminBuffer: adminBuffer !== undefined ? Number(adminBuffer) : undefined,
      roundingStepFte: roundingStepFte !== undefined ? Number(roundingStepFte) : undefined,
      defaultPatientsPerChair: defaultPatientsPerChair !== undefined ? Number(defaultPatientsPerChair) : undefined,
      avgContractFraction: avgContractFraction !== undefined ? Number(avgContractFraction) : undefined,
    };

    // Build current staffing if provided
    let currentStaffing: CurrentStaffingFte | undefined;
    if (current && typeof current === "object") {
      currentStaffing = {
        chairsideAssistFte: current.chairsideAssistFte !== undefined ? Number(current.chairsideAssistFte) : undefined,
        steriFte: current.steriFte !== undefined ? Number(current.steriFte) : undefined,
        zfaTotalFte: current.zfaTotalFte !== undefined ? Number(current.zfaTotalFte) : undefined,
        prophyFte: current.prophyFte !== undefined ? Number(current.prophyFte) : undefined,
        frontdeskFte: current.frontdeskFte !== undefined ? Number(current.frontdeskFte) : undefined,
        pmFte: current.pmFte !== undefined ? Number(current.pmFte) : undefined,
        totalFte: current.totalFte !== undefined ? Number(current.totalFte) : undefined,
      };
    }

    // Compute staffing demand
    const result = computeStaffing(input, currentStaffing);

    // Build response
    const response: StaffingDemandResponse = {
      timestamp: new Date().toISOString(),
      engineVersion: STAFFING_ENGINE_VERSION,
      input,
      result,
    };

    res.json(response);
  } catch (error) {
    console.error("Staffing Demand computation error:", error);
    res.status(500).json({
      error: "Failed to compute staffing demand",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * GET /api/practices/:id/hr/staffing-demand
 *
 * Berechnet den optimalen Personalbedarf automatisch aus den Praxisdaten.
 * Nutzt die gespeicherten Räume und Personal-Daten.
 */
export async function getStaffingDemandFromPractice(req: Request, res: Response) {
  try {
    const practiceId = req.params.id;
    const storage = await getStorage();

    // Load practice data
    const staffList = await storage.getStaffByPracticeId(practiceId);

    // For rooms, we need to use a different approach - lazy import storage for rooms
    const { storage: fullStorage } = await import("../storage");
    const rooms = await fullStorage.getRoomsByPracticeId(practiceId);

    // Count dentists/providers
    const dentists = staffList.filter(
      (s) => s.role === "dentist" || s.role === "doctor" || s.role === "zahnarzt"
    );
    const dentistsFte = dentists.reduce((sum, d) => sum + (d.fte ?? 1.0), 0);

    // Count treatment rooms (exam rooms)
    const treatmentRooms = rooms.filter(
      (r) => r.type === "exam" || r.type === "behandlung" || r.type === "treatment"
    ).length;

    // Count prophylaxis rooms
    const prophylaxisRooms = rooms.filter(
      (r) => r.type === "prophy" || r.type === "prophylaxe" || r.type === "hygiene"
    ).length;

    // Calculate current staffing from database
    const zfaStaff = staffList.filter(
      (s) => s.role === "assistant" || s.role === "zfa" || s.role === "nurse" || s.role === "mfa"
    );
    const receptionStaff = staffList.filter(
      (s) => s.role === "receptionist" || s.role === "empfang" || s.role === "rezeption"
    );
    const prophyStaff = staffList.filter(
      (s) => s.role === "dh" || s.role === "hygienist" || s.role === "prophylaxe"
    );
    const pmStaff = staffList.filter(
      (s) => s.role === "manager" || s.role === "pm" || s.role === "praxismanager"
    );

    const currentStaffing: CurrentStaffingFte = {
      zfaTotalFte: zfaStaff.reduce((sum, s) => sum + (s.fte ?? 1.0), 0),
      frontdeskFte: receptionStaff.reduce((sum, s) => sum + (s.fte ?? 1.0), 0),
      prophyFte: prophyStaff.reduce((sum, s) => sum + (s.fte ?? 1.0), 0),
      pmFte: pmStaff.reduce((sum, s) => sum + (s.fte ?? 1.0), 0),
      totalFte: staffList.reduce((sum, s) => sum + (s.fte ?? 1.0), 0),
    };

    // Build input
    const input: StaffingInput = {
      dentistsFte,
      treatmentRooms,
      prophylaxisChairs: prophylaxisRooms,
      // Use treatmentRooms as chairsSimultaneous estimate
      chairsSimultaneous: Math.min(treatmentRooms, Math.ceil(dentistsFte)),
    };

    // Compute staffing demand
    const result = computeStaffing(input, currentStaffing);

    // Build response
    const response: StaffingDemandResponse = {
      timestamp: new Date().toISOString(),
      engineVersion: STAFFING_ENGINE_VERSION,
      input,
      result,
    };

    res.json(response);
  } catch (error) {
    console.error("Staffing Demand from practice error:", error);
    res.status(500).json({
      error: "Failed to compute staffing demand from practice data",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
