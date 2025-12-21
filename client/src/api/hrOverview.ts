/**
 * HR Overview API Client
 *
 * Type-safe API client fuer den DSGVO-konformen HR-Overview-Endpoint.
 * Nutzt den Contract als Single Source of Truth.
 */

import {
  DsgvoHrOverviewResponseSchema,
  HrOverviewQueryParamsSchema,
  type DsgvoHrOverviewResponse,
  type HrOverviewQueryParams,
  type HrOverviewErrorResponse,
} from "@shared/contracts/hrOverview.contract";

/**
 * Optionen fuer fetchHrOverview
 */
export interface FetchHrOverviewOptions {
  /** Aggregationsebene: "practice" oder "role" */
  level?: "practice" | "role";
  /** k-Anonymitaet Minimum (min. 3) */
  kMin?: number;
  /** Zeitraum Start (YYYY-MM-DD) */
  periodStart?: string;
  /** Zeitraum Ende (YYYY-MM-DD) */
  periodEnd?: string;
}

/**
 * Error class fuer HR API Fehler
 */
export class HrOverviewApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorResponse?: HrOverviewErrorResponse
  ) {
    super(message);
    this.name = "HrOverviewApiError";
  }
}

/**
 * Fetcht HR-Overview-Daten fuer eine Praxis.
 *
 * @param practiceId - Die Praxis-ID
 * @param options - Query-Parameter (level, kMin, periodStart, periodEnd)
 * @returns Parsed und type-safe Response
 * @throws HrOverviewApiError bei HTTP-Fehlern
 * @throws ZodError bei Response-Validierungsfehlern
 *
 * @example
 * ```ts
 * const data = await fetchHrOverview("practice-123", {
 *   level: "role",
 *   kMin: 5,
 *   periodStart: "2024-01-01",
 *   periodEnd: "2024-01-31",
 * });
 * console.log(data.snapshots);
 * ```
 */
export async function fetchHrOverview(
  practiceId: string,
  options: FetchHrOverviewOptions = {}
): Promise<DsgvoHrOverviewResponse> {
  // Validiere Query-Parameter
  const validatedParams = HrOverviewQueryParamsSchema.parse(options);

  // Baue URL mit Query-Parametern (relative URL, keine window.location Abhaengigkeit)
  const params = new URLSearchParams();

  if (validatedParams.level) {
    params.set("level", validatedParams.level);
  }
  if (validatedParams.kMin !== undefined) {
    params.set("kMin", validatedParams.kMin.toString());
  }
  if (validatedParams.periodStart) {
    params.set("periodStart", validatedParams.periodStart);
  }
  if (validatedParams.periodEnd) {
    params.set("periodEnd", validatedParams.periodEnd);
  }

  const queryString = params.toString();
  const url = `/api/practices/${practiceId}/hr/overview${queryString ? `?${queryString}` : ""}`;

  // Fetch mit credentials (Session-Auth)
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept": "application/json",
    },
  });

  // Parse JSON
  const data = await response.json();

  // Error handling
  if (!response.ok) {
    throw new HrOverviewApiError(
      data.message || data.error || "HR Overview request failed",
      response.status,
      data
    );
  }

  // Parse und validiere Response mit Contract-Schema
  return DsgvoHrOverviewResponseSchema.parse(data);
}

/**
 * Re-export Contract Types fuer Frontend-Nutzung
 */
export type {
  DsgvoHrOverviewResponse,
  HrOverviewQueryParams,
  HrOverviewErrorResponse,
  HrKpiSnapshot,
  HrKpiMetrics,
  HrAlert,
} from "@shared/contracts/hrOverview.contract";

export {
  HrAggregationLevelEnum,
  HrRequestedLevelEnum,
  HrAlertSeverityEnum,
  HrKpiStatusEnum,
} from "@shared/contracts/hrOverview.contract";

// ============================================================================
// Staffing Engine API
// ============================================================================

import type {
  StaffingInput,
  CurrentStaffingFte,
  StaffingResult,
} from "@shared/staffingEngine";

/**
 * Response Type fuer Staffing Demand API.
 */
export interface StaffingDemandResponse {
  timestamp: string;
  engineVersion: string;
  input: StaffingInput;
  result: StaffingResult;
}

/**
 * Fetcht Staffing-Demand automatisch aus den Praxisdaten.
 *
 * @param practiceId - Die Praxis-ID
 * @returns StaffingDemandResponse mit berechneten Soll-FTE
 */
export async function fetchStaffingDemand(
  practiceId: string
): Promise<StaffingDemandResponse> {
  const url = `/api/practices/${practiceId}/hr/staffing-demand`;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new HrOverviewApiError(
      data.message || data.error || "Staffing demand request failed",
      response.status,
      data
    );
  }

  return data as StaffingDemandResponse;
}

/**
 * Berechnet Staffing-Demand mit benutzerdefinierten Eingaben.
 *
 * @param practiceId - Die Praxis-ID
 * @param input - Staffing Input Parameter
 * @param current - Optionale aktuelle Ist-Werte fuer Coverage
 * @returns StaffingDemandResponse mit berechneten Soll-FTE
 */
export async function computeStaffingDemand(
  practiceId: string,
  input: StaffingInput,
  current?: CurrentStaffingFte
): Promise<StaffingDemandResponse> {
  const url = `/api/practices/${practiceId}/hr/staffing-demand`;

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...input, current }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new HrOverviewApiError(
      data.message || data.error || "Staffing demand computation failed",
      response.status,
      data
    );
  }

  return data as StaffingDemandResponse;
}

// Re-export Staffing Engine Types
export type { StaffingInput, CurrentStaffingFte, StaffingResult, StaffingMeta } from "@shared/staffingEngine";
