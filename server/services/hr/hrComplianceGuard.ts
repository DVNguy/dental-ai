/**
 * HR Compliance Guard - DSGVO/ArbSchG-Schutzschranken (v2.0)
 *
 * DESIGN-PRINZIPIEN:
 * 1. Praezision statt Pauschalverbote - nur HR-Analytics-Input wird strikt geprueft
 * 2. Kontextsensitiv - Felder wie "name" sind in HR-KPIs verboten, aber nicht global
 * 3. k-Anonymitaet ist konfigurierbar (min. 3, empfohlen 5)
 * 4. Begriffe werden differenziert behandelt (systemisch vs. personenbezogen)
 *
 * Rechtsgrundlage:
 * - DSGVO Art. 5 (Datenminimierung)
 * - DSGVO Art. 25 (Privacy by Design)
 * - ArbSchG (Verbot individueller Leistungs-/Verhaltenskontrolle)
 */

import {
  HrAggregationLevel,
  ALLOWED_ROLE_KEYS,
  type AllowedRoleKey,
  type KAnonymityResult,
  type ComplianceValidationResult,
  type HrAggregatedGroupInput,
  DEFAULT_HR_THRESHOLDS,
  K_ANONYMITY_ABSOLUTE_MIN,
  K_ANONYMITY_RECOMMENDED_MIN,
  validateKMin,
} from "./hrTypes";

// ============================================================================
// Field Categories - Differenzierte Verbotslisten
// ============================================================================

/**
 * STRIKT VERBOTEN in HR-Analytics-Input:
 * Diese Felder ermoeglichen direkte Rueckfuehrung auf Einzelpersonen.
 *
 * WARUM: Bei Vorhandensein dieser Felder in KPI-Daten waere eine
 * Individual-Analyse technisch moeglich, was gegen DSGVO & ArbSchG verstoesst.
 */
const FORBIDDEN_ID_FIELDS = [
  "staffId",
  "employeeId",
  "personId",
  "memberId",
  "workerId",
  "oderId",
  "oderId",
  "mitarbeiterId",
  "personalnummer",
  "sozialversicherungsnummer",
  "ssn",
] as const;

/**
 * KONTEXTUELL VERBOTEN in HR-Analytics-Input:
 * Diese Felder sind nur in HR-KPI-Strukturen verboten, nicht global.
 *
 * WARUM: In einem Staff-Objekt ist "name" normal, aber in einem
 * KPI-Snapshot hat es nichts verloren (Datenminimierung).
 */
const FORBIDDEN_IN_HR_ANALYTICS = [
  "firstName",
  "lastName",
  "vorname",
  "nachname",
  "email",
  "phone",
  "telefon",
  "address",
  "adresse",
  "birthDate",
  "geburtsdatum",
  // Einzelperson-Referenzen
  "individual",
  "person",
  "employee",
  "mitarbeiter",
] as const;

/**
 * VERBOTEN in Alert-/Erklaerungstexten - PERSONENBEZOGENE Formulierungen.
 *
 * Diese Begriffe deuten auf Individual-Bewertungen hin und sind
 * arbeitsrechtlich problematisch (ArbSchG, BetrVG).
 */
const FORBIDDEN_PERSONAL_TERMS = [
  // Direkte Personenreferenzen - IMMER verboten
  "Mitarbeiter ",    // Mit Leerzeichen: "Mitarbeiter X" verboten, "Mitarbeiteranzahl" erlaubt
  "Mitarbeiterin ",
  "Kollege",
  "Kollegin",
  "Person X",
  "Herr ",
  "Frau ",

  // Personenbezogene Gesundheitsbewertungen - IMMER verboten
  "risikoprofil",
  "Risikoprofil",
  "gesundheitsprofil",
  "Gesundheitsprofil",
  "ueberfordert",
  "überfordert",
  "Ueberforderung",
  "Überforderung",

  // Psychologische Diagnosen - IMMER verboten (kein Arbeitgeber-Kompetenzbereich)
  "Depression",
  "Angst",
  "psychisch krank",
  "mental krank",
] as const;

/**
 * VERBOTEN wenn PERSONENBEZOGEN, ERLAUBT wenn SYSTEMISCH:
 *
 * "Stress" und "Burnout" sind erlaubt als systemische/organisatorische Faktoren,
 * z.B. "arbeitsbedingte Stressfaktoren im Team" oder "Burnout-Praevention".
 *
 * VERBOTEN: "Person X hat Stress", "Burnout bei Mitarbeiter Y"
 * ERLAUBT: "Systemische Stressbelastung", "Praevention arbeitsbedingter Erschoepfung"
 */
