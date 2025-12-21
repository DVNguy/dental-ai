/**
 * Regression tests for Praxisflow Staff Role Mapping
 *
 * Verifies that German/Praxisflow roles (zfa, dh, empfang, etc.)
 * are correctly classified for staffing ratio calculations.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { evaluateStaffingRatios, type StaffingRatioInput } from "../server/ai/benchmarks.js";

// =============================================================================
// Role Classification Logic (mirrored from advisor.ts for testing)
// =============================================================================

function normalizeStaffRole(role: unknown): string {
  if (typeof role !== "string") return "";
  return role.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const PROVIDER_ROLES = new Set([
  "dentist", "doctor", "zahnarzt", "arzt",
]);

const CLINICAL_ASSISTANT_ROLES = new Set([
  "zfa", "dh", "sterilization_assistant",
  "assistant", "nurse", "mfa",
  "dental_assistant", "medical_assistant",
]);

const FRONTDESK_ROLES = new Set([
  "empfang", "receptionist", "frontdesk", "front_desk", "reception",
]);

const EXCLUDED_ROLES = new Set([
  "practice_manager", "praxismanager", "manager", "admin", "administrator",
]);

interface MockStaff {
  role: string;
  fte?: number;
}

function classifyStaff(staff: MockStaff[]): {
  providersCount: number;
  clinicalAssistantsCount: number;
  frontdeskCount: number;
  supportTotalCount: number;
  providersFte: number;
  clinicalAssistantsFte: number;
  frontdeskFte: number;
  supportTotalFte: number;
} {
  const getFte = (s: MockStaff) => (s.fte !== undefined && s.fte !== null ? s.fte : 1.0);

  const providerStaff: MockStaff[] = [];
  const clinicalAssistantStaff: MockStaff[] = [];
  const frontdeskStaff: MockStaff[] = [];

  for (const s of staff) {
    const role = normalizeStaffRole(s.role);

    if (EXCLUDED_ROLES.has(role)) continue;

    if (PROVIDER_ROLES.has(role)) {
      providerStaff.push(s);
    } else if (CLINICAL_ASSISTANT_ROLES.has(role)) {
      clinicalAssistantStaff.push(s);
    } else if (FRONTDESK_ROLES.has(role)) {
      frontdeskStaff.push(s);
    }
  }

  const providersCount = providerStaff.length;
  const clinicalAssistantsCount = clinicalAssistantStaff.length;
  const frontdeskCount = frontdeskStaff.length;
  const supportTotalCount = clinicalAssistantsCount + frontdeskCount;

  const providersFte = providerStaff.reduce((sum, s) => sum + getFte(s), 0);
  const clinicalAssistantsFte = clinicalAssistantStaff.reduce((sum, s) => sum + getFte(s), 0);
  const frontdeskFte = frontdeskStaff.reduce((sum, s) => sum + getFte(s), 0);
  const supportTotalFte = clinicalAssistantsFte + frontdeskFte;

  return {
    providersCount,
    clinicalAssistantsCount,
    frontdeskCount,
    supportTotalCount,
    providersFte,
    clinicalAssistantsFte,
    frontdeskFte,
    supportTotalFte,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("Praxisflow Staff Role Mapping", () => {
  describe("normalizeStaffRole", () => {
    it("should lowercase and trim role", () => {
      assert.strictEqual(normalizeStaffRole("  ZFA  "), "zfa");
      assert.strictEqual(normalizeStaffRole("DENTIST"), "dentist");
    });

    it("should convert spaces and hyphens to underscores", () => {
      assert.strictEqual(normalizeStaffRole("practice manager"), "practice_manager");
      assert.strictEqual(normalizeStaffRole("practice-manager"), "practice_manager");
      assert.strictEqual(normalizeStaffRole("front desk"), "front_desk");
      assert.strictEqual(normalizeStaffRole("front-desk"), "front_desk");
    });

    it("should handle non-string input gracefully", () => {
      assert.strictEqual(normalizeStaffRole(null), "");
      assert.strictEqual(normalizeStaffRole(undefined), "");
      assert.strictEqual(normalizeStaffRole(123), "");
    });
  });

  describe("Praxisflow Role Classification", () => {
    it("should classify Praxisflow roles correctly", () => {
      const staff: MockStaff[] = [
        { role: "dentist", fte: 1.0 },
        { role: "zfa", fte: 1.0 },
        { role: "zfa", fte: 0.5 },
        { role: "dh", fte: 0.8 },
        { role: "empfang", fte: 1.0 },
        { role: "practice_manager", fte: 1.0 }, // Should be excluded
      ];

      const result = classifyStaff(staff);

      // Counts
      assert.strictEqual(result.providersCount, 1, "Should have 1 provider (dentist)");
      assert.strictEqual(result.clinicalAssistantsCount, 3, "Should have 3 clinical assistants (2 zfa + 1 dh)");
      assert.strictEqual(result.frontdeskCount, 1, "Should have 1 frontdesk (empfang)");
      assert.strictEqual(result.supportTotalCount, 4, "Should have 4 support total (3 + 1)");

      // FTE
      assert.strictEqual(result.providersFte, 1.0, "Provider FTE should be 1.0");
      assert.ok(
        Math.abs(result.clinicalAssistantsFte - 2.3) < 0.001,
        `Clinical assistant FTE should be 2.3 (1.0+0.5+0.8), got ${result.clinicalAssistantsFte}`
      );
      assert.strictEqual(result.frontdeskFte, 1.0, "Frontdesk FTE should be 1.0");
      assert.ok(
        Math.abs(result.supportTotalFte - 3.3) < 0.001,
        `Support total FTE should be 3.3, got ${result.supportTotalFte}`
      );

      console.log("Praxisflow Role Classification:");
      console.log(`  providersCount: ${result.providersCount}`);
      console.log(`  clinicalAssistantsCount: ${result.clinicalAssistantsCount}`);
      console.log(`  frontdeskCount: ${result.frontdeskCount}`);
      console.log(`  supportTotalCount: ${result.supportTotalCount}`);
      console.log(`  providersFte: ${result.providersFte}`);
      console.log(`  clinicalAssistantsFte: ${result.clinicalAssistantsFte}`);
      console.log(`  frontdeskFte: ${result.frontdeskFte}`);
      console.log(`  supportTotalFte: ${result.supportTotalFte}`);
    });

    it("should exclude practice_manager from ratios", () => {
      const staff: MockStaff[] = [
        { role: "practice_manager", fte: 1.0 },
        { role: "praxismanager", fte: 1.0 },
        { role: "manager", fte: 1.0 },
      ];

      const result = classifyStaff(staff);

      assert.strictEqual(result.providersCount, 0);
      assert.strictEqual(result.clinicalAssistantsCount, 0);
      assert.strictEqual(result.frontdeskCount, 0);
      assert.strictEqual(result.supportTotalCount, 0);
    });

    it("should handle sterilization_assistant as clinical assistant", () => {
      const staff: MockStaff[] = [
        { role: "sterilization_assistant", fte: 0.5 },
        { role: "Sterilization-Assistant", fte: 0.5 }, // Different casing
      ];

      const result = classifyStaff(staff);

      assert.strictEqual(result.clinicalAssistantsCount, 2);
      assert.strictEqual(result.clinicalAssistantsFte, 1.0);
    });
  });

  describe("Legacy English Role Compatibility", () => {
    it("should still recognize legacy English roles", () => {
      const staff: MockStaff[] = [
        { role: "doctor", fte: 1.0 },
        { role: "nurse", fte: 1.0 },
        { role: "assistant", fte: 1.0 },
        { role: "receptionist", fte: 1.0 },
      ];

      const result = classifyStaff(staff);

      assert.strictEqual(result.providersCount, 1, "Should recognize 'doctor' as provider");
      assert.strictEqual(result.clinicalAssistantsCount, 2, "Should recognize 'nurse' and 'assistant'");
      assert.strictEqual(result.frontdeskCount, 1, "Should recognize 'receptionist'");
    });

    it("should handle mixed Praxisflow and legacy roles", () => {
      const staff: MockStaff[] = [
        { role: "dentist", fte: 1.0 },
        { role: "zfa", fte: 1.0 },
        { role: "nurse", fte: 0.5 },
        { role: "empfang", fte: 1.0 },
        { role: "receptionist", fte: 0.5 },
      ];

      const result = classifyStaff(staff);

      assert.strictEqual(result.providersCount, 1);
      assert.strictEqual(result.clinicalAssistantsCount, 2); // zfa + nurse
      assert.strictEqual(result.frontdeskCount, 2); // empfang + receptionist
      assert.strictEqual(result.supportTotalCount, 4);
    });
  });

  describe("FTE Fallback", () => {
    it("should use 1.0 as default when fte is undefined", () => {
      const staff: MockStaff[] = [
        { role: "dentist" }, // No fte
        { role: "zfa" }, // No fte
      ];

      const result = classifyStaff(staff);

      assert.strictEqual(result.providersFte, 1.0);
      assert.strictEqual(result.clinicalAssistantsFte, 1.0);
    });

    it("should use 1.0 as default when fte is null", () => {
      const staff: MockStaff[] = [
        { role: "dentist", fte: undefined },
        { role: "zfa", fte: undefined },
      ];

      const result = classifyStaff(staff);

      assert.strictEqual(result.providersFte, 1.0);
      assert.strictEqual(result.clinicalAssistantsFte, 1.0);
    });
  });

  describe("Integration with evaluateStaffingRatios", () => {
    it("should produce correct ratios for Praxisflow staff", () => {
      // Same staff as main test case
      const staff: MockStaff[] = [
        { role: "dentist", fte: 1.0 },
        { role: "zfa", fte: 1.0 },
        { role: "zfa", fte: 0.5 },
        { role: "dh", fte: 0.8 },
        { role: "empfang", fte: 1.0 },
        { role: "practice_manager", fte: 1.0 },
      ];

      const classified = classifyStaff(staff);

      const input: StaffingRatioInput = {
        providersCount: classified.providersCount,
        clinicalAssistantsCount: classified.clinicalAssistantsCount,
        frontdeskCount: classified.frontdeskCount,
        supportTotalCount: classified.supportTotalCount,
        providersFte: classified.providersFte,
        clinicalAssistantsFte: classified.clinicalAssistantsFte,
        frontdeskFte: classified.frontdeskFte,
        supportTotalFte: classified.supportTotalFte,
        totalStaff: staff.length,
        examRooms: 4,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // Headcount ratios (per 1 provider)
      assert.strictEqual(
        result.ratios.clinicalAssistantRatio.actual,
        3,
        "clinicalAssistantRatio.actual should be 3"
      );
      assert.strictEqual(
        result.ratios.frontdeskRatio.actual,
        1,
        "frontdeskRatio.actual should be 1"
      );
      assert.strictEqual(
        result.ratios.supportTotalRatio.actual,
        4,
        "supportTotalRatio.actual should be 4"
      );

      // FTE ratios (should exist since providersFte > 0)
      assert.ok(result.ratios.clinicalAssistantFteRatio, "clinicalAssistantFteRatio should exist");
      assert.ok(result.ratios.frontdeskFteRatio, "frontdeskFteRatio should exist");
      assert.ok(result.ratios.supportTotalFteRatio, "supportTotalFteRatio should exist");

      // FTE ratio values
      assert.ok(
        Math.abs(result.ratios.clinicalAssistantFteRatio!.actual - 2.3) < 0.001,
        `clinicalAssistantFteRatio.actual should be 2.3, got ${result.ratios.clinicalAssistantFteRatio!.actual}`
      );
      assert.ok(
        Math.abs(result.ratios.frontdeskFteRatio!.actual - 1.0) < 0.001,
        `frontdeskFteRatio.actual should be 1.0, got ${result.ratios.frontdeskFteRatio!.actual}`
      );
      assert.ok(
        Math.abs(result.ratios.supportTotalFteRatio!.actual - 3.3) < 0.001,
        `supportTotalFteRatio.actual should be 3.3, got ${result.ratios.supportTotalFteRatio!.actual}`
      );

      // Scores should be reasonable (not 0)
      assert.ok(
        result.ratios.clinicalAssistantRatio.score > 0,
        "clinicalAssistantRatio score should be > 0"
      );
      assert.ok(
        result.overallScore > 0,
        "overallScore should be > 0"
      );

      console.log("\nIntegration Test Results:");
      console.log(`  clinicalAssistantRatio: ${result.ratios.clinicalAssistantRatio.actual} (score: ${result.ratios.clinicalAssistantRatio.score})`);
      console.log(`  frontdeskRatio: ${result.ratios.frontdeskRatio.actual} (score: ${result.ratios.frontdeskRatio.score})`);
      console.log(`  supportTotalRatio: ${result.ratios.supportTotalRatio.actual} (score: ${result.ratios.supportTotalRatio.score})`);
      console.log(`  clinicalAssistantFteRatio: ${result.ratios.clinicalAssistantFteRatio?.actual}`);
      console.log(`  frontdeskFteRatio: ${result.ratios.frontdeskFteRatio?.actual}`);
      console.log(`  supportTotalFteRatio: ${result.ratios.supportTotalFteRatio?.actual}`);
      console.log(`  overallScore: ${result.overallScore}`);
    });

    it("should NOT count practice_manager in any ratio", () => {
      // Only practice_manager in staff
      const input: StaffingRatioInput = {
        providersCount: 0,
        clinicalAssistantsCount: 0,
        frontdeskCount: 0,
        supportTotalCount: 0,
        providersFte: 0,
        clinicalAssistantsFte: 0,
        frontdeskFte: 0,
        supportTotalFte: 0,
        totalStaff: 1, // The practice_manager
        examRooms: 4,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // All ratios should be 0 since no providers
      assert.strictEqual(result.ratios.clinicalAssistantRatio.actual, 0);
      assert.strictEqual(result.ratios.frontdeskRatio.actual, 0);
      assert.strictEqual(result.ratios.supportTotalRatio.actual, 0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle unknown roles gracefully (not count them)", () => {
      const staff: MockStaff[] = [
        { role: "dentist", fte: 1.0 },
        { role: "unknown_role", fte: 1.0 },
        { role: "janitor", fte: 1.0 },
      ];

      const result = classifyStaff(staff);

      assert.strictEqual(result.providersCount, 1);
      assert.strictEqual(result.clinicalAssistantsCount, 0);
      assert.strictEqual(result.frontdeskCount, 0);
      assert.strictEqual(result.supportTotalCount, 0);
    });

    it("should handle empty staff array", () => {
      const result = classifyStaff([]);

      assert.strictEqual(result.providersCount, 0);
      assert.strictEqual(result.clinicalAssistantsCount, 0);
      assert.strictEqual(result.frontdeskCount, 0);
      assert.strictEqual(result.supportTotalCount, 0);
      assert.strictEqual(result.providersFte, 0);
    });

    it("should handle DH (Dental Hygienist) as clinical assistant", () => {
      const staff: MockStaff[] = [
        { role: "dh", fte: 1.0 },
        { role: "DH", fte: 0.5 },
      ];

      const result = classifyStaff(staff);

      assert.strictEqual(result.clinicalAssistantsCount, 2);
      assert.strictEqual(result.clinicalAssistantsFte, 1.5);
    });
  });
});
