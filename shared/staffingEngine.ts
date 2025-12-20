/**
 * Staffing Engine - Deterministische FTE/VZÄ-Berechnung für Zahnarztpraxen
 *
 * Diese Engine berechnet den optimalen Personalbedarf basierend auf
 * Praxisstruktur (Stühle, Behandler, Prophylaxe) und Patientenaufkommen.
 *
 * WICHTIG:
 * - Pure Functions: same input => same output
 * - Keine eval/Expression-Interpreter
 * - Defensive Validierung (NaN/negativ werden abgefangen)
 * - Keine Secrets, keine externen Calls
 *
 * Regelwerk-Version: 1.0.0
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Eingabeparameter für die Personalbedarfsberechnung.
 */
export interface StaffingInput {
  /** FTE der Zahnärzte/Behandler (>=0) */
  dentistsFte: number;
  /** Anzahl gleichzeitig betriebener Behandlungsstühle */
  chairsSimultaneous?: number;
  /** Anzahl Behandlungsräume (Fallback wenn chairsSimultaneous fehlt) */
  treatmentRooms?: number;
  /** Anzahl Prophylaxe-Stühle (>=0, default 0) */
  prophylaxisChairs?: number;
  /** Patienten pro Tag (optional, wird geschätzt wenn fehlt) */
  patientsPerDay?: number;
  /** Komplexitätslevel: -1 (einfach), 0 (normal), 1 (mittel), 2 (hoch) */
  complexityLevel?: number;
  /** Klinischer Buffer (default 0.12 = 12%) */
  clinicalBuffer?: number;
  /** Admin Buffer (default 0.08 = 8%) */
  adminBuffer?: number;
  /** Rundungsschritt für FTE (default 0.10) */
  roundingStepFte?: number;
  /** Patienten pro Stuhl pro Tag wenn patientsPerDay fehlt (default 18) */
  defaultPatientsPerChair?: number;
  /** Durchschnittlicher Vertragsanteil für Headcount-Hinweis (default 0.80) */
  avgContractFraction?: number;
}

/**
 * Aktuelle Ist-Werte für Coverage-Berechnung (optional).
 */
export interface CurrentStaffingFte {
  /** Ist-FTE Stuhlassistenz */
  chairsideAssistFte?: number;
  /** Ist-FTE Sterilisation */
  steriFte?: number;
  /** Ist-FTE ZFA gesamt (chairside + steri) */
  zfaTotalFte?: number;
  /** Ist-FTE Prophylaxe */
  prophyFte?: number;
  /** Ist-FTE Empfang */
  frontdeskFte?: number;
  /** Ist-FTE Praxismanagement */
  pmFte?: number;
  /** Ist-FTE gesamt */
  totalFte?: number;
}

/**
 * Abgeleitete Zwischenwerte aus den Eingaben.
 */
export interface DerivedValues {
  /** C: Effektive gleichzeitige Stühle */
  C: number;
  /** N: Patienten pro Tag */
  N: number;
  /** PPC: Patienten pro Stuhl pro Tag */
  PPC: number;
  /** TI: Turnover-Index (0-1) */
  TI: number;
  /** CB: Komplexitätsbonus */
  CB: number;
  /** SF: Supportfaktor */
  SF: number;
  /** Warnungen (z.B. "chairsSimultaneous geschätzt") */
  warnings: string[];
}

/**
 * FTE-Werte pro Rolle.
 */
export interface FteByRole {
  /** Stuhlassistenz FTE */
  chairside: number;
  /** Sterilisation FTE */
  steri: number;
  /** ZFA gesamt (chairside + steri) */
  zfaTotal: number;
  /** Prophylaxe FTE */
  prophy: number;
  /** Empfang FTE */
  frontdesk: number;
  /** Praxismanagement FTE */
  pm: number;
  /** Total FTE */
  total: number;
}

/**
 * Ratios für die UI-Anzeige.
 */
export interface StaffingRatios {
  /** Stuhlassistenz pro Stuhl */
  chairsidePerChair: number;
  /** ZFA gesamt pro Stuhl */
  zfaTotalPerChair: number;
  /** Empfang pro Zahnarzt-FTE */
  frontdeskPerDentistFte: number;
}