const CONTEXT_SENSITIVE_TERMS = [
  { term: "stress", forbiddenPatterns: ["hat stress", "leidet unter stress", "sein stress", "ihr stress"] },
  { term: "burnout", forbiddenPatterns: ["hat burnout", "burnout bei", "sein burnout", "ihr burnout"] },
] as const;

// ============================================================================
// Core Guard Functions - Praezisierte Version
// ============================================================================

/**
 * Prueft HR-Analytics-Input auf verbotene personenbezogene Felder.
 *
 * WICHTIG: Diese Funktion ist SPEZIELL fuer HR-Analytics-Datenstrukturen.
 * Sie prueft nur die oberste Ebene und direkte Kinder, keine tiefe Rekursion.
 *
 * @param input - HR-Analytics-Eingabeobjekt (HrPracticeInput, HrAggregatedGroupInput[], etc.)
 * @param path - Aktueller Pfad (fuer Fehlermeldung)
 * @throws HrComplianceError bei Fund eines verbotenen Feldes
 */
export function assertNoPersonLevel(input: unknown, path: string = "root"): void {
  if (input === null || input === undefined) {
    return;
  }

  // Arrays: Pruefe jedes Element
  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      assertNoPersonLevel(item, `${path}[${index}]`);
    });
    return;
  }

  // Objekte: Pruefe Schluessel
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();

      // 1. Strikt verbotene ID-Felder - IMMER blockieren
      for (const forbidden of FORBIDDEN_ID_FIELDS) {
        if (lowerKey === forbidden.toLowerCase()) {
          throw new HrComplianceError(
            `DSGVO-VERSTOSS: Personenbezogene ID "${key}" in HR-Analytics gefunden (${path}). ` +
            `Individual-Analytics sind strikt verboten. ` +
            `Aggregieren Sie Daten VOR der Uebergabe an das HR-Modul.`
          );
        }
      }

      // 2. Kontextuell verbotene Felder in HR-Analytics
      for (const forbidden of FORBIDDEN_IN_HR_ANALYTICS) {
        if (lowerKey === forbidden.toLowerCase()) {
          throw new HrComplianceError(
            `DSGVO-VERSTOSS: Feld "${key}" hat in HR-Analytics nichts verloren (${path}). ` +
            `Dieses Feld gehoert zu personenbezogenen Stammdaten, nicht zu aggregierten KPIs. ` +
            `Entfernen Sie es aus der Datenstruktur.`
          );
        }
      }

      // Rekursiv nur fuer verschachtelte Objekte, nicht fuer primitive Werte
      const value = obj[key];
      if (value !== null && typeof value === "object") {
        assertNoPersonLevel(value, `${path}.${key}`);
      }
    }
  }
}

/**
 * Prueft ob eine Gruppengroesse die k-Anonymitaet erfuellt.
 *
 * @param groupCount - Anzahl Personen in der Gruppe
 * @param kMin - Minimale Gruppengroesse (wird validiert)
 * @returns Ergebnis mit Fallback-Empfehlung und ggf. Warnung
 */
export function enforceKAnonymity(
  groupCount: number,
  kMin: number = DEFAULT_HR_THRESHOLDS.kMin
): KAnonymityResult {
  // Validiere kMin selbst
  const kValidation = validateKMin(kMin);

  if (groupCount >= kMin) {
    return {
      allowed: true,
      ...(kValidation.warning && { warning: kValidation.warning }),
    };
  }

  return {
    allowed: false,
    fallbackLevel: HrAggregationLevel.PRACTICE,
    reason:
      `k-Anonymitaet verletzt: Gruppe hat nur ${groupCount} Person(en), ` +
      `Minimum ist ${kMin}. Daten werden auf Practice-Level aggregiert um ` +
      `Rueckschluesse auf Einzelpersonen zu verhindern.`,
  };
}

/**
 * Validiert einen Gruppenschluessel gegen die Whitelist.
 * Verhindert exotische Rollennamen, die Rueckschluesse ermoeglichen.
 *
 * @param groupKey - Zu pruefender Schluessel
 * @returns Bereinigter Schluessel oder "SONSTIGE"
 */
