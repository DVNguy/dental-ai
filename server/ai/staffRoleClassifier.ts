/**
 * Centralized Staff Role Classification for Praxisflow
 *
 * This module provides a single source of truth for classifying staff roles
 * into categories (provider, clinical_assistant, frontdesk, excluded, unknown).
 *
 * All role classification in the application should use this module to ensure
 * consistency across advisor.ts, simulation.ts, hrController.ts, and other services.
 */

import type { Staff } from "@shared/schema";

// =============================================================================
// Role Normalization
// =============================================================================

/**
 * Normalizes a staff role string for robust comparison.
 * - Lowercase, trimmed
 * - German umlauts: ä→ae, ö→oe, ü→ue, ß→ss
 * - Remove parentheses, commas, punctuation
 * - Spaces and hyphens → underscores
 * - Collapse multiple underscores
 * - Result contains only [a-z0-9_]
 */
export function normalizeStaffRole(role: unknown): string {
  if (typeof role !== "string") return "";
  let normalized = role.trim().toLowerCase();

  // Replace German umlauts
  normalized = normalized
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");

  // Remove parentheses, commas, and other punctuation
  normalized = normalized.replace(/[(),.;:!?"']/g, "");

  // Replace spaces, hyphens, and special chars with underscores
  normalized = normalized.replace(/[\s\-–—/\\]+/g, "_");

  // Remove any remaining non-alphanumeric chars except underscore
  normalized = normalized.replace(/[^a-z0-9_]/g, "");

  // Collapse multiple underscores
  normalized = normalized.replace(/_+/g, "_");

  // Remove leading/trailing underscores
  normalized = normalized.replace(/^_|_$/g, "");

  return normalized;
}

// =============================================================================
// Role Classification Rules
// =============================================================================

// Provider roles (exact matches after normalization)
const PROVIDER_ROLES_EXACT = new Set([
  "dentist", "doctor", "zahnarzt", "zahnarztin", "arzt", "aerztin",
  "behandler", "behandlerin", "zahnarzt_inhaber", "zahnarztinhaber",
  "dr", "dr_med", "dr_med_dent",
]);

// Provider pattern fragments (substring/regex matches for complex variations)
const PROVIDER_PATTERNS: RegExp[] = [
  /zahnarzt/,    // zahnarzt, zahnärztin → zahnaerztin, zahnarzt_inhaber
  /zahnaerzt/,   // zahnärztin normalized
  /dentist/,     // dentist, dental_dentist
  /behandler/,   // behandler, hauptbehandler
  /^arzt/,       // arzt, ärztin → aerztin (but not "facharzt" - use word boundary)
  /^aerztin?$/,  // ärztin
  /^doctor$/,
  /^dr$/,
];

// Clinical assistant roles (exact matches)
const CLINICAL_ASSISTANT_ROLES_EXACT = new Set([
  // Praxisflow primary
  "zfa", "dh", "mfa",
  "sterilization_assistant", "sterilisationsassistent", "sterilisationsassistentin",
  // Legacy English
  "assistant", "nurse", "dental_assistant", "medical_assistant",
  // German variations
  "assistenz", "assistentin", "prophylaxe", "prophylaxeassistentin",
  "zfa_prophylaxe", "zfaprophylaxe", "hygienist", "dentalhygienist",
  "dental_hygienist", "zahnmedizinische_fachangestellte",
]);

// Clinical assistant pattern fragments
const CLINICAL_ASSISTANT_PATTERNS: RegExp[] = [
  /zfa/,           // zfa, zfa_prophylaxe, zfa_steri
  /mfa/,           // mfa, mfa_labor
  /assist/,        // assistant, assistenz, assistentin
  /hygien/,        // hygienist, dentalhygienist
  /prophy/,        // prophylaxe, prophylaxeassistentin
  /steril/,        // sterilisation, sterilisationsassistent
  /^dh$/,          // DH exactly
];

// Frontdesk roles (exact matches)
const FRONTDESK_ROLES_EXACT = new Set([
  "empfang", "rezeption", "anmeldung",
  "receptionist", "frontdesk", "front_desk", "reception",
  "empfangsmitarbeiter", "empfangsmitarbeiterin",
  "rezeptionist", "rezeptionistin",
  "anmeldekraft", "terminverwaltung",
]);

// Frontdesk pattern fragments
const FRONTDESK_PATTERNS: RegExp[] = [
  /empfang/,       // empfang, empfangsmitarbeiter
  /rezept/,        // rezeption, rezeptionist
  /anmeld/,        // anmeldung, anmeldekraft
  /front/,         // frontdesk, front_desk
  /^reception/,    // reception, receptionist
  /termin/,        // terminverwaltung (scheduling)
];

// Excluded roles (exact matches) - these do NOT count in ratios
const EXCLUDED_ROLES_EXACT = new Set([
  "practice_manager", "praxismanager", "praxismanagerin",
  "manager", "managerin", "admin", "administrator",
  "geschaeftsfuehrer", "geschaeftsfuehrerin",
  "inhaber", "inhaberin", // owner without treating
  "buchhaltung", "verwaltung",
]);

// Excluded pattern fragments
const EXCLUDED_PATTERNS: RegExp[] = [
  /manager/,       // practice_manager, praxismanager
  /admin/,         // admin, administrator
  /geschaeftsfuehr/, // Geschäftsführer
  /buchhalt/,      // Buchhaltung
  /verwalt/,       // Verwaltung
];

// =============================================================================
// Role Classification
// =============================================================================

export type RoleCategory = "provider" | "clinical_assistant" | "frontdesk" | "excluded" | "unknown";

/**
 * Classifies a normalized role into a category.
 * Order matters: excluded first, then provider, clinical, frontdesk.
 */
export function classifyRole(normalizedRole: string): RoleCategory {
  if (!normalizedRole) return "unknown";

  // 1) Check excluded first (highest priority)
  if (EXCLUDED_ROLES_EXACT.has(normalizedRole)) return "excluded";
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(normalizedRole)) return "excluded";
  }

  // 2) Check provider
  if (PROVIDER_ROLES_EXACT.has(normalizedRole)) return "provider";
  for (const pattern of PROVIDER_PATTERNS) {
    if (pattern.test(normalizedRole)) return "provider";
  }

  // 3) Check clinical assistant
  if (CLINICAL_ASSISTANT_ROLES_EXACT.has(normalizedRole)) return "clinical_assistant";
  for (const pattern of CLINICAL_ASSISTANT_PATTERNS) {
    if (pattern.test(normalizedRole)) return "clinical_assistant";
  }

  // 4) Check frontdesk
  if (FRONTDESK_ROLES_EXACT.has(normalizedRole)) return "frontdesk";
  for (const pattern of FRONTDESK_PATTERNS) {
    if (pattern.test(normalizedRole)) return "frontdesk";
  }

  return "unknown";
}