/**
 * Coverage: Ist/Soll Verhältnis.
 */
export interface StaffingCoverage {
  chairside?: number;
  steri?: number;
  zfaTotal?: number;
  prophy?: number;
  frontdesk?: number;
  pm?: number;
  total?: number;
}

/**
 * Ampel-Severity.
 */
export type FlagSeverity = "red" | "yellow" | "green";

/**
 * Ein einzelnes Ampel-Flag.
 */
export interface StaffingFlag {
  /** Flag-ID */
  id: string;
  /** Severity */
  severity: FlagSeverity;
  /** Beschreibung */
  message: string;
}

/**
 * Meta-Informationen zur Vermeidung von Double-Counting in der UI.
 */
export interface StaffingMeta {
  /** Engine-Version */
  engineVersion: string;
  /**
   * Erklärt die Zusammensetzung der Rollen.
   * WICHTIG: zfaTotal = chairside + steri (NICHT separat addieren!)
   */
  roleComposition: {
    /** zfaTotal ist die Summe aus chairside + steri */
    zfaTotalEqualsChairsidePlusSteri: true;
    /** Für UI: Nur diese atomaren Rollen addieren für Total */
    atomicRolesForTotal: readonly ["chairside", "steri", "prophy", "frontdesk", "pm"];
    /** Alternativ: Diese aggregierten Rollen für Total (ohne Doppelzählung) */
    aggregatedRolesForTotal: readonly ["zfaTotal", "prophy", "frontdesk", "pm"];
    /**
     * Empfohlenes Total für UI-Anzeige.
     * Verwende totalFromRoundedParts statt roundedFte.total für Konsistenz,
     * da totalFromRoundedParts = sum(roundedFte.zfaTotal + prophy + frontdesk + pm)
     * und somit exakt der UI-Summe entspricht.
     */
    preferredTotalField: "totalFromRoundedParts";
  };
  /**
   * Ist die Praxis aktiv?
   * AKTIV wenn: dentistsFte > 0 ODER C > 0 ODER N > 0 ODER prophylaxisChairs > 0
   * Prophylaxe-only gilt als aktiv!
   */
  isPracticeActive: boolean;
  /**
   * Summe der gerundeten Einzel-Rollen (ohne Double-Counting).
   * totalFromRoundedParts = roundedFte.zfaTotal + prophy + frontdesk + pm
   * UI sollte dieses Feld für die Gesamtanzeige verwenden!
   */
  totalFromRoundedParts: number;
}

/**
 * Komplettes Ergebnis der Personalbedarfsberechnung.
 */
export interface StaffingResult {
  /** Abgeleitete Zwischenwerte */
  derived: DerivedValues;
  /** Basis-FTE (ohne Buffer) */
  baseFte: FteByRole;
  /** Final-FTE (mit Buffer) */
  finalFte: FteByRole;
  /** Gerundete FTE */
  roundedFte: FteByRole;
  /** Ratios für UI */
  ratios: StaffingRatios;
  /** Ampel-Flags */
  flags: StaffingFlag[];
  /** Headcount-Hinweis */
  headcountHint: HeadcountHint;
  /** Coverage (nur wenn current übergeben) */
  coverage?: StaffingCoverage;
  /** Meta-Informationen zur Vermeidung von Double-Counting */
  meta: StaffingMeta;
}

/**
 * Headcount-Hinweis (Köpfe statt FTE).
 */
export interface HeadcountHint {
  chairside: number;
  steri: number;
  zfaTotal: number;
  prophy: number;
  frontdesk: number;
  pm: number;
  total: number;
}

// ============================================================================
// Constants & Defaults
// ============================================================================

const DEFAULT_CLINICAL_BUFFER = 0.12;
const DEFAULT_ADMIN_BUFFER = 0.08;
const DEFAULT_ROUNDING_STEP = 0.10;
const DEFAULT_PATIENTS_PER_CHAIR = 18;
const DEFAULT_AVG_CONTRACT_FRACTION = 0.80;
const DEFAULT_COMPLEXITY_LEVEL = 0;
const DEFAULT_PROPHYLAXIS_CHAIRS = 0;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clamp value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Ceiling to step.
 * ceil_to_step(x, step) = ceil(x/step)*step
 */