export function sanitizeGroupKey(groupKey: string): AllowedRoleKey | "practice" {
  if (groupKey.toLowerCase() === "practice") {
    return "practice";
  }

  const normalized = groupKey.toUpperCase().trim();

  // Mapping gaengiger Varianten auf Standard-Rollen
  const aliases: Record<string, AllowedRoleKey> = {
    "ZFA": "ZFA",
    "ZAHNMEDIZINISCHE FACHANGESTELLTE": "ZFA",
    "ZMF": "ZFA",
    "DH": "DH",
    "DENTALHYGIENIKERIN": "DH",
    "DENTALHYGIENIKER": "DH",
    "PROPHYLAXE": "DH",
    "ZAHNARZT": "ZAHNARZT",
    "ZAHNAERZTIN": "ZAHNARZT",
    "ZAHNÄRZTIN": "ZAHNARZT",
    "ARZT": "ZAHNARZT",
    "DR": "ZAHNARZT",
    "EMPFANG": "EMPFANG",
    "REZEPTION": "EMPFANG",
    "FRONT OFFICE": "EMPFANG",
    "VERWALTUNG": "VERWALTUNG",
    "ADMINISTRATION": "VERWALTUNG",
    "BACKOFFICE": "VERWALTUNG",
    "BACK OFFICE": "VERWALTUNG",
    "AZUBI": "AZUBI",
    "AUSZUBILDENDE": "AZUBI",
    "AUSZUBILDENDER": "AZUBI",
    "PRAKTIKANT": "AZUBI",
    "PRAKTIKANTIN": "AZUBI",
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  // Pruefe ob exakt in Whitelist
  if (ALLOWED_ROLE_KEYS.includes(normalized as AllowedRoleKey)) {
    return normalized as AllowedRoleKey;
  }

  // Fallback auf Sammelkategorie - verhindert Re-Identifikation durch exotische Rollen
  return "SONSTIGE";
}

/**
 * Validiert komplette Eingabedaten fuer die KPI-Berechnung.
 *
 * @param groups - Array von aggregierten Gruppendaten
 * @param kMin - Minimale Gruppengroesse (wird validiert)
 * @returns Validierungsergebnis mit Fehlern und Warnungen
 */
export function validateAggregatedInput(
  groups: HrAggregatedGroupInput[],
  kMin: number = DEFAULT_HR_THRESHOLDS.kMin
): ComplianceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 0. Validiere kMin
  try {
    const kValidation = validateKMin(kMin);
    if (kValidation.warning) {
      warnings.push(kValidation.warning);
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { valid: false, errors, warnings };
  }

  // 1. Pruefe auf verbotene Felder
  try {
    assertNoPersonLevel(groups);
  } catch (e) {
    if (e instanceof HrComplianceError) {
      errors.push(e.message);
    } else {
      throw e;
    }
  }

  // 2. Pruefe jede Gruppe
  for (const group of groups) {
    // k-Anonymitaet
    const kResult = enforceKAnonymity(group.headcount, kMin);
    if (!kResult.allowed) {
      warnings.push(
        `Gruppe "${group.groupKey}": ${kResult.reason}`
      );
    }

    // Gruppenschluessel validieren
    const sanitized = sanitizeGroupKey(group.groupKey);
    if (sanitized !== group.groupKey && sanitized !== "practice") {
      warnings.push(
        `Gruppe "${group.groupKey}" wurde zu "${sanitized}" normalisiert.`
      );
    }

    // Plausibilitaet
    if (group.headcount <= 0) {
      errors.push(`Gruppe "${group.groupKey}": headcount muss > 0 sein.`);
    }
    if (group.totalFte < 0) {
      errors.push(`Gruppe "${group.groupKey}": totalFte darf nicht negativ sein.`);
    }
    if (group.totalOvertimeMinutes < 0) {
      errors.push(`Gruppe "${group.groupKey}": Ueberstunden duerfen nicht negativ sein.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Prueft einen Text auf verbotene personenbezogene Begriffe.
 *
 * DIFFERENZIERTE PRUEFUNG:
 * - Direkte Personenreferenzen: IMMER verboten
 * - Kontextsensitive Begriffe (Stress, Burnout): Nur verboten wenn personenbezogen
 *
 * @param text - Zu pruefender Text
 * @returns true wenn Text compliant ist
 * @throws HrComplianceError bei Fund verbotener Begriffe
 */
export function assertTextCompliance(text: string): boolean {
  const lowerText = text.toLowerCase();

  // 1. Strikt verbotene personenbezogene Begriffe
  for (const term of FORBIDDEN_PERSONAL_TERMS) {
    if (lowerText.includes(term.toLowerCase())) {
      throw new HrComplianceError(
        `DSGVO-VERSTOSS: Text enthaelt verbotenen personenbezogenen Begriff "${term}". ` +
        `Verwenden Sie neutrale, organisatorische Sprache ohne Bezug auf Einzelpersonen.`
      );
    }
  }

  // 2. Kontextsensitive Begriffe - nur verboten wenn personenbezogen verwendet
  for (const { term, forbiddenPatterns } of CONTEXT_SENSITIVE_TERMS) {
    for (const pattern of forbiddenPatterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        throw new HrComplianceError(
          `DSGVO-VERSTOSS: "${term}" wird personenbezogen verwendet ("${pattern}"). ` +
          `ERLAUBT: Systemische Verwendung wie "arbeitsbedingte ${term}faktoren" oder "${term}praevention". ` +
          `VERBOTEN: Personenbezogene Verwendung wie "Person X hat ${term}".`
        );
      }
    }
  }

  return true;
}

/**
 * Filtert Gruppen nach k-Anonymitaet und aggregiert zu kleine Gruppen.
 *
 * @param groups - Eingabegruppen
 * @param kMin - Minimale Gruppengroesse
 * @returns Bereinigte Gruppen (kleine Gruppen in "SONSTIGE" zusammengefasst)
 */
export function filterAndAggregateByKAnonymity(
  groups: HrAggregatedGroupInput[],
  kMin: number = DEFAULT_HR_THRESHOLDS.kMin
): HrAggregatedGroupInput[] {
  // Validiere kMin
  const kValidation = validateKMin(kMin);
  const effectiveKMin = kValidation.value;

  const compliantGroups: HrAggregatedGroupInput[] = [];
  let aggregatedSmallGroups: HrAggregatedGroupInput | null = null;

  for (const group of groups) {
    const kResult = enforceKAnonymity(group.headcount, effectiveKMin);

    if (kResult.allowed) {
      // Gruppe ist gross genug
      compliantGroups.push({
        ...group,
        groupKey: sanitizeGroupKey(group.groupKey),
      });
    } else {
      // Zu kleine Gruppe -> aggregieren in Sammelkategorie
      if (!aggregatedSmallGroups) {
        aggregatedSmallGroups = {
          groupKey: "SONSTIGE",
          headcount: 0,
          totalFte: 0,
          totalContractedHoursPerWeek: 0,
          totalOvertimeMinutes: 0,
          totalAbsenceDays: 0,
          absenceByType: { sick: 0, vacation: 0, training: 0, other: 0 },
        };
      }

      // Summiere in Sammelkategorie
      aggregatedSmallGroups.headcount += group.headcount;
      aggregatedSmallGroups.totalFte += group.totalFte;
      aggregatedSmallGroups.totalContractedHoursPerWeek += group.totalContractedHoursPerWeek;
      aggregatedSmallGroups.totalOvertimeMinutes += group.totalOvertimeMinutes;
      aggregatedSmallGroups.totalAbsenceDays += group.totalAbsenceDays;
      aggregatedSmallGroups.absenceByType.sick += group.absenceByType.sick;
      aggregatedSmallGroups.absenceByType.vacation += group.absenceByType.vacation;
      aggregatedSmallGroups.absenceByType.training += group.absenceByType.training;
      aggregatedSmallGroups.absenceByType.other += group.absenceByType.other;
    }
  }

  // Fuege aggregierte kleine Gruppen hinzu, wenn k-anonym
  if (aggregatedSmallGroups) {
    const aggregatedKResult = enforceKAnonymity(aggregatedSmallGroups.headcount, effectiveKMin);
    if (aggregatedKResult.allowed) {
      compliantGroups.push(aggregatedSmallGroups);
    }
    // Sonst: komplett ausschliessen (zu wenige Daten insgesamt)
  }

  return compliantGroups;
}

// ============================================================================
// Error Class
// ============================================================================

/**
 * Spezifische Fehlerklasse fuer Compliance-Verstoesse.
 */
export class HrComplianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HrComplianceError";
    Object.setPrototypeOf(this, HrComplianceError.prototype);
  }
}

// ============================================================================
// Guard Wrapper fuer API-Endpunkte
// ============================================================================

/**
 * Wrapper-Funktion fuer API-Handler.
 * Prueft NUR den Input, nicht den Output (Output kommt aus vertrauenswuerdigem Code).
 *
 * @param handler - Async-Handler-Funktion
 * @returns Wrapped Handler mit Input-Compliance-Check
 */
export function withComplianceGuard<T, R>(
  handler: (input: T) => Promise<R>
): (input: T) => Promise<R> {
  return async (input: T): Promise<R> => {
    // Pre-Check: Keine personenbezogenen Daten im Input
    assertNoPersonLevel(input);

    // Handler ausfuehren - Output wird nicht geprueft (vertrauenswuerdig)
    return handler(input);
  };
}

// ============================================================================
// Exports
// ============================================================================

// Exportiere Listen fuer Tests und Dokumentation
export const FORBIDDEN_FIELDS = [...FORBIDDEN_ID_FIELDS, ...FORBIDDEN_IN_HR_ANALYTICS];
export const FORBIDDEN_TERMS_IN_TEXT = FORBIDDEN_PERSONAL_TERMS;

// Exportiere auch die differenzierten Listen
export {
  FORBIDDEN_ID_FIELDS,
  FORBIDDEN_IN_HR_ANALYTICS,
  FORBIDDEN_PERSONAL_TERMS,
  CONTEXT_SENSITIVE_TERMS,
};
