/**
 * Regression tests for hardened staff role mapping
 *
 * Tests Praxisflow German role variations, umlauts, pattern matching,
 * and debug output without PII.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { evaluateStaffingRatios, type StaffingRatioInput } from "../server/ai/benchmarks.js";

// =============================================================================
// Role Normalization (mirrored from advisor.ts for testing)
// =============================================================================

function normalizeStaffRole(role: unknown): string {
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

// Provider patterns (must match advisor.ts)
const PROVIDER_ROLES_EXACT = new Set([
  "dentist", "doctor", "zahnarzt", "zahnarztin", "arzt", "aerztin",
  "behandler", "behandlerin", "zahnarzt_inhaber", "zahnarztinhaber",
  "dr", "dr_med", "dr_med_dent",
]);

const PROVIDER_PATTERNS = [
  /zahnarzt/, /zahnaerzt/, /dentist/, /behandler/,
  /^arzt/, /^aerztin?$/, /^doctor$/, /^dr$/,
];

const CLINICAL_ASSISTANT_ROLES_EXACT = new Set([
  "zfa", "dh", "mfa",
  "sterilization_assistant", "sterilisationsassistent", "sterilisationsassistentin",
  "assistant", "nurse", "dental_assistant", "medical_assistant",
  "assistenz", "assistentin", "prophylaxe", "prophylaxeassistentin",
  "zfa_prophylaxe", "zfaprophylaxe", "hygienist", "dentalhygienist",
  "dental_hygienist", "zahnmedizinische_fachangestellte",
]);

const CLINICAL_ASSISTANT_PATTERNS = [
  /zfa/, /mfa/, /assist/, /hygien/, /prophy/, /steril/, /^dh$/,
];

const FRONTDESK_ROLES_EXACT = new Set([
  "empfang", "rezeption", "anmeldung",
  "receptionist", "frontdesk", "front_desk", "reception",
  "empfangsmitarbeiter", "empfangsmitarbeiterin",
  "rezeptionist", "rezeptionistin",
  "anmeldekraft", "terminverwaltung",
]);

const FRONTDESK_PATTERNS = [
  /empfang/, /rezept/, /anmeld/, /front/, /^reception/, /termin/,
];

const EXCLUDED_ROLES_EXACT = new Set([
  "practice_manager", "praxismanager", "praxismanagerin",
  "manager", "managerin", "admin", "administrator",
  "geschaeftsfuehrer", "geschaeftsfuehrerin",
  "inhaber", "inhaberin",
  "buchhaltung", "verwaltung",
]);

const EXCLUDED_PATTERNS = [
  /manager/, /admin/, /geschaeftsfuehr/, /buchhalt/, /verwalt/,
];

type RoleCategory = "provider" | "clinical_assistant" | "frontdesk" | "excluded" | "unknown";

function classifyRole(normalizedRole: string): RoleCategory {
  if (!normalizedRole) return "unknown";

  // 1) Excluded first
  if (EXCLUDED_ROLES_EXACT.has(normalizedRole)) return "excluded";
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(normalizedRole)) return "excluded";
  }

  // 2) Provider
  if (PROVIDER_ROLES_EXACT.has(normalizedRole)) return "provider";
  for (const pattern of PROVIDER_PATTERNS) {
    if (pattern.test(normalizedRole)) return "provider";
  }

  // 3) Clinical assistant
  if (CLINICAL_ASSISTANT_ROLES_EXACT.has(normalizedRole)) return "clinical_assistant";
  for (const pattern of CLINICAL_ASSISTANT_PATTERNS) {
    if (pattern.test(normalizedRole)) return "clinical_assistant";
  }

  // 4) Frontdesk
  if (FRONTDESK_ROLES_EXACT.has(normalizedRole)) return "frontdesk";
  for (const pattern of FRONTDESK_PATTERNS) {
    if (pattern.test(normalizedRole)) return "frontdesk";
  }

  return "unknown";
}

interface MockStaff {
  role: string;
  fte?: number;
}

interface StaffingDebugInfo {
  providersCount: number;
  clinicalAssistantsCount: number;
  frontdeskCount: number;
  supportTotalCount: number;
  excludedCount: number;
  providersFte: number;
  clinicalAssistantsFte: number;
  frontdeskFte: number;
  supportTotalFte: number;
  roleHistogram: Record<string, number>;
  unknownRoles: string[];
}

function classifyStaffWithDebug(staff: MockStaff[]): StaffingDebugInfo {
  const getFte = (s: MockStaff) => (s.fte !== undefined && s.fte !== null ? s.fte : 1.0);

  const providerStaff: MockStaff[] = [];
  const clinicalAssistantStaff: MockStaff[] = [];
  const frontdeskStaff: MockStaff[] = [];
  const excludedStaff: MockStaff[] = [];
  const unknownRolesSet = new Set<string>();
  const roleHistogram: Record<string, number> = {};

  for (const s of staff) {
    const normalizedRole = normalizeStaffRole(s.role);
    const category = classifyRole(normalizedRole);

    if (normalizedRole) {
      roleHistogram[normalizedRole] = (roleHistogram[normalizedRole] || 0) + 1;
    }

    switch (category) {
      case "provider":
        providerStaff.push(s);
        break;
      case "clinical_assistant":
        clinicalAssistantStaff.push(s);
        break;
      case "frontdesk":
        frontdeskStaff.push(s);
        break;
      case "excluded":
        excludedStaff.push(s);
        break;
      case "unknown":
        if (normalizedRole) unknownRolesSet.add(normalizedRole);
        break;
    }
  }

  return {
    providersCount: providerStaff.length,
    clinicalAssistantsCount: clinicalAssistantStaff.length,
    frontdeskCount: frontdeskStaff.length,
    supportTotalCount: clinicalAssistantStaff.length + frontdeskStaff.length,
    excludedCount: excludedStaff.length,
    providersFte: providerStaff.reduce((sum, s) => sum + getFte(s), 0),
    clinicalAssistantsFte: clinicalAssistantStaff.reduce((sum, s) => sum + getFte(s), 0),
    frontdeskFte: frontdeskStaff.reduce((sum, s) => sum + getFte(s), 0),
    supportTotalFte: clinicalAssistantStaff.reduce((sum, s) => sum + getFte(s), 0) +
      frontdeskStaff.reduce((sum, s) => sum + getFte(s), 0),
    roleHistogram,
    unknownRoles: Array.from(unknownRolesSet).sort(),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("Hardened Role Normalization", () => {
  describe("normalizeStaffRole", () => {
    it("should replace German umlauts", () => {
      assert.strictEqual(normalizeStaffRole("Zahnärztin"), "zahnaerztin");
      assert.strictEqual(normalizeStaffRole("Geschäftsführer"), "geschaeftsfuehrer");
      assert.strictEqual(normalizeStaffRole("Prüfer"), "pruefer");
      assert.strictEqual(normalizeStaffRole("Größe"), "groesse");
    });

    it("should remove parentheses and punctuation", () => {
      assert.strictEqual(normalizeStaffRole("ZFA (Prophylaxe)"), "zfa_prophylaxe");
      assert.strictEqual(normalizeStaffRole("Dr. med."), "dr_med");
      assert.strictEqual(normalizeStaffRole("Assistenz, Empfang"), "assistenz_empfang");
    });

    it("should handle spaces and hyphens", () => {
      assert.strictEqual(normalizeStaffRole("front desk"), "front_desk");
      assert.strictEqual(normalizeStaffRole("practice-manager"), "practice_manager");
      assert.strictEqual(normalizeStaffRole("Zahnarzt-Inhaber"), "zahnarzt_inhaber");
    });

    it("should collapse multiple underscores", () => {
      assert.strictEqual(normalizeStaffRole("ZFA__Prophylaxe"), "zfa_prophylaxe");
      assert.strictEqual(normalizeStaffRole("front___desk"), "front_desk");
    });

    it("should remove leading/trailing underscores", () => {
      assert.strictEqual(normalizeStaffRole("_ZFA_"), "zfa");
      assert.strictEqual(normalizeStaffRole("__empfang__"), "empfang");
    });
  });

  describe("Provider Role Classification", () => {
    const providerVariants = [
      "dentist", "Dentist", "DENTIST",
      "doctor", "Doctor",
      "zahnarzt", "Zahnarzt", "ZAHNARZT",
      "zahnärztin", "Zahnärztin",
      "arzt", "Arzt",
      "behandler", "Behandler",
      "Zahnarzt-Inhaber", "zahnarzt_inhaber",
      "Dr.", "dr", "Dr. med.", "Dr. med. dent.",
    ];

    for (const role of providerVariants) {
      it(`should classify "${role}" as provider`, () => {
        const normalized = normalizeStaffRole(role);
        const category = classifyRole(normalized);
        assert.strictEqual(category, "provider", `"${role}" → "${normalized}" should be provider`);
      });
    }
  });

  describe("Clinical Assistant Role Classification", () => {
    const clinicalVariants = [
      "zfa", "ZFA",
      "zfa_prophylaxe", "ZFA (Prophylaxe)", "ZFA-Prophylaxe",
      "dh", "DH",
      "mfa", "MFA",
      "assistant", "Assistenz", "Assistentin",
      "nurse",
      "sterilization_assistant", "Sterilisationsassistent",
      "prophylaxe", "Prophylaxeassistentin",
      "dental hygienist", "Dental-Hygienist",
      "Zahnmedizinische Fachangestellte",
    ];

    for (const role of clinicalVariants) {
      it(`should classify "${role}" as clinical_assistant`, () => {
        const normalized = normalizeStaffRole(role);
        const category = classifyRole(normalized);
        assert.strictEqual(category, "clinical_assistant", `"${role}" → "${normalized}" should be clinical_assistant`);
      });
    }
  });

  describe("Frontdesk Role Classification", () => {
    const frontdeskVariants = [
      "empfang", "Empfang",
      "rezeption", "Rezeption",
      "anmeldung", "Anmeldung",
      "receptionist", "Receptionist",
      "frontdesk", "front desk", "front-desk",
      "Empfangsmitarbeiter", "Empfangsmitarbeiterin",
      "Rezeptionist", "Rezeptionistin",
      "Anmeldekraft",
    ];

    for (const role of frontdeskVariants) {
      it(`should classify "${role}" as frontdesk`, () => {
        const normalized = normalizeStaffRole(role);
        const category = classifyRole(normalized);
        assert.strictEqual(category, "frontdesk", `"${role}" → "${normalized}" should be frontdesk`);
      });
    }
  });

  describe("Excluded Role Classification", () => {
    const excludedVariants = [
      "practice_manager", "Practice Manager", "practice-manager",
      "praxismanager", "Praxismanager", "Praxismanagerin",
      "manager", "Manager", "Managerin",
      "admin", "Administrator",
      "Geschäftsführer", "Geschäftsführerin",
      "Inhaber", "Inhaberin",
      "Buchhaltung",
      "Verwaltung",
    ];

    for (const role of excludedVariants) {
      it(`should classify "${role}" as excluded`, () => {
        const normalized = normalizeStaffRole(role);
        const category = classifyRole(normalized);
        assert.strictEqual(category, "excluded", `"${role}" → "${normalized}" should be excluded`);
      });
    }
  });
});

describe("Praxisflow Role Mapping Integration", () => {
  it("Test 1: Praxisflow role variants are correctly classified", () => {
    const staff: MockStaff[] = [
      { role: "behandler", fte: 1.0 },
      { role: "Zahnärztin", fte: 0.8 },
      { role: "rezeption", fte: 1.0 },
      { role: "anmeldung", fte: 0.5 },
      { role: "zfa_prophylaxe", fte: 1.0 },
    ];

    const debug = classifyStaffWithDebug(staff);

    assert.strictEqual(debug.providersCount, 2, "Should have 2 providers (behandler + zahnärztin)");
    assert.strictEqual(debug.clinicalAssistantsCount, 1, "Should have 1 clinical assistant (zfa_prophylaxe)");
    assert.strictEqual(debug.frontdeskCount, 2, "Should have 2 frontdesk (rezeption + anmeldung)");
    assert.strictEqual(debug.excludedCount, 0, "Should have 0 excluded");

    console.log("Test 1 - Praxisflow variants:", debug);
  });

  it("Test 2: unknownRoles are collected and contain only role strings (no IDs)", () => {
    const staff: MockStaff[] = [
      { role: "dentist", fte: 1.0 },
      { role: "unknown_role_xyz", fte: 1.0 },
      { role: "custom_specialist", fte: 0.5 },
      { role: "labor_techniker", fte: 1.0 },
    ];

    const debug = classifyStaffWithDebug(staff);

    // Check unknown roles are strings, not IDs
    assert.strictEqual(debug.unknownRoles.length, 3);
    assert.ok(debug.unknownRoles.includes("unknown_role_xyz"));
    assert.ok(debug.unknownRoles.includes("custom_specialist"));
    assert.ok(debug.unknownRoles.includes("labor_techniker"));

    // Ensure no ID-like strings (UUIDs, etc.)
    for (const role of debug.unknownRoles) {
      assert.ok(!role.includes("-") || role.indexOf("-") === role.lastIndexOf("-"),
        `Unknown role "${role}" should not look like a UUID`);
      assert.ok(role.length < 50, `Unknown role "${role}" should not be too long`);
    }

    console.log("Test 2 - Unknown roles (no IDs):", debug.unknownRoles);
  });

  it("Test 3: providersCount > 0 => ratios != 0", () => {
    const staff: MockStaff[] = [
      { role: "zahnarzt", fte: 1.0 },
      { role: "zfa", fte: 1.5 },
      { role: "empfang", fte: 1.0 },
    ];

    const debug = classifyStaffWithDebug(staff);

    assert.strictEqual(debug.providersCount, 1);
    assert.strictEqual(debug.clinicalAssistantsCount, 1);
    assert.strictEqual(debug.frontdeskCount, 1);

    // Build input for evaluateStaffingRatios
    const input: StaffingRatioInput = {
      providersCount: debug.providersCount,
      clinicalAssistantsCount: debug.clinicalAssistantsCount,
      frontdeskCount: debug.frontdeskCount,
      supportTotalCount: debug.supportTotalCount,
      providersFte: debug.providersFte,
      clinicalAssistantsFte: debug.clinicalAssistantsFte,
      frontdeskFte: debug.frontdeskFte,
      supportTotalFte: debug.supportTotalFte,
      totalStaff: staff.length,
      examRooms: 3,
      practiceType: "dental",
    };

    const result = evaluateStaffingRatios(input);

    // Ratios should NOT be 0 when we have providers
    assert.ok(result.ratios.clinicalAssistantRatio.actual > 0,
      `clinicalAssistantRatio should be > 0, got ${result.ratios.clinicalAssistantRatio.actual}`);
    assert.ok(result.ratios.frontdeskRatio.actual > 0,
      `frontdeskRatio should be > 0, got ${result.ratios.frontdeskRatio.actual}`);
    assert.ok(result.ratios.supportTotalRatio.actual > 0,
      `supportTotalRatio should be > 0, got ${result.ratios.supportTotalRatio.actual}`);

    console.log("Test 3 - Ratios with provider:", {
      clinicalAssistantRatio: result.ratios.clinicalAssistantRatio.actual,
      frontdeskRatio: result.ratios.frontdeskRatio.actual,
      supportTotalRatio: result.ratios.supportTotalRatio.actual,
    });
  });

  it("Test 4: providersCount=0 => ratios are 0 with appropriate recommendation", () => {
    const staff: MockStaff[] = [
      { role: "zfa", fte: 1.0 },
      { role: "empfang", fte: 1.0 },
      { role: "practice_manager", fte: 1.0 },
    ];

    const debug = classifyStaffWithDebug(staff);

    assert.strictEqual(debug.providersCount, 0, "Should have 0 providers");
    assert.strictEqual(debug.clinicalAssistantsCount, 1);
    assert.strictEqual(debug.frontdeskCount, 1);
    assert.strictEqual(debug.excludedCount, 1);

    // Build input for evaluateStaffingRatios
    const input: StaffingRatioInput = {
      providersCount: 0,
      clinicalAssistantsCount: debug.clinicalAssistantsCount,
      frontdeskCount: debug.frontdeskCount,
      supportTotalCount: debug.supportTotalCount,
      providersFte: 0,
      clinicalAssistantsFte: debug.clinicalAssistantsFte,
      frontdeskFte: debug.frontdeskFte,
      supportTotalFte: debug.supportTotalFte,
      totalStaff: staff.length,
      examRooms: 3,
      practiceType: "dental",
    };

    const result = evaluateStaffingRatios(input);

    // Ratios should be 0 when no providers
    assert.strictEqual(result.ratios.clinicalAssistantRatio.actual, 0);
    assert.strictEqual(result.ratios.frontdeskRatio.actual, 0);
    assert.strictEqual(result.ratios.supportTotalRatio.actual, 0);

    // Recommendation should mention Behandler
    assert.ok(
      result.ratios.clinicalAssistantRatio.recommendation.includes("Behandler"),
      `Recommendation should mention Behandler: "${result.ratios.clinicalAssistantRatio.recommendation}"`
    );

    console.log("Test 4 - No providers:", {
      providersCount: debug.providersCount,
      ratios: {
        clinicalAssistant: result.ratios.clinicalAssistantRatio.actual,
        frontdesk: result.ratios.frontdeskRatio.actual,
        supportTotal: result.ratios.supportTotalRatio.actual,
      },
      recommendation: result.ratios.clinicalAssistantRatio.recommendation,
    });
  });

  it("should handle the original Praxisflow test case", () => {
    // Original test case from requirements
    const staff: MockStaff[] = [
      { role: "dentist", fte: 1.0 },
      { role: "zfa", fte: 1.0 },
      { role: "zfa", fte: 0.5 },
      { role: "dh", fte: 0.8 },
      { role: "empfang", fte: 1.0 },
      { role: "practice_manager", fte: 1.0 }, // Excluded
    ];

    const debug = classifyStaffWithDebug(staff);

    // Verify expected counts
    assert.strictEqual(debug.providersCount, 1, "providersCount should be 1");
    assert.strictEqual(debug.clinicalAssistantsCount, 3, "clinicalAssistantsCount should be 3 (2 zfa + 1 dh)");
    assert.strictEqual(debug.frontdeskCount, 1, "frontdeskCount should be 1");
    assert.strictEqual(debug.supportTotalCount, 4, "supportTotalCount should be 4");
    assert.strictEqual(debug.excludedCount, 1, "excludedCount should be 1 (practice_manager)");

    // Verify FTE
    assert.strictEqual(debug.providersFte, 1.0, "providersFte should be 1.0");
    assert.ok(Math.abs(debug.clinicalAssistantsFte - 2.3) < 0.001,
      `clinicalAssistantsFte should be 2.3, got ${debug.clinicalAssistantsFte}`);
    assert.strictEqual(debug.frontdeskFte, 1.0, "frontdeskFte should be 1.0");
    assert.ok(Math.abs(debug.supportTotalFte - 3.3) < 0.001,
      `supportTotalFte should be 3.3, got ${debug.supportTotalFte}`);

    // Build input and verify ratios
    const input: StaffingRatioInput = {
      providersCount: debug.providersCount,
      clinicalAssistantsCount: debug.clinicalAssistantsCount,
      frontdeskCount: debug.frontdeskCount,
      supportTotalCount: debug.supportTotalCount,
      providersFte: debug.providersFte,
      clinicalAssistantsFte: debug.clinicalAssistantsFte,
      frontdeskFte: debug.frontdeskFte,
      supportTotalFte: debug.supportTotalFte,
      totalStaff: staff.length,
      examRooms: 4,
      practiceType: "dental",
    };

    const result = evaluateStaffingRatios(input);

    assert.strictEqual(result.ratios.clinicalAssistantRatio.actual, 3);
    assert.strictEqual(result.ratios.frontdeskRatio.actual, 1);
    assert.strictEqual(result.ratios.supportTotalRatio.actual, 4);

    // FTE ratios
    assert.ok(result.ratios.clinicalAssistantFteRatio);
    assert.ok(Math.abs(result.ratios.clinicalAssistantFteRatio.actual - 2.3) < 0.001);
    assert.ok(Math.abs(result.ratios.frontdeskFteRatio!.actual - 1.0) < 0.001);
    assert.ok(Math.abs(result.ratios.supportTotalFteRatio!.actual - 3.3) < 0.001);

    console.log("Original Praxisflow test case - PASS:", {
      debug,
      ratios: {
        clinicalAssistant: result.ratios.clinicalAssistantRatio.actual,
        clinicalAssistantFte: result.ratios.clinicalAssistantFteRatio?.actual,
        supportTotal: result.ratios.supportTotalRatio.actual,
        supportTotalFte: result.ratios.supportTotalFteRatio?.actual,
      },
    });
  });
});

describe("Debug Output Privacy", () => {
  it("roleHistogram should contain only normalized role strings, not IDs", () => {
    const staff: MockStaff[] = [
      { role: "Zahnarzt (Inhaber)", fte: 1.0 },
      { role: "ZFA", fte: 1.0 },
      { role: "ZFA", fte: 0.5 },
    ];

    const debug = classifyStaffWithDebug(staff);

    // Check histogram keys are normalized strings
    for (const key of Object.keys(debug.roleHistogram)) {
      assert.ok(/^[a-z0-9_]+$/.test(key), `Histogram key "${key}" should be normalized`);
      assert.ok(key.length < 50, `Histogram key "${key}" should not be too long`);
    }

    assert.strictEqual(debug.roleHistogram["zahnarzt_inhaber"], 1);
    assert.strictEqual(debug.roleHistogram["zfa"], 2);
  });
});