// =============================================================================
// Staff Classification Result
// =============================================================================

/**
 * Debug info for staffing analysis (no PII - only aggregated counts and role strings)
 */
export interface StaffClassificationDebug {
  providersCount: number;
  clinicalAssistantsCount: number;
  frontdeskCount: number;
  supportTotalCount: number;
  excludedCount: number;
  providersFte: number;
  clinicalAssistantsFte: number;
  frontdeskFte: number;
  supportTotalFte: number;
  roleHistogram: Record<string, number>;  // normalized role → count
  unknownRoles: string[];                 // list of unrecognized roles (no IDs!)
}

export interface StaffClassificationResult {
  providers: Staff[];
  clinicalAssistants: Staff[];
  frontdesk: Staff[];
  excluded: Staff[];
  unknown: Staff[];

  // Counts
  providersCount: number;
  clinicalAssistantsCount: number;
  frontdeskCount: number;
  supportTotalCount: number;
  excludedCount: number;

  // FTE sums
  providersFte: number;
  clinicalAssistantsFte: number;
  frontdeskFte: number;
  supportTotalFte: number;

  // Debug info (always computed, but only exposed when needed)
  roleHistogram: Record<string, number>;
  unknownRoles: string[];
}

/**
 * Helper to get FTE (fallback to 1.0 if undefined/null)
 */