function ceilToStep(value: number, step: number): number {
  if (step <= 0 || !isFinite(step)) return value;
  return Math.ceil(value / step) * step;
}

/**
 * Rundet auf 4 Dezimalstellen für interne Berechnungen.
 */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Rundet auf 2 Dezimalstellen für Output.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sicherer Zugriff auf numerische Werte.
 * Gibt 0 zurück bei NaN, undefined, null oder negativen Werten.
 */
function safeNum(value: number | undefined | null, allowNegative = false): number {
  if (value === undefined || value === null || !isFinite(value) || isNaN(value)) {
    return 0;
  }
  if (!allowNegative && value < 0) {
    return 0;
  }
  return value;
}

/**
 * Validiert und normalisiert complexityLevel auf {-1, 0, 1, 2}.
 */
function normalizeComplexity(level: number | undefined): number {
  const l = safeNum(level, true);
  if (l <= -1) return -1;
  if (l >= 2) return 2;
  return Math.round(l);
}

// ============================================================================
// Core Calculation Functions
// ============================================================================

/**
 * Berechnet die abgeleiteten Werte (C, N, PPC, TI, CB, SF).
 */
function computeDerivedValues(input: StaffingInput): DerivedValues {
  const warnings: string[] = [];

  const dentistsFte = safeNum(input.dentistsFte);
  const chairsSimultaneous = input.chairsSimultaneous;
  const treatmentRooms = input.treatmentRooms;
  const prophylaxisChairs = safeNum(input.prophylaxisChairs ?? DEFAULT_PROPHYLAXIS_CHAIRS);
  const patientsPerDay = input.patientsPerDay;
  const complexityLevel = normalizeComplexity(input.complexityLevel ?? DEFAULT_COMPLEXITY_LEVEL);
  const defaultPatientsPerChair = safeNum(input.defaultPatientsPerChair ?? DEFAULT_PATIENTS_PER_CHAIR);

  // === C (chairsSimultaneous) Ableitung ===
  // WICHTIG: C darf bei dentistsFte=0 NIEMALS durch Fallback-Logik auf 1 springen!
  // treatmentRooms=0 wird als "nicht angegeben" behandelt (nicht als "0 Räume")
  let C: number;
  if (chairsSimultaneous !== undefined && chairsSimultaneous !== null && isFinite(chairsSimultaneous)) {
    // Explizit gesetzt: respektieren (aber clamp >=0)
    C = Math.max(0, Math.round(chairsSimultaneous));
  } else if (treatmentRooms !== undefined && treatmentRooms !== null && isFinite(treatmentRooms) && treatmentRooms > 0) {
    // Fallback aus treatmentRooms (nur wenn > 0, da 0 = "unbekannt")
    // WICHTIG: Bei dentistsFte=0 darf C NICHT auf 1 springen!
    if (dentistsFte > 0) {
      const dentistsRounded = Math.max(1, Math.round(dentistsFte));
      C = Math.min(Math.round(treatmentRooms), dentistsRounded);
      warnings.push(`chairsSimultaneous geschätzt: C=${C} (min(${Math.round(treatmentRooms)} Räume, ${dentistsRounded} Zahnärzte))`);
    } else {
      // dentistsFte=0: C bleibt 0, auch wenn treatmentRooms vorhanden
      C = 0;
      warnings.push(`chairsSimultaneous=0: keine Zahnärzte aktiv (treatmentRooms=${treatmentRooms} ignoriert)`);
    }
  } else {
    // Kein chairsSimultaneous, kein gültiges treatmentRooms (0 oder fehlt)
    // Fallback aus dentistsFte als Integer, oder 0 wenn dentistsFte=0
    if (dentistsFte > 0) {
      C = Math.max(1, Math.round(dentistsFte));
      warnings.push(`chairsSimultaneous geschätzt aus dentistsFte: C=${C} (keine Behandlungsräume angegeben)`);
    } else {
      C = 0;
    }
  }

  // === N (patientsPerDay) Ableitung ===
  let N: number;
  if (patientsPerDay !== undefined && patientsPerDay !== null && isFinite(patientsPerDay)) {
    N = Math.max(0, patientsPerDay);
  } else {
    N = C * defaultPatientsPerChair;
    if (C > 0) {
      warnings.push(`patientsPerDay geschätzt: N=${N} (${C} Stühle × ${defaultPatientsPerChair} Pat/Stuhl)`);
    }
  }

  // === PPC (Patienten pro Stuhl pro Tag) ===
  const PPC = C > 0 ? N / C : 0;

  // === TI (Turnover-Index) ===
  // TI = clamp((PPC - 14) / 8, 0, 1) => 14..22 Patienten/Stuhl/Tag
  const TI = clamp((PPC - 14) / 8, 0, 1);

  // === CB (Komplexitätsbonus) ===
  // CB = 0.05 * complexityLevel => -0.05..+0.10
  const CB = 0.05 * complexityLevel;

  // === SF (Supportfaktor) ===
  // SF = 0.15 + 0.25 * TI => 0.15..0.40
  const SF = 0.15 + 0.25 * TI;

  return {
    C: round4(C),
    N: round4(N),
    PPC: round4(PPC),
    TI: round4(TI),
    CB: round4(CB),
    SF: round4(SF),
    warnings,
  };
}

