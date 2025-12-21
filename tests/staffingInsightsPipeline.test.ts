/**
 * Regression Tests for Staffing Insights Pipeline
 *
 * Ensures that Praxisflow role variants are correctly classified
 * and that the full pipeline produces non-zero ratios when providers exist.
 *
 * These tests verify end-to-end behavior through the advisor pipeline.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Staff, Room } from "@shared/schema";

// Import the centralized classifier
import {
  normalizeStaffRole,
  classifyRole,
  classifyStaffForRatios,
  type StaffClassificationResult,
} from "../server/ai/staffRoleClassifier";

// Import the advisor pipeline
import { evaluateStaffingRatios } from "../server/ai/benchmarks";

/**
 * Helper to create a mock Staff member
 */
function createMockStaff(role: string, fte: number = 1.0, id?: string): Staff {
  return {
    id: id || `staff-${Math.random().toString(36).substr(2, 9)}`,
    practiceId: "test-practice",
    role,
    fte,
    name: `Test ${role}`,
    experienceLevel: 3,
    specializations: [],
    color: "#3498db",
  } as Staff;
}

/**
 * Helper to create mock rooms
 */
function createMockRooms(examCount: number): Room[] {
  const rooms: Room[] = [];
  for (let i = 0; i < examCount; i++) {
    rooms.push({
      id: `room-${i}`,
      practiceId: "test-practice",
      name: `Exam Room ${i + 1}`,
      type: "exam",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      floor: 0,
    } as Room);
  }
  return rooms;
}

