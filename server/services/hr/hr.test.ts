/**
 * HR Module Tests - DSGVO-Compliance Validation (v2.0)
 *
 * Diese Tests verifizieren:
 * 1. Guard blockiert strikt verbotene ID-Felder (staffId, employeeId) => throw
 * 2. Guard blockiert kontextuelle Felder in HR-Analytics (name, email) => throw
 * 3. k-Anonymitaet: konfigurierbar, min. 3, empfohlen 5
 * 4. Snapshots enthalten keine person fields
 * 5. Alerts: Personenbezogene Begriffe verboten, systemische erlaubt
 * 6. "Stress/Burnout" erlaubt wenn systemisch, verboten wenn personenbezogen
 *
 * Ausfuehrung: npx tsx server/services/hr/hr.test.ts
 */

import {
  // Types
  HrAggregationLevel,
  type HrAggregatedGroupInput,
  type HrPracticeInput,
  DEFAULT_HR_THRESHOLDS,
  K_ANONYMITY_ABSOLUTE_MIN,
  K_ANONYMITY_RECOMMENDED_MIN,
  validateKMin,

  // Compliance Guard
  assertNoPersonLevel,
  enforceKAnonymity,
  sanitizeGroupKey,
  validateAggregatedInput,
  assertTextCompliance,
  filterAndAggregateByKAnonymity,
  HrComplianceError,
  FORBIDDEN_FIELDS,
  FORBIDDEN_ID_FIELDS,
  FORBIDDEN_IN_HR_ANALYTICS,
  CONTEXT_SENSITIVE_TERMS,

  // KPI Engine
  computePracticeSnapshot,
  computeRoleSnapshots,

  // Alerts
  generateHrAlerts,
} from "./index";