/**
 * Berechnet die Basis-FTE (ohne Buffer).
 */
function computeBaseFte(
  input: StaffingInput,
  derived: DerivedValues
): FteByRole {
  const { C, N, SF, CB } = derived;
  const dentistsFte = safeNum(input.dentistsFte);
  const prophylaxisChairs = safeNum(input.prophylaxisChairs ?? DEFAULT_PROPHYLAXIS_CHAIRS);
  const complexityLevel = normalizeComplexity(input.complexityLevel ?? DEFAULT_COMPLEXITY_LEVEL);

  // === chairsideBase ===
  // chairsideBase = C * (1.00 + SF + CB)
  const chairsideBase = C * (1.00 + SF + CB);

  // === steriBase ===
  // steriBase = (C * 0.12) + (N * 0.003) + (prophylaxisChairs * 0.05)
  const steriBase = (C * 0.12) + (N * 0.003) + (prophylaxisChairs * 0.05);

  // === zfaTotalBase ===
  const zfaTotalBase = chairsideBase + steriBase;

  // === prophyBase ===
  // prophyBase = prophylaxisChairs * (0.90 + 0.05 * complexityLevel)
  const prophyBase = prophylaxisChairs * (0.90 + 0.05 * complexityLevel);

  // === frontdeskBase ===
  // Inaktive Praxis: frontdeskBase=0 NUR wenn ALLES inaktiv ist:
  // dentistsFte=0 UND C=0 UND N=0 UND prophylaxisChairs=0
  // Prophylaxe-only (prophylaxisChairs>0, sonst 0) gilt als AKTIV und bekommt frontdesk!
  const isFullyInactivePractice = dentistsFte === 0 && C === 0 && N === 0 && prophylaxisChairs === 0;
  const frontdeskBase = isFullyInactivePractice
    ? 0
    : 0.50 + (0.25 * Math.max(0, dentistsFte - 1.0)) + (0.01 * Math.max(0, N - 20));

  // === pmBase ===
  // staffCoreWithoutPm = zfaTotalBase + prophyBase + frontdeskBase
  // pmBase: <10 => 0, 10..<15 => 0.5, >=15 => 1.0
  const staffCoreWithoutPm = zfaTotalBase + prophyBase + frontdeskBase;
  let pmBase: number;
  if (staffCoreWithoutPm < 10) {
    pmBase = 0;
  } else if (staffCoreWithoutPm < 15) {
    pmBase = 0.5;
  } else {
    pmBase = 1.0;
  }

  // === totalBase ===
  const totalBase = zfaTotalBase + prophyBase + frontdeskBase + pmBase;

  return {
    chairside: round4(chairsideBase),
    steri: round4(steriBase),
    zfaTotal: round4(zfaTotalBase),
    prophy: round4(prophyBase),
    frontdesk: round4(frontdeskBase),
    pm: round4(pmBase),
    total: round4(totalBase),
  };
}

/**
 * Berechnet die Final-FTE (mit Buffer).
 */