function getFte(s: Staff): number {
  return s.fte !== undefined && s.fte !== null ? s.fte : 1.0;
}

/**
 * Classifies an array of Staff members into categories.
 *
 * This is the main function to use for staff classification.
 * It handles normalization, classification, counting, and FTE summation.
 *
 * @param staff - Array of Staff members to classify
 * @returns Classification result with arrays, counts, FTEs, and debug info
 */
export function classifyStaffForRatios(staff: Staff[]): StaffClassificationResult {
  const providers: Staff[] = [];
  const clinicalAssistants: Staff[] = [];
  const frontdesk: Staff[] = [];
  const excluded: Staff[] = [];
  const unknown: Staff[] = [];
  const unknownRolesSet = new Set<string>();
  const roleHistogram: Record<string, number> = {};

  for (const s of staff) {
    const normalizedRole = normalizeStaffRole(s.role);
    const category = classifyRole(normalizedRole);

    // Build histogram (for debug)
    if (normalizedRole) {
      roleHistogram[normalizedRole] = (roleHistogram[normalizedRole] || 0) + 1;
    }

    switch (category) {
      case "provider":
        providers.push(s);
        break;
      case "clinical_assistant":
        clinicalAssistants.push(s);
        break;
      case "frontdesk":
        frontdesk.push(s);
        break;
      case "excluded":
        excluded.push(s);
        break;
      case "unknown":
        unknown.push(s);
        if (normalizedRole) {
          unknownRolesSet.add(normalizedRole);
        }
        break;
    }
  }

  // Counts
  const providersCount = providers.length;
  const clinicalAssistantsCount = clinicalAssistants.length;
  const frontdeskCount = frontdesk.length;
  const supportTotalCount = clinicalAssistantsCount + frontdeskCount;
  const excludedCount = excluded.length;

  // FTE sums
  const providersFte = providers.reduce((sum, s) => sum + getFte(s), 0);
  const clinicalAssistantsFte = clinicalAssistants.reduce((sum, s) => sum + getFte(s), 0);
  const frontdeskFte = frontdesk.reduce((sum, s) => sum + getFte(s), 0);
  const supportTotalFte = clinicalAssistantsFte + frontdeskFte;

  return {
    providers,
    clinicalAssistants,
    frontdesk,
    excluded,
    unknown,
    providersCount,
    clinicalAssistantsCount,
    frontdeskCount,
    supportTotalCount,
    excludedCount,
    providersFte,
    clinicalAssistantsFte,
    frontdeskFte,
    supportTotalFte,
    roleHistogram,
    unknownRoles: Array.from(unknownRolesSet).sort(),
  };
}

/**
 * Extracts debug info from a classification result.
 * Use this to get a PII-free debug payload for API responses.
 */
export function getClassificationDebug(result: StaffClassificationResult): StaffClassificationDebug {
  return {
    providersCount: result.providersCount,
    clinicalAssistantsCount: result.clinicalAssistantsCount,
    frontdeskCount: result.frontdeskCount,
    supportTotalCount: result.supportTotalCount,
    excludedCount: result.excludedCount,
    providersFte: result.providersFte,
    clinicalAssistantsFte: result.clinicalAssistantsFte,
    frontdeskFte: result.frontdeskFte,
    supportTotalFte: result.supportTotalFte,
    roleHistogram: result.roleHistogram,
    unknownRoles: result.unknownRoles,
  };
}