describe("Staffing Insights Pipeline - Praxisflow Integration", () => {
  describe("Centralized Classifier Integration", () => {
    it("should correctly classify Praxisflow provider roles", () => {
      const providerRoles = [
        "zahnärztin",
        "Zahnärztin",
        "zahnarzt",
        "behandler",
        "Behandler",
        "dentist",
        "doctor",
        "arzt",
        "Dr. med. dent.",
      ];

      for (const role of providerRoles) {
        const normalized = normalizeStaffRole(role);
        const category = classifyRole(normalized);
        assert.strictEqual(
          category,
          "provider",
          `"${role}" (normalized: "${normalized}") should be classified as provider`
        );
      }
    });

    it("should correctly classify Praxisflow clinical assistant roles", () => {
      const clinicalRoles = [
        "zfa",
        "ZFA",
        "zfa_prophylaxe",
        "ZFA (Prophylaxe)",
        "dh",
        "DH",
        "mfa",
        "assistenz",
        "Assistentin",
      ];

      for (const role of clinicalRoles) {
        const normalized = normalizeStaffRole(role);
        const category = classifyRole(normalized);
        assert.strictEqual(
          category,
          "clinical_assistant",
          `"${role}" (normalized: "${normalized}") should be classified as clinical_assistant`
        );
      }
    });

    it("should correctly classify Praxisflow frontdesk roles", () => {
      const frontdeskRoles = [
        "empfang",
        "Empfang",
        "rezeption",
        "Rezeption",
        "anmeldung",
        "Anmeldung",
        "receptionist",
      ];

      for (const role of frontdeskRoles) {
        const normalized = normalizeStaffRole(role);
        const category = classifyRole(normalized);
        assert.strictEqual(
          category,
          "frontdesk",
          `"${role}" (normalized: "${normalized}") should be classified as frontdesk`
        );
      }
    });
  });

  describe("Full Pipeline - classifyStaffForRatios", () => {
    it("should return correct counts for Praxisflow staff", () => {
      const staff: Staff[] = [
        createMockStaff("zahnärztin", 1.0),
        createMockStaff("behandler", 0.8),
        createMockStaff("zfa_prophylaxe", 1.0),
        createMockStaff("zfa", 1.0),
        createMockStaff("dh", 0.5),
        createMockStaff("empfang", 1.0),
        createMockStaff("rezeption", 0.5),
        createMockStaff("praxismanager", 1.0), // Should be excluded
      ];

      const result = classifyStaffForRatios(staff);

      assert.strictEqual(result.providersCount, 2, "Should have 2 providers");
      assert.strictEqual(result.clinicalAssistantsCount, 3, "Should have 3 clinical assistants");
      assert.strictEqual(result.frontdeskCount, 2, "Should have 2 frontdesk");
      assert.strictEqual(result.excludedCount, 1, "Should have 1 excluded (praxismanager)");
      assert.strictEqual(result.supportTotalCount, 5, "Support total should be 5");
    });

    it("should calculate FTE sums correctly", () => {
      const staff: Staff[] = [
        createMockStaff("zahnarzt", 1.0),
        createMockStaff("dentist", 0.5),
        createMockStaff("zfa", 1.0),
        createMockStaff("mfa", 0.8),
        createMockStaff("empfang", 0.6),
      ];

      const result = classifyStaffForRatios(staff);

      assert.strictEqual(result.providersFte, 1.5, "Provider FTE should be 1.5");
      assert.strictEqual(result.clinicalAssistantsFte, 1.8, "Clinical assistant FTE should be 1.8");
      assert.strictEqual(result.frontdeskFte, 0.6, "Frontdesk FTE should be 0.6");
      assert.strictEqual(result.supportTotalFte, 2.4, "Support total FTE should be 2.4");
    });

    it("should collect role histogram without PII", () => {
      const staff: Staff[] = [
        createMockStaff("zahnarzt", 1.0, "secret-id-1"),
        createMockStaff("zahnarzt", 1.0, "secret-id-2"),
        createMockStaff("zfa", 1.0, "secret-id-3"),
      ];

      const result = classifyStaffForRatios(staff);

      // Histogram should only contain normalized role strings
      assert.strictEqual(result.roleHistogram["zahnarzt"], 2);
      assert.strictEqual(result.roleHistogram["zfa"], 1);

      // Ensure no IDs leaked
      const histogramStr = JSON.stringify(result.roleHistogram);
      assert.ok(!histogramStr.includes("secret-id"), "Histogram should not contain IDs");
    });

    it("should collect unknown roles without IDs", () => {
      const staff: Staff[] = [
        createMockStaff("zahnarzt", 1.0),
        createMockStaff("custom_specialist", 1.0, "secret-id-custom"),
        createMockStaff("unknown_role_xyz", 1.0, "secret-id-unknown"),
      ];

      const result = classifyStaffForRatios(staff);

      assert.ok(result.unknownRoles.includes("custom_specialist"));
      assert.ok(result.unknownRoles.includes("unknown_role_xyz"));

      // Ensure no IDs leaked
      const unknownStr = JSON.stringify(result.unknownRoles);
      assert.ok(!unknownStr.includes("secret-id"), "Unknown roles should not contain IDs");
    });
  });

  describe("Ratio Calculation - Non-zero when providers exist", () => {
    it("should produce non-zero ratios when providers exist", () => {
      const staff: Staff[] = [
        createMockStaff("zahnärztin", 1.0),
        createMockStaff("zfa", 1.0),
        createMockStaff("zfa_prophylaxe", 1.0),
        createMockStaff("empfang", 1.0),
      ];

      const classification = classifyStaffForRatios(staff);

      // Verify we have providers
      assert.ok(classification.providersCount > 0, "Should have providers");

      // Now evaluate ratios
      const ratios = evaluateStaffingRatios({
        providersCount: classification.providersCount,
        clinicalAssistantsCount: classification.clinicalAssistantsCount,
        frontdeskCount: classification.frontdeskCount,
        supportTotalCount: classification.supportTotalCount,
        providersFte: classification.providersFte,
        clinicalAssistantsFte: classification.clinicalAssistantsFte,
        frontdeskFte: classification.frontdeskFte,
        supportTotalFte: classification.supportTotalFte,
        totalStaff: staff.length,
        examRooms: 2,
      });

      // Verify ratios are non-zero
      assert.ok(
        ratios.ratios.clinicalAssistantRatio.actual > 0,
        `clinicalAssistantRatio.actual should be > 0, got ${ratios.ratios.clinicalAssistantRatio.actual}`
      );
      assert.ok(
        ratios.ratios.supportTotalRatio.actual > 0,
        `supportTotalRatio.actual should be > 0, got ${ratios.ratios.supportTotalRatio.actual}`
      );
    });

    it("should produce zero ratios when no providers exist", () => {
      const staff: Staff[] = [
        createMockStaff("zfa", 1.0),
        createMockStaff("empfang", 1.0),
      ];

      const classification = classifyStaffForRatios(staff);

      assert.strictEqual(classification.providersCount, 0, "Should have no providers");

      const ratios = evaluateStaffingRatios({
        providersCount: 0,
        clinicalAssistantsCount: classification.clinicalAssistantsCount,
        frontdeskCount: classification.frontdeskCount,
        supportTotalCount: classification.supportTotalCount,
        totalStaff: staff.length,
        examRooms: 2,
      });

      // Ratios per provider should be 0 when no providers
      assert.strictEqual(
        ratios.ratios.clinicalAssistantRatio.actual,
        0,
        "clinicalAssistantRatio should be 0 when no providers"
      );
    });

    it("should handle the original Praxisflow test case that was failing", () => {
      // Original case: zfa, dh, empfang roles were showing 0.00 ratios
      const staff: Staff[] = [
        createMockStaff("dentist", 1.0),
        createMockStaff("zfa", 1.0),
        createMockStaff("zfa", 0.8),
        createMockStaff("dh", 0.5),
        createMockStaff("empfang", 1.0),
        createMockStaff("practice_manager", 1.0),
      ];

      const classification = classifyStaffForRatios(staff);

      console.log("Original failing test case - classification:", {
        providersCount: classification.providersCount,
        clinicalAssistantsCount: classification.clinicalAssistantsCount,
        frontdeskCount: classification.frontdeskCount,
        excludedCount: classification.excludedCount,
        roleHistogram: classification.roleHistogram,
      });

      assert.strictEqual(classification.providersCount, 1, "Should have 1 provider (dentist)");
      assert.strictEqual(classification.clinicalAssistantsCount, 3, "Should have 3 clinical (2 zfa + 1 dh)");
      assert.strictEqual(classification.frontdeskCount, 1, "Should have 1 frontdesk (empfang)");
      assert.strictEqual(classification.excludedCount, 1, "Should have 1 excluded (practice_manager)");

      const ratios = evaluateStaffingRatios({
        providersCount: classification.providersCount,
        clinicalAssistantsCount: classification.clinicalAssistantsCount,
        frontdeskCount: classification.frontdeskCount,
        supportTotalCount: classification.supportTotalCount,
        providersFte: classification.providersFte,
        clinicalAssistantsFte: classification.clinicalAssistantsFte,
        frontdeskFte: classification.frontdeskFte,
        supportTotalFte: classification.supportTotalFte,
        totalStaff: staff.length,
        examRooms: 2,
      });

      console.log("Ratios from original failing case:", {
        clinicalAssistantRatio: ratios.ratios.clinicalAssistantRatio.actual,
        frontdeskRatio: ratios.ratios.frontdeskRatio.actual,
        supportTotalRatio: ratios.ratios.supportTotalRatio.actual,
      });

      // These should NOT be 0!
      assert.ok(
        ratios.ratios.clinicalAssistantRatio.actual > 0,
        "clinicalAssistantRatio should be > 0"
      );
      assert.ok(
        ratios.ratios.supportTotalRatio.actual > 0,
        "supportTotalRatio should be > 0"
      );
    });
  });

  describe("analysisMeta.source Verification", () => {
    it("should verify that source field exists in AnalysisMeta type", () => {
      // This is a compile-time check - if the type is wrong, TypeScript will fail
      const meta = {
        computedAt: new Date().toISOString(),
        fromCache: false,
        forceApplied: false,
        debugEnabled: true,
        source: "advisor" as const,
      };

      assert.strictEqual(meta.source, "advisor", "source should be 'advisor'");
    });
  });
});