function computeFinalFte(
  baseFte: FteByRole,
  clinicalBuffer: number,
  adminBuffer: number
): FteByRole {
  // Klinische Rollen mit clinicalBuffer
  const chairside = baseFte.chairside * (1 + clinicalBuffer);
  const steri = baseFte.steri * (1 + clinicalBuffer);
  const zfaTotal = baseFte.zfaTotal * (1 + clinicalBuffer);
  const prophy = baseFte.prophy * (1 + clinicalBuffer);

  // Admin Rollen mit adminBuffer
  const frontdesk = baseFte.frontdesk * (1 + adminBuffer);
  const pm = baseFte.pm * (1 + adminBuffer);

  // Total
  const total = zfaTotal + prophy + frontdesk + pm;

  return {
    chairside: round4(chairside),
    steri: round4(steri),
    zfaTotal: round4(zfaTotal),
    prophy: round4(prophy),
    frontdesk: round4(frontdesk),
    pm: round4(pm),
    total: round4(total),
  };
}

/**
 * Rundet alle FTE-Werte mit ceil_to_step.
 */
function computeRoundedFte(
  finalFte: FteByRole,
  roundingStep: number
): FteByRole {
  return {
    chairside: round2(ceilToStep(finalFte.chairside, roundingStep)),
    steri: round2(ceilToStep(finalFte.steri, roundingStep)),
    zfaTotal: round2(ceilToStep(finalFte.zfaTotal, roundingStep)),
    prophy: round2(ceilToStep(finalFte.prophy, roundingStep)),
    frontdesk: round2(ceilToStep(finalFte.frontdesk, roundingStep)),
    pm: round2(ceilToStep(finalFte.pm, roundingStep)),
    total: round2(ceilToStep(finalFte.total, roundingStep)),
  };
}

/**
 * Berechnet Ratios für UI-Anzeige.
 */
function computeRatios(
  roundedFte: FteByRole,
  derived: DerivedValues,
  dentistsFte: number
): StaffingRatios {
  const { C } = derived;

  return {
    chairsidePerChair: C > 0 ? round2(roundedFte.chairside / C) : 0,
    zfaTotalPerChair: C > 0 ? round2(roundedFte.zfaTotal / C) : 0,
    frontdeskPerDentistFte: dentistsFte > 0 ? round2(roundedFte.frontdesk / dentistsFte) : 0,
  };
}

/**
 * Generiert Ampel-Flags basierend auf Ratios und Eingaben.
 */
function computeFlags(
  ratios: StaffingRatios,
  roundedFte: FteByRole,
  derived: DerivedValues,
  dentistsFte: number
): StaffingFlag[] {
  const flags: StaffingFlag[] = [];
  const { C, N } = derived;

  // === Chairside per Chair Flags ===
  if (C > 0) {
    const cpc = ratios.chairsidePerChair;
    if (cpc < 1.20) {
      flags.push({
        id: "UNDERSTAFFED_CHAIRSIDE_RED",
        severity: "red",
        message: `Stuhlassistenz kritisch unterbesetzt: ${cpc.toFixed(2)} FTE/Stuhl (min. 1.20 empfohlen)`,
      });
    } else if (cpc < 1.45) {
      flags.push({
        id: "UNDERSTAFFED_CHAIRSIDE_YELLOW",
        severity: "yellow",
        message: `Stuhlassistenz leicht unterbesetzt: ${cpc.toFixed(2)} FTE/Stuhl (Ziel: 1.45-1.80)`,
      });
    } else if (cpc <= 1.80) {
      flags.push({
        id: "TARGET_CHAIRSIDE_GREEN",
        severity: "green",
        message: `Stuhlassistenz optimal: ${cpc.toFixed(2)} FTE/Stuhl`,
      });
    } else if (cpc <= 2.00) {
      flags.push({
        id: "OVERSTAFFED_CHAIRSIDE_YELLOW",
        severity: "yellow",
        message: `Stuhlassistenz leicht überbesetzt: ${cpc.toFixed(2)} FTE/Stuhl (Ziel: 1.45-1.80)`,
      });
    } else {
      flags.push({
        id: "OVERSTAFFED_CHAIRSIDE_RED",
        severity: "red",
        message: `Stuhlassistenz deutlich überbesetzt: ${cpc.toFixed(2)} FTE/Stuhl (max. 2.00 empfohlen)`,
      });
    }
  }

  // === Frontdesk Flags ===
  if ((dentistsFte > 0 || N > 0) && roundedFte.frontdesk < 0.50) {
    flags.push({
      id: "FRONTDESK_TOO_LOW_RED",
      severity: "red",
      message: `Empfang unterbesetzt: ${roundedFte.frontdesk.toFixed(2)} FTE (min. 0.50 empfohlen)`,
    });
  } else if (N >= 35 && roundedFte.frontdesk < 0.80) {
    flags.push({
      id: "FRONTDESK_LOW_FOR_VOLUME_YELLOW",
      severity: "yellow",
      message: `Empfang bei hohem Patientenaufkommen (${N} Pat/Tag) knapp: ${roundedFte.frontdesk.toFixed(2)} FTE (0.80 empfohlen)`,
    });
  }

  return flags;
}