// ============================================================================
// Simple Test Framework
// ============================================================================

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${e instanceof Error ? e.message : String(e)}`);
    failCount++;
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new Error(`Expected undefined, got ${actual}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error(`Expected defined value, got undefined`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== "number" || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toContain(expected: string) {
      if (typeof actual !== "string" || !actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    not: {
      toContain(expected: string) {
        if (typeof actual === "string" && actual.includes(expected)) {
          throw new Error(`Expected "${actual}" NOT to contain "${expected}"`);
        }
      },
      toMatch(regex: RegExp) {
        if (typeof actual === "string" && regex.test(actual)) {
          throw new Error(`Expected "${actual}" NOT to match ${regex}`);
        }
      },
      toThrow() {
        if (typeof actual !== "function") {
          throw new Error(`Expected a function`);
        }
        try {
          (actual as () => void)();
        } catch {
          throw new Error(`Expected function NOT to throw`);
        }
      },
    },
    toThrow(expectedType?: new (...args: any[]) => Error) {
      if (typeof actual !== "function") {
        throw new Error(`Expected a function`);
      }
      try {
        (actual as () => void)();
        throw new Error(`Expected function to throw`);
      } catch (e) {
        if (expectedType && !(e instanceof expectedType)) {
          throw new Error(`Expected to throw ${expectedType.name}, got ${e}`);
        }
      }
    },
    toHaveLength(expected: number) {
      if (!Array.isArray(actual) || actual.length !== expected) {
        throw new Error(
          `Expected array of length ${expected}, got ${Array.isArray(actual) ? actual.length : "not an array"}`
        );
      }
    },
    toMatch(regex: RegExp) {
      if (typeof actual !== "string" || !regex.test(actual)) {
        throw new Error(`Expected "${actual}" to match ${regex}`);
      }
    },
  };
}

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

// ============================================================================
// Test 1: Strikt verbotene ID-Felder
// ============================================================================

describe("Compliance Guard - Strikt verbotene ID-Felder", () => {
  test("should throw on staffId (strikt verboten)", () => {
    const invalidInput = { groups: [{ groupKey: "ZFA", headcount: 5, staffId: "staff-123" }] };
    expect(() => assertNoPersonLevel(invalidInput)).toThrow(HrComplianceError);
  });

  test("should throw on employeeId (strikt verboten)", () => {
    const invalidInput = { data: { employeeId: "emp-456", metrics: { value: 100 } } };
    expect(() => assertNoPersonLevel(invalidInput)).toThrow(HrComplianceError);
  });

  test("should throw on personId (strikt verboten)", () => {
    const invalidInput = { personId: "p-789" };
    expect(() => assertNoPersonLevel(invalidInput)).toThrow(HrComplianceError);
  });

  test("should throw on nested person IDs in arrays", () => {
    const invalidInput = {
      records: [
        { type: "absence", staffId: "s1" },
        { type: "overtime", staffId: "s2" },
      ],
    };
    expect(() => assertNoPersonLevel(invalidInput)).toThrow(HrComplianceError);
  });

  test("should check all FORBIDDEN_ID_FIELDS", () => {
    for (const field of FORBIDDEN_ID_FIELDS) {
      const invalidInput = { [field]: "test-value" };
      expect(() => assertNoPersonLevel(invalidInput)).toThrow(HrComplianceError);
    }
  });
});

// ============================================================================
// Test 2: Kontextuell verbotene Felder in HR-Analytics
// ============================================================================

describe("Compliance Guard - Kontextuelle Felder (nur in HR-Analytics verboten)", () => {
  test("should throw on firstName in HR-Analytics input", () => {
    const invalidInput = { firstName: "Max", headcount: 5 };
    expect(() => assertNoPersonLevel(invalidInput)).toThrow(HrComplianceError);
  });

  test("should throw on email in HR-Analytics input", () => {
    const invalidInput = { groups: [{ groupKey: "ZFA", email: "test@example.com" }] };
    expect(() => assertNoPersonLevel(invalidInput)).toThrow(HrComplianceError);
  });

  test("should throw on phone in HR-Analytics input", () => {
    const invalidInput = { phone: "+49123456" };
    expect(() => assertNoPersonLevel(invalidInput)).toThrow(HrComplianceError);
  });

  test("should check all FORBIDDEN_IN_HR_ANALYTICS fields", () => {
    for (const field of FORBIDDEN_IN_HR_ANALYTICS) {
      const invalidInput = { [field]: "test-value" };
      expect(() => assertNoPersonLevel(invalidInput)).toThrow(HrComplianceError);
    }
  });

  test("should allow valid aggregated input without forbidden fields", () => {
    const validInput: HrAggregatedGroupInput = {
      groupKey: "ZFA",
      headcount: 5,
      totalFte: 4.5,
      totalContractedHoursPerWeek: 180,
      totalOvertimeMinutes: 600,
      totalAbsenceDays: 3,
      absenceByType: { sick: 2, vacation: 1, training: 0, other: 0 },
    };
    expect(() => assertNoPersonLevel(validInput)).not.toThrow();
  });
});

// ============================================================================
// Test 3: k-Anonymitaet - Konfigurierbar
// ============================================================================

describe("k-Anonymitaet - Konfigurierbar (min. 3, empfohlen 5)", () => {
  test("should have K_ANONYMITY_ABSOLUTE_MIN = 3", () => {
    expect(K_ANONYMITY_ABSOLUTE_MIN).toBe(3);
  });

  test("should have K_ANONYMITY_RECOMMENDED_MIN = 5", () => {
    expect(K_ANONYMITY_RECOMMENDED_MIN).toBe(5);
  });

  test("validateKMin should accept kMin >= 5 without warning", () => {
    const result = validateKMin(5);
    expect(result.value).toBe(5);
    expect(result.warning).toBeUndefined();
  });

  test("validateKMin should accept kMin = 3 with warning", () => {
    const result = validateKMin(3);
    expect(result.value).toBe(3);
    expect(result.warning).toBeDefined();
    expect(result.warning!).toContain("unter dem empfohlenen Wert");
  });

  test("validateKMin should accept kMin = 4 with warning", () => {
    const result = validateKMin(4);
    expect(result.value).toBe(4);
    expect(result.warning).toBeDefined();
  });

  test("validateKMin should throw for kMin < 3", () => {
    expect(() => validateKMin(2)).toThrow();
    expect(() => validateKMin(1)).toThrow();
    expect(() => validateKMin(0)).toThrow();
  });

  test("enforceKAnonymity should allow group with 5 members (default kMin)", () => {
    const result = enforceKAnonymity(5, 5);
    expect(result.allowed).toBe(true);
  });

  test("enforceKAnonymity should allow group with 3 members when kMin=3", () => {
    const result = enforceKAnonymity(3, 3);
    expect(result.allowed).toBe(true);
  });

  test("enforceKAnonymity should reject group with 2 members when kMin=3", () => {
    const result = enforceKAnonymity(2, 3);
    expect(result.allowed).toBe(false);
    expect(result.fallbackLevel).toBe(HrAggregationLevel.PRACTICE);
  });

  test("filterAndAggregateByKAnonymity should work with custom kMin=3", () => {
    const groups: HrAggregatedGroupInput[] = [
      {
        groupKey: "ZFA",
        headcount: 3,
        totalFte: 3.0,
        totalContractedHoursPerWeek: 120,
        totalOvertimeMinutes: 180,
        totalAbsenceDays: 1,
        absenceByType: { sick: 1, vacation: 0, training: 0, other: 0 },
      },
    ];

    const result = filterAndAggregateByKAnonymity(groups, 3);
    expect(result.length).toBe(1); // Gruppe bleibt erhalten bei kMin=3
    expect(result[0].groupKey).toBe("ZFA");
  });
});

// ============================================================================
// Test 4: Snapshots enthalten keine person fields
// ============================================================================

describe("KPI Snapshots - Keine Person Fields", () => {
  const validInput: HrPracticeInput = {
    periodStart: new Date("2024-01-01"),
    periodEnd: new Date("2024-01-31"),
    targetFte: 10,
    workdaysPerWeek: 5,
    monthlyRevenue: 50000,
    groups: [
      {
        groupKey: "ZFA",
        headcount: 6,
        totalFte: 5.5,
        totalContractedHoursPerWeek: 220,
        totalOvertimeMinutes: 600,
        totalAbsenceDays: 3,
        absenceByType: { sick: 2, vacation: 1, training: 0, other: 0 },
      },
      {
        groupKey: "ZAHNARZT",
        headcount: 5,
        totalFte: 4.0,
        totalContractedHoursPerWeek: 160,
        totalOvertimeMinutes: 480,
        totalAbsenceDays: 1,
        absenceByType: { sick: 1, vacation: 0, training: 0, other: 0 },
      },
    ],
  };

  test("should produce snapshot without staffId/employeeId", () => {
    const snapshot = computePracticeSnapshot(validInput);
    const jsonStr = JSON.stringify(snapshot);
    expect(jsonStr).not.toContain("staffId");
    expect(jsonStr).not.toContain("employeeId");
    expect(jsonStr).not.toContain("personId");
  });

  test("should produce snapshot without any FORBIDDEN_ID_FIELDS", () => {
    const snapshot = computePracticeSnapshot(validInput);
    const jsonStr = JSON.stringify(snapshot).toLowerCase();
    for (const field of FORBIDDEN_ID_FIELDS) {
      expect(jsonStr).not.toContain(field.toLowerCase());
    }
  });

  test("should include audit metadata with compliance info", () => {
    const snapshot = computePracticeSnapshot(validInput);
    expect(snapshot.audit).toBeDefined();
    expect(snapshot.audit.aggregationLevel).toBe(HrAggregationLevel.PRACTICE);
    expect(snapshot.audit.kUsed).toBe(5);
    expect(snapshot.audit.legalBasis).toContain("DSGVO");
    expect(snapshot.audit.complianceVersion).toBeDefined();
  });

  test("should throw when input contains forbidden ID fields", () => {
    const invalidInput = {
      ...validInput,
      groups: [{ ...validInput.groups[0], staffId: "forbidden-123" }],
    };
    expect(() => computePracticeSnapshot(invalidInput as any)).toThrow(HrComplianceError);
  });

  test("should compute role snapshots without person fields", () => {
    const snapshots = computeRoleSnapshots(validInput);
    for (const snapshot of snapshots) {
      const jsonStr = JSON.stringify(snapshot);
      expect(jsonStr).not.toContain("staffId");
      expect(jsonStr).not.toContain("employeeId");
    }
  });
});

// ============================================================================
// Test 5: Alerts - Personenbezogene vs. Systemische Begriffe
// ============================================================================

describe("Text Compliance - Differenzierte Begriffspruefung", () => {
  // STRIKT VERBOTEN - Personenbezogene Referenzen
  test("should throw on 'Mitarbeiter ' (personenbezogen)", () => {
    expect(() => assertTextCompliance("Mitarbeiter X ist krank")).toThrow(HrComplianceError);
  });

  test("should throw on 'Kollege' (personenbezogen)", () => {
    expect(() => assertTextCompliance("Der Kollege hat Probleme")).toThrow(HrComplianceError);
  });

  test("should throw on 'ueberfordert' (personenbezogen)", () => {
    expect(() => assertTextCompliance("Person ist ueberfordert")).toThrow(HrComplianceError);
  });

  test("should throw on 'Risikoprofil' (verboten)", () => {
    expect(() => assertTextCompliance("Das Risikoprofil zeigt...")).toThrow(HrComplianceError);
  });

  // ERLAUBT - Systemische/organisatorische Begriffe
  test("should allow 'Mitarbeiteranzahl' (kein Personenbezug)", () => {
    expect(() => assertTextCompliance("Die Mitarbeiteranzahl betraegt 10")).not.toThrow();
  });

  test("should allow 'Systemische Ueberlastung' (organisatorisch)", () => {
    expect(() => assertTextCompliance("Systemische Ueberlastung erkannt")).not.toThrow();
  });

  test("should allow 'Kapazitaetsengpass' (organisatorisch)", () => {
    expect(() => assertTextCompliance("Kapazitaetsengpass erfordert Massnahmen")).not.toThrow();
  });
});

// ============================================================================
// Test 6: Stress/Burnout - Kontextsensitiv
// ============================================================================

describe("Stress/Burnout - Systemisch erlaubt, personenbezogen verboten", () => {
  // VERBOTEN - Personenbezogene Verwendung
  test("should throw on 'hat Stress' (personenbezogen)", () => {
    expect(() => assertTextCompliance("Max hat Stress")).toThrow(HrComplianceError);
  });

  test("should throw on 'leidet unter Stress' (personenbezogen)", () => {
    expect(() => assertTextCompliance("Sie leidet unter Stress")).toThrow(HrComplianceError);
  });

  test("should throw on 'hat Burnout' (personenbezogen)", () => {
    expect(() => assertTextCompliance("Mitarbeiter hat Burnout")).toThrow(HrComplianceError);
  });

  test("should throw on 'Burnout bei' (personenbezogen)", () => {
    expect(() => assertTextCompliance("Burnout bei Person X")).toThrow(HrComplianceError);
  });

  // ERLAUBT - Systemische Verwendung
  test("should allow 'Stressfaktoren' (systemisch)", () => {
    expect(() => assertTextCompliance("Arbeitsbedingte Stressfaktoren analysieren")).not.toThrow();
  });

  test("should allow 'Stresspraevention' (systemisch)", () => {
    expect(() => assertTextCompliance("Massnahmen zur Stresspraevention")).not.toThrow();
  });

  test("should allow 'Burnout-Praevention' (systemisch)", () => {
    expect(() => assertTextCompliance("Burnout-Praevention im Team")).not.toThrow();
  });

  test("should allow 'Stressbelastung im Team' (systemisch)", () => {
    expect(() => assertTextCompliance("Systemische Stressbelastung im Team reduzieren")).not.toThrow();
  });
});

// ============================================================================
// Test 7: Group Key Sanitization
// ============================================================================

describe("Group Key Sanitization", () => {
  test("should normalize valid role keys", () => {
    expect(sanitizeGroupKey("zfa")).toBe("ZFA");
    expect(sanitizeGroupKey("Zahnmedizinische Fachangestellte")).toBe("ZFA");
    expect(sanitizeGroupKey("DH")).toBe("DH");
    expect(sanitizeGroupKey("Dentalhygienikerin")).toBe("DH");
    expect(sanitizeGroupKey("zahnarzt")).toBe("ZAHNARZT");
    expect(sanitizeGroupKey("Empfang")).toBe("EMPFANG");
  });

  test("should return SONSTIGE for unknown roles", () => {
    expect(sanitizeGroupKey("Spezialrolle XYZ")).toBe("SONSTIGE");
    expect(sanitizeGroupKey("Unknown")).toBe("SONSTIGE");
  });

  test("should handle practice key", () => {
    expect(sanitizeGroupKey("practice")).toBe("practice");
    expect(sanitizeGroupKey("PRACTICE")).toBe("practice");
  });
});

// ============================================================================
// Test 8: Input Validation mit konfigurierbarem kMin
// ============================================================================

describe("Input Validation - Mit kMin Konfiguration", () => {
  test("should validate correct input with default kMin=5", () => {
    const validGroups: HrAggregatedGroupInput[] = [
      {
        groupKey: "ZFA",
        headcount: 5,
        totalFte: 4.5,
        totalContractedHoursPerWeek: 180,
        totalOvertimeMinutes: 300,
        totalAbsenceDays: 2,
        absenceByType: { sick: 1, vacation: 1, training: 0, other: 0 },
      },
    ];

    const result = validateAggregatedInput(validGroups, 5);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("should reject input with forbidden ID fields", () => {
    const invalidGroups = [
      {
        groupKey: "ZFA",
        headcount: 5,
        staffId: "forbidden",
        totalFte: 4.5,
        totalContractedHoursPerWeek: 180,
        totalOvertimeMinutes: 300,
        totalAbsenceDays: 2,
        absenceByType: { sick: 1, vacation: 1, training: 0, other: 0 },
      },
    ];

    const result = validateAggregatedInput(invalidGroups as any, 5);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("should warn about k-anonymity violations", () => {
    const smallGroups: HrAggregatedGroupInput[] = [
      {
        groupKey: "ZFA",
        headcount: 2,
        totalFte: 2.0,
        totalContractedHoursPerWeek: 80,
        totalOvertimeMinutes: 60,
        totalAbsenceDays: 1,
        absenceByType: { sick: 1, vacation: 0, training: 0, other: 0 },
      },
    ];

    const result = validateAggregatedInput(smallGroups, 5);
    expect(result.valid).toBe(true); // Warnung, kein Fehler
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("k-Anonymitaet");
  });

  test("should add warning when kMin < 5", () => {
    const validGroups: HrAggregatedGroupInput[] = [
      {
        groupKey: "ZFA",
        headcount: 3,
        totalFte: 3.0,
        totalContractedHoursPerWeek: 120,
        totalOvertimeMinutes: 180,
        totalAbsenceDays: 1,
        absenceByType: { sick: 1, vacation: 0, training: 0, other: 0 },
      },
    ];

    const result = validateAggregatedInput(validGroups, 3);
    expect(result.valid).toBe(true);
    // Sollte Warnung wegen kMin < 5 enthalten
    const hasKMinWarning = result.warnings.some(w => w.includes("unter dem empfohlenen"));
    expect(hasKMinWarning).toBe(true);
  });

  test("should fail when kMin < 3 (absolute minimum)", () => {
    const groups: HrAggregatedGroupInput[] = [
      {
        groupKey: "ZFA",
        headcount: 2,
        totalFte: 2.0,
        totalContractedHoursPerWeek: 80,
        totalOvertimeMinutes: 60,
        totalAbsenceDays: 1,
        absenceByType: { sick: 1, vacation: 0, training: 0, other: 0 },
      },
    ];

    const result = validateAggregatedInput(groups, 2);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("absoluten Minimum");
  });
});

// ============================================================================
// Test 9: Full Integration Test
// ============================================================================

describe("Full Integration - DSGVO Compliance v2.0", () => {
  test("should process valid aggregated data end-to-end", () => {
    const input: HrPracticeInput = {
      periodStart: new Date("2024-01-01"),
      periodEnd: new Date("2024-01-31"),
      targetFte: 10,
      workdaysPerWeek: 5,
      monthlyRevenue: 50000,
      groups: [
        {
          groupKey: "ZFA",
          headcount: 6,
          totalFte: 5.5,
          totalContractedHoursPerWeek: 220,
          totalOvertimeMinutes: 300,
          totalAbsenceDays: 2,
          absenceByType: { sick: 1, vacation: 1, training: 0, other: 0 },
        },
        {
          groupKey: "ZAHNARZT",
          headcount: 5,
          totalFte: 4.0,
          totalContractedHoursPerWeek: 160,
          totalOvertimeMinutes: 120,
          totalAbsenceDays: 1,
          absenceByType: { sick: 0, vacation: 1, training: 0, other: 0 },
        },
      ],
    };

    const snapshot = computePracticeSnapshot(input);
    const alerts = generateHrAlerts(snapshot);

    // Verify compliance
    expect(snapshot.aggregationLevel).toBe(HrAggregationLevel.PRACTICE);
    expect(snapshot.audit.kUsed).toBe(5);
    expect(snapshot.audit.legalBasis).toContain("DSGVO");

    // Verify no forbidden ID fields as keys (not substrings in legal text)
    const jsonStr = JSON.stringify({ snapshot, alerts });
    // Check for actual field keys, not substrings
    expect(jsonStr).not.toContain('"staffId"');
    expect(jsonStr).not.toContain('"employeeId"');
    expect(jsonStr).not.toContain('"personId"');
    expect(jsonStr).not.toContain('"memberId"');
    expect(jsonStr).not.toContain('"mitarbeiterId"');
  });

  test("should reject any attempt to include person-level IDs", () => {
    const invalidInput = {
      periodStart: new Date("2024-01-01"),
      periodEnd: new Date("2024-01-31"),
      targetFte: 10,
      workdaysPerWeek: 5,
      groups: [
        {
          groupKey: "ZFA",
          headcount: 6,
          totalFte: 5.5,
          totalContractedHoursPerWeek: 220,
          totalOvertimeMinutes: 300,
          totalAbsenceDays: 2,
          absenceByType: { sick: 1, vacation: 1, training: 0, other: 0 },
          staffId: "hidden-staff-123",
        },
      ],
    };

    expect(() => computePracticeSnapshot(invalidInput as any)).toThrow(HrComplianceError);
  });

  test("should work with custom kMin=3 for small practices", () => {
    const input: HrPracticeInput = {
      periodStart: new Date("2024-01-01"),
      periodEnd: new Date("2024-01-31"),
      targetFte: 4,
      workdaysPerWeek: 5,
      groups: [
        {
          groupKey: "ZAHNARZT",
          headcount: 3,
          totalFte: 3.0,
          totalContractedHoursPerWeek: 120,
          totalOvertimeMinutes: 60,
          totalAbsenceDays: 1,
          absenceByType: { sick: 1, vacation: 0, training: 0, other: 0 },
        },
      ],
    };

    const customThresholds = { ...DEFAULT_HR_THRESHOLDS, kMin: 3 };
    const snapshots = computeRoleSnapshots(input, customThresholds);

    // Sollte 1 Snapshot haben (Gruppe mit 3 ist k-anonym bei kMin=3)
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].audit.kUsed).toBe(3);
  });
});

// ============================================================================
// Run Tests
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("HR Module DSGVO-Compliance Tests v2.0");
console.log("=".repeat(60));

// Execute all describe blocks (they self-execute above)

console.log("\n" + "=".repeat(60));
console.log(`Results: ${passCount} passed, ${failCount} failed`);
console.log("=".repeat(60));

if (failCount > 0) {
  process.exit(1);
}