/**
 * Berechnet Headcount-Hinweis (Köpfe).
 */
function computeHeadcountHint(
  roundedFte: FteByRole,
  avgContractFraction: number
): HeadcountHint {
  const factor = avgContractFraction > 0 ? avgContractFraction : DEFAULT_AVG_CONTRACT_FRACTION;
  return {
    chairside: Math.ceil(roundedFte.chairside / factor),
    steri: Math.ceil(roundedFte.steri / factor),
    zfaTotal: Math.ceil(roundedFte.zfaTotal / factor),
    prophy: Math.ceil(roundedFte.prophy / factor),
    frontdesk: Math.ceil(roundedFte.frontdesk / factor),
    pm: Math.ceil(roundedFte.pm / factor),
    total: Math.ceil(roundedFte.total / factor),
  };
}

/**
 * Berechnet Coverage (Ist/Soll).
 */
function computeCoverage(
  roundedFte: FteByRole,
  current?: CurrentStaffingFte
): StaffingCoverage | undefined {
  if (!current) return undefined;

  const coverage: StaffingCoverage = {};

  if (current.chairsideAssistFte !== undefined && roundedFte.chairside > 0) {
    coverage.chairside = round2(current.chairsideAssistFte / roundedFte.chairside);
  }
  if (current.steriFte !== undefined && roundedFte.steri > 0) {
    coverage.steri = round2(current.steriFte / roundedFte.steri);
  }
  if (current.zfaTotalFte !== undefined && roundedFte.zfaTotal > 0) {
    coverage.zfaTotal = round2(current.zfaTotalFte / roundedFte.zfaTotal);
  }
  if (current.prophyFte !== undefined && roundedFte.prophy > 0) {
    coverage.prophy = round2(current.prophyFte / roundedFte.prophy);
  }
  if (current.frontdeskFte !== undefined && roundedFte.frontdesk > 0) {
    coverage.frontdesk = round2(current.frontdeskFte / roundedFte.frontdesk);
  }
  if (current.pmFte !== undefined && roundedFte.pm > 0) {
    coverage.pm = round2(current.pmFte / roundedFte.pm);
  }
  if (current.totalFte !== undefined && roundedFte.total > 0) {
    coverage.total = round2(current.totalFte / roundedFte.total);
  }

  return Object.keys(coverage).length > 0 ? coverage : undefined;
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Hauptfunktion: Berechnet den Personalbedarf für eine Zahnarztpraxis.
 *
 * @param input - Eingabeparameter (Stühle, Behandler, Patienten, etc.)
 * @param current - Optionale aktuelle Ist-Werte für Coverage-Berechnung
 * @returns StaffingResult mit allen Berechnungsergebnissen
 *
 * @example
 * ```typescript
 * const result = computeStaffing({
 *   dentistsFte: 2.0,
 *   chairsSimultaneous: 2,
 *   patientsPerDay: 36,
 *   prophylaxisChairs: 0,
 *   complexityLevel: 0,
 * });
 *
 * console.log(result.roundedFte.zfaTotal); // 3.3
 * console.log(result.flags); // [{id: "TARGET_CHAIRSIDE_GREEN", ...}]
 * ```
 */
export function computeStaffing(
  input: StaffingInput,
  current?: CurrentStaffingFte
): StaffingResult {
  // Normalize input parameters
  const clinicalBuffer = safeNum(input.clinicalBuffer ?? DEFAULT_CLINICAL_BUFFER);
  const adminBuffer = safeNum(input.adminBuffer ?? DEFAULT_ADMIN_BUFFER);
  const roundingStep = safeNum(input.roundingStepFte ?? DEFAULT_ROUNDING_STEP);
  const avgContractFraction = safeNum(input.avgContractFraction ?? DEFAULT_AVG_CONTRACT_FRACTION);
  const dentistsFte = safeNum(input.dentistsFte);

  // Step 1: Compute derived values
  const derived = computeDerivedValues(input);

  // Step 2: Compute base FTE (without buffer)
  const baseFte = computeBaseFte(input, derived);

  // Step 3: Compute final FTE (with buffer)
  const finalFte = computeFinalFte(baseFte, clinicalBuffer, adminBuffer);

  // Step 4: Compute rounded FTE
  const roundedFte = computeRoundedFte(finalFte, roundingStep);

  // Step 5: Compute ratios
  const ratios = computeRatios(roundedFte, derived, dentistsFte);

  // Step 6: Compute flags
  const flags = computeFlags(ratios, roundedFte, derived, dentistsFte);

  // Step 7: Compute headcount hint
  const headcountHint = computeHeadcountHint(roundedFte, avgContractFraction);

  // Step 8: Compute coverage (if current provided)
  const coverage = computeCoverage(roundedFte, current);

  // Step 9: Compute meta information
  // WICHTIG: prophylaxisChairs berücksichtigen! Prophylaxe-only ist AKTIV
  const prophylaxisChairs = safeNum(input.prophylaxisChairs ?? DEFAULT_PROPHYLAXIS_CHAIRS);
  const isPracticeActive = dentistsFte > 0 || derived.C > 0 || derived.N > 0 || prophylaxisChairs > 0;

  // totalFromRoundedParts: Summe der gerundeten Einzel-Rollen (UI-konsistent)
  // WICHTIG: zfaTotal verwenden (nicht chairside+steri separat), um Double-Counting zu vermeiden
  const totalFromRoundedParts = round2(
    roundedFte.zfaTotal + roundedFte.prophy + roundedFte.frontdesk + roundedFte.pm
  );

  const meta: StaffingMeta = {
    engineVersion: STAFFING_ENGINE_VERSION,
    roleComposition: {
      zfaTotalEqualsChairsidePlusSteri: true,
      atomicRolesForTotal: ["chairside", "steri", "prophy", "frontdesk", "pm"] as const,
      aggregatedRolesForTotal: ["zfaTotal", "prophy", "frontdesk", "pm"] as const,
      preferredTotalField: "totalFromRoundedParts",
    },
    isPracticeActive,
    totalFromRoundedParts,
  };

  return {
    derived,
    baseFte,
    finalFte,
    roundedFte,
    ratios,
    flags,
    headcountHint,
    coverage,
    meta,
  };
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Alias für computeStaffing (für Kompatibilität).
 */
export const calculateStaffing = computeStaffing;

/**
 * Version des Regelwerks.
 * 1.1.0: Inaktive Praxis (frontdesk=0), Integer-Fallback für C, Meta-Feld
 * 1.2.0: treatmentRooms=0 als "unbekannt", C=0 bei dentistsFte=0, Prophylaxe-only aktiv, totalFromRoundedParts
 */
export const STAFFING_ENGINE_VERSION = "1.2.0";

/**
 * Default-Werte für Dokumentation/Tests.
 */
export const STAFFING_DEFAULTS = {
  clinicalBuffer: DEFAULT_CLINICAL_BUFFER,
  adminBuffer: DEFAULT_ADMIN_BUFFER,
  roundingStepFte: DEFAULT_ROUNDING_STEP,
  defaultPatientsPerChair: DEFAULT_PATIENTS_PER_CHAIR,
  avgContractFraction: DEFAULT_AVG_CONTRACT_FRACTION,
  complexityLevel: DEFAULT_COMPLEXITY_LEVEL,
  prophylaxisChairs: DEFAULT_PROPHYLAXIS_CHAIRS,
} as const;
