/**
 * Regression tests for evaluateStaffingRatios
 * Using Node.js built-in test runner
 *
 * These tests ensure that:
 * 1. overallScore only considers scoreKeys (clinicalAssistantRatio, supportTotalRatio, examRoomRatio)
 * 2. frontdeskRatio does NOT affect overallScore
 * 3. FTE ratios are calculated correctly when FTE data is provided
 * 4. Backward compatibility aliases work correctly
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  evaluateStaffingRatios,
  type StaffingRatioInput,
  STAFFING_RATIOS,
} from "../server/ai/benchmarks.js";

describe("evaluateStaffingRatios", () => {
  // ==========================================================================
  // Basic Functionality Tests
  // ==========================================================================
  describe("Basic Functionality", () => {
    it("should return all expected ratio keys", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 4,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // Core ratios should exist
      assert.ok(result.ratios.clinicalAssistantRatio, "clinicalAssistantRatio should exist");
      assert.ok(result.ratios.frontdeskRatio, "frontdeskRatio should exist");
      assert.ok(result.ratios.supportTotalRatio, "supportTotalRatio should exist");
      assert.ok(result.ratios.examRoomRatio, "examRoomRatio should exist");

      // Backward compatibility aliases should exist
      assert.ok(result.ratios.nurseRatio, "nurseRatio alias should exist");
      assert.ok(result.ratios.supportStaffRatio, "supportStaffRatio alias should exist");
    });

    it("should calculate ratios correctly with 2 providers, 3 clinical assistants, 1 frontdesk", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 6,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // clinicalAssistantRatio = 3 / 2 = 1.5
      assert.strictEqual(
        result.ratios.clinicalAssistantRatio.actual,
        1.5,
        "clinicalAssistantRatio should be 1.5"
      );

      // frontdeskRatio = 1 / 2 = 0.5
      assert.strictEqual(
        result.ratios.frontdeskRatio.actual,
        0.5,
        "frontdeskRatio should be 0.5"
      );

      // supportTotalRatio = 4 / 2 = 2.0
      assert.strictEqual(
        result.ratios.supportTotalRatio.actual,
        2.0,
        "supportTotalRatio should be 2.0"
      );

      // examRoomRatio = 6 / 2 = 3.0
      assert.strictEqual(
        result.ratios.examRoomRatio.actual,
        3.0,
        "examRoomRatio should be 3.0"
      );
    });
  });

  // ==========================================================================
  // overallScore Stability Tests (CRITICAL)
  // ==========================================================================
  describe("overallScore Stability", () => {
    it("should only use scoreKeys for overallScore calculation", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 6,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // Calculate expected overallScore from scoreKeys only
      const scoreKeys = ["clinicalAssistantRatio", "supportTotalRatio", "examRoomRatio"];
      const scores = scoreKeys.map((key) => result.ratios[key].score);
      const expectedOverall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

      assert.strictEqual(
        result.overallScore,
        expectedOverall,
        `overallScore should be ${expectedOverall} (average of scoreKeys)`
      );

      console.log("overallScore Stability Test:");
      console.log(`  clinicalAssistantRatio.score: ${result.ratios.clinicalAssistantRatio.score}`);
      console.log(`  supportTotalRatio.score: ${result.ratios.supportTotalRatio.score}`);
      console.log(`  examRoomRatio.score: ${result.ratios.examRoomRatio.score}`);
      console.log(`  Expected average: ${expectedOverall}`);
      console.log(`  Actual overallScore: ${result.overallScore}`);
    });

    it("frontdeskRatio should NOT affect overallScore", () => {
      // Base case: 1 frontdesk
      const inputLowFrontdesk: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 6,
        practiceType: "dental",
      };

      // High frontdesk: 5 frontdesk (but same supportTotalCount!)
      // Note: This is an unrealistic scenario but tests isolation
      const inputHighFrontdesk: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 5,
        supportTotalCount: 4, // supportTotalCount stays same
        totalStaff: 10,
        examRooms: 6,
        practiceType: "dental",
      };

      const resultLow = evaluateStaffingRatios(inputLowFrontdesk);
      const resultHigh = evaluateStaffingRatios(inputHighFrontdesk);

      // frontdeskRatio.score should differ
      assert.notStrictEqual(
        resultLow.ratios.frontdeskRatio.score,
        resultHigh.ratios.frontdeskRatio.score,
        "frontdeskRatio scores should differ"
      );

      // But overallScore should be the SAME (since supportTotalCount is same)
      assert.strictEqual(
        resultLow.overallScore,
        resultHigh.overallScore,
        "overallScore should NOT change when only frontdeskRatio changes"
      );

      console.log("frontdeskRatio Isolation Test:");
      console.log(`  Low frontdesk (1): frontdeskScore=${resultLow.ratios.frontdeskRatio.score}, overall=${resultLow.overallScore}`);
      console.log(`  High frontdesk (5): frontdeskScore=${resultHigh.ratios.frontdeskRatio.score}, overall=${resultHigh.overallScore}`);
    });

    it("FTE ratios should NOT affect overallScore", () => {
      const inputWithoutFte: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 6,
        practiceType: "dental",
      };

      const inputWithFte: StaffingRatioInput = {
        ...inputWithoutFte,
        providersFte: 1.5,
        clinicalAssistantsFte: 2.5,
        frontdeskFte: 0.8,
        supportTotalFte: 3.3,
      };

      const resultWithout = evaluateStaffingRatios(inputWithoutFte);
      const resultWith = evaluateStaffingRatios(inputWithFte);

      // FTE ratios should exist in result with FTE
      assert.ok(resultWith.ratios.clinicalAssistantFteRatio, "clinicalAssistantFteRatio should exist");
      assert.ok(resultWith.ratios.frontdeskFteRatio, "frontdeskFteRatio should exist");
      assert.ok(resultWith.ratios.supportTotalFteRatio, "supportTotalFteRatio should exist");

      // FTE ratios should NOT exist in result without FTE
      assert.strictEqual(resultWithout.ratios.clinicalAssistantFteRatio, undefined, "No FTE ratio without FTE data");

      // overallScore should be the SAME
      assert.strictEqual(
        resultWithout.overallScore,
        resultWith.overallScore,
        "overallScore should NOT change when FTE ratios are added"
      );

      console.log("FTE Ratio Isolation Test:");
      console.log(`  Without FTE: overallScore=${resultWithout.overallScore}`);
      console.log(`  With FTE: overallScore=${resultWith.overallScore}`);
    });
  });

  // ==========================================================================
  // Backward Compatibility Tests
  // ==========================================================================
  describe("Backward Compatibility Aliases", () => {
    it("nurseRatio should be identical to clinicalAssistantRatio", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 4,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      assert.deepStrictEqual(
        result.ratios.nurseRatio,
        result.ratios.clinicalAssistantRatio,
        "nurseRatio should be identical to clinicalAssistantRatio"
      );
    });

    it("supportStaffRatio should be identical to supportTotalRatio", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 4,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      assert.deepStrictEqual(
        result.ratios.supportStaffRatio,
        result.ratios.supportTotalRatio,
        "supportStaffRatio should be identical to supportTotalRatio"
      );
    });
  });

  // ==========================================================================
  // FTE Ratio Calculation Tests
  // ==========================================================================
  describe("FTE Ratio Calculations", () => {
    it("should calculate FTE ratios correctly", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 4,
        practiceType: "dental",
        providersFte: 2.0,
        clinicalAssistantsFte: 2.5,
        frontdeskFte: 0.75,
        supportTotalFte: 3.25,
      };

      const result = evaluateStaffingRatios(input);

      // clinicalAssistantFteRatio = 2.5 / 2.0 = 1.25
      assert.strictEqual(
        result.ratios.clinicalAssistantFteRatio?.actual,
        1.25,
        "clinicalAssistantFteRatio should be 1.25"
      );

      // frontdeskFteRatio = 0.75 / 2.0 = 0.375
      assert.strictEqual(
        result.ratios.frontdeskFteRatio?.actual,
        0.375,
        "frontdeskFteRatio should be 0.375"
      );

      // supportTotalFteRatio = 3.25 / 2.0 = 1.625
      assert.strictEqual(
        result.ratios.supportTotalFteRatio?.actual,
        1.625,
        "supportTotalFteRatio should be 1.625"
      );
    });

    it("should not create FTE ratios when providersFte is 0", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 4,
        practiceType: "dental",
        providersFte: 0,
        clinicalAssistantsFte: 2.5,
      };

      const result = evaluateStaffingRatios(input);

      assert.strictEqual(
        result.ratios.clinicalAssistantFteRatio,
        undefined,
        "No FTE ratio when providersFte is 0"
      );
    });

    it("should not create FTE ratios when providersFte is undefined", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 4,
        practiceType: "dental",
        clinicalAssistantsFte: 2.5,
      };

      const result = evaluateStaffingRatios(input);

      assert.strictEqual(
        result.ratios.clinicalAssistantFteRatio,
        undefined,
        "No FTE ratio when providersFte is undefined"
      );
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe("Edge Cases", () => {
    it("should handle 0 providers gracefully", () => {
      const input: StaffingRatioInput = {
        providersCount: 0,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 4,
        examRooms: 4,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // Ratios should be 0 with appropriate recommendations
      assert.strictEqual(result.ratios.clinicalAssistantRatio.actual, 0);
      assert.strictEqual(result.ratios.frontdeskRatio.actual, 0);
      assert.strictEqual(result.ratios.supportTotalRatio.actual, 0);
      assert.ok(
        result.ratios.clinicalAssistantRatio.recommendation.includes("Behandler"),
        "Should mention providers needed"
      );
    });

    it("should handle 0 exam rooms", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 0,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      assert.strictEqual(result.ratios.examRoomRatio.actual, 0);
      assert.ok(
        result.ratios.examRoomRatio.recommendation.includes("Behandlungsräume"),
        "Should mention rooms needed"
      );
    });

    it("should handle 0 clinical assistants", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 0,
        frontdeskCount: 1,
        supportTotalCount: 1,
        totalStaff: 3,
        examRooms: 4,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      assert.strictEqual(result.ratios.clinicalAssistantRatio.actual, 0);
      assert.strictEqual(result.ratios.clinicalAssistantRatio.score, 30);
      assert.ok(
        result.ratios.clinicalAssistantRatio.recommendation.includes("MFA/ZFA"),
        "Should mention assistants needed"
      );
    });

    it("should handle 0 frontdesk", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 0,
        supportTotalCount: 3,
        totalStaff: 5,
        examRooms: 4,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      assert.strictEqual(result.ratios.frontdeskRatio.actual, 0);
      assert.strictEqual(result.ratios.frontdeskRatio.score, 40);
      assert.ok(
        result.ratios.frontdeskRatio.recommendation.includes("Empfang"),
        "Should mention frontdesk needed"
      );
    });
  });

  // ==========================================================================
  // Practice Type Tests
  // ==========================================================================
  describe("Practice Type Handling", () => {
    it("should use dental benchmarks for dental practice", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 4,
        frontdeskCount: 1,
        supportTotalCount: 5,
        totalStaff: 7,
        examRooms: 4,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // Dental optimal is 2.0
      assert.strictEqual(
        result.ratios.supportTotalRatio.optimal,
        STAFFING_RATIOS.supportStaffPerDentist.optimal,
        "Should use dental benchmarks"
      );
    });

    it("should use medical benchmarks for medical practice", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 6,
        frontdeskCount: 1,
        supportTotalCount: 7,
        totalStaff: 9,
        examRooms: 4,
        practiceType: "medical",
      };

      const result = evaluateStaffingRatios(input);

      // Medical optimal is 3.0
      assert.strictEqual(
        result.ratios.supportTotalRatio.optimal,
        STAFFING_RATIOS.supportStaffPerPhysician.optimal,
        "Should use medical benchmarks"
      );
    });

    it("should default to dental if practiceType not specified", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 4,
        frontdeskCount: 1,
        supportTotalCount: 5,
        totalStaff: 7,
        examRooms: 4,
      };

      const result = evaluateStaffingRatios(input);

      assert.strictEqual(
        result.ratios.supportTotalRatio.optimal,
        STAFFING_RATIOS.supportStaffPerDentist.optimal,
        "Should default to dental benchmarks"
      );
    });
  });

  // ==========================================================================
  // Score Range Tests
  // ==========================================================================
  describe("Score Ranges", () => {
    it("optimal ratios should produce high scores (85-100)", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3, // 1.5 per provider = optimal for nursePerDoctor
        frontdeskCount: 1,
        supportTotalCount: 4, // 2.0 per provider = optimal for dental
        totalStaff: 6,
        examRooms: 6, // 3.0 per provider = optimal
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      assert.ok(
        result.ratios.clinicalAssistantRatio.score >= 85,
        `clinicalAssistantRatio score ${result.ratios.clinicalAssistantRatio.score} should be >= 85`
      );
      assert.ok(
        result.ratios.supportTotalRatio.score >= 85,
        `supportTotalRatio score ${result.ratios.supportTotalRatio.score} should be >= 85`
      );
      assert.ok(
        result.ratios.examRoomRatio.score >= 85,
        `examRoomRatio score ${result.ratios.examRoomRatio.score} should be >= 85`
      );
      assert.ok(
        result.overallScore >= 85,
        `overallScore ${result.overallScore} should be >= 85`
      );

      console.log("Optimal Ratio Scores:");
      console.log(`  clinicalAssistantRatio: ${result.ratios.clinicalAssistantRatio.actual} -> score ${result.ratios.clinicalAssistantRatio.score}`);
      console.log(`  supportTotalRatio: ${result.ratios.supportTotalRatio.actual} -> score ${result.ratios.supportTotalRatio.score}`);
      console.log(`  examRoomRatio: ${result.ratios.examRoomRatio.actual} -> score ${result.ratios.examRoomRatio.score}`);
      console.log(`  overallScore: ${result.overallScore}`);
    });

    it("severely understaffed ratios should produce low scores (<50)", () => {
      const input: StaffingRatioInput = {
        providersCount: 4,
        clinicalAssistantsCount: 1, // 0.25 per provider (way below min 1.0)
        frontdeskCount: 0,
        supportTotalCount: 1, // 0.25 per provider (way below min 1.5)
        totalStaff: 5,
        examRooms: 2, // 0.5 per provider (way below min 2.0)
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      assert.ok(
        result.ratios.clinicalAssistantRatio.score < 60,
        `clinicalAssistantRatio score ${result.ratios.clinicalAssistantRatio.score} should be < 60`
      );
      assert.ok(
        result.ratios.supportTotalRatio.score < 50,
        `supportTotalRatio score ${result.ratios.supportTotalRatio.score} should be < 50`
      );
      assert.ok(
        result.overallScore < 60,
        `overallScore ${result.overallScore} should be < 60`
      );

      console.log("Understaffed Ratio Scores:");
      console.log(`  clinicalAssistantRatio: ${result.ratios.clinicalAssistantRatio.actual} -> score ${result.ratios.clinicalAssistantRatio.score}`);
      console.log(`  supportTotalRatio: ${result.ratios.supportTotalRatio.actual} -> score ${result.ratios.supportTotalRatio.score}`);
      console.log(`  examRoomRatio: ${result.ratios.examRoomRatio.actual} -> score ${result.ratios.examRoomRatio.score}`);
      console.log(`  overallScore: ${result.overallScore}`);
    });
  });

  // ==========================================================================
  // REGRESSION: Always Return All 4 Primary Ratio Keys
  // ==========================================================================
  describe("Always 4 Primary Keys (Regression)", () => {
    const PRIMARY_KEYS = [
      "clinicalAssistantRatio",
      "frontdeskRatio",
      "supportTotalRatio",
      "examRoomRatio"
    ];

    it("providersCount=0, examRooms=0 => all 4 primary keys exist", () => {
      const input: StaffingRatioInput = {
        providersCount: 0,
        clinicalAssistantsCount: 0,
        frontdeskCount: 0,
        supportTotalCount: 0,
        totalStaff: 0,
        examRooms: 0,
      };

      const result = evaluateStaffingRatios(input);

      for (const key of PRIMARY_KEYS) {
        assert.ok(
          result.ratios[key] !== undefined,
          `${key} should exist even when providersCount=0`
        );
        assert.strictEqual(
          result.ratios[key].actual,
          0,
          `${key}.actual should be 0 when no providers`
        );
      }

      console.log("Regression Test: providersCount=0, examRooms=0");
      console.log(`  Keys present: ${Object.keys(result.ratios).filter(k => PRIMARY_KEYS.includes(k)).join(", ")}`);
    });

    it("providersCount=0, examRooms=2 => all 4 primary keys exist", () => {
      const input: StaffingRatioInput = {
        providersCount: 0,
        clinicalAssistantsCount: 2,
        frontdeskCount: 1,
        supportTotalCount: 3,
        totalStaff: 3,
        examRooms: 2,
      };

      const result = evaluateStaffingRatios(input);

      for (const key of PRIMARY_KEYS) {
        assert.ok(
          result.ratios[key] !== undefined,
          `${key} should exist even when providersCount=0 but examRooms>0`
        );
      }
    });

    it("providersCount=1, examRooms=0 => all 4 primary keys exist", () => {
      const input: StaffingRatioInput = {
        providersCount: 1,
        clinicalAssistantsCount: 2,
        frontdeskCount: 1,
        supportTotalCount: 3,
        totalStaff: 4,
        examRooms: 0,
      };

      const result = evaluateStaffingRatios(input);

      for (const key of PRIMARY_KEYS) {
        assert.ok(
          result.ratios[key] !== undefined,
          `${key} should exist even when examRooms=0`
        );
      }

      // examRoomRatio should be 0 with appropriate message
      assert.strictEqual(result.ratios.examRoomRatio.actual, 0);
      assert.ok(
        result.ratios.examRoomRatio.recommendation.includes("Behandlungsräume"),
        "examRoomRatio should mention rooms needed"
      );
    });

    it("frontdeskCount=0 => frontdeskRatio exists and is 0", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 0,
        supportTotalCount: 3,
        totalStaff: 5,
        examRooms: 4,
      };

      const result = evaluateStaffingRatios(input);

      assert.ok(
        result.ratios.frontdeskRatio !== undefined,
        "frontdeskRatio should exist when frontdeskCount=0"
      );
      assert.strictEqual(
        result.ratios.frontdeskRatio.actual,
        0,
        "frontdeskRatio.actual should be 0"
      );
    });

    it("clinicalAssistantsCount=0 => clinicalAssistantRatio exists and is 0", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 0,
        frontdeskCount: 1,
        supportTotalCount: 1,
        totalStaff: 3,
        examRooms: 4,
      };

      const result = evaluateStaffingRatios(input);

      assert.ok(
        result.ratios.clinicalAssistantRatio !== undefined,
        "clinicalAssistantRatio should exist when clinicalAssistantsCount=0"
      );
      assert.strictEqual(
        result.ratios.clinicalAssistantRatio.actual,
        0,
        "clinicalAssistantRatio.actual should be 0"
      );
    });

    it("all zeros => all 4 primary keys with actual=0", () => {
      const input: StaffingRatioInput = {
        providersCount: 0,
        clinicalAssistantsCount: 0,
        frontdeskCount: 0,
        supportTotalCount: 0,
        totalStaff: 0,
        examRooms: 0,
      };

      const result = evaluateStaffingRatios(input);

      for (const key of PRIMARY_KEYS) {
        assert.ok(result.ratios[key] !== undefined, `${key} must exist`);
        assert.strictEqual(result.ratios[key].actual, 0, `${key}.actual must be 0`);
        assert.strictEqual(result.ratios[key].score, 0, `${key}.score must be 0`);
        assert.ok(
          result.ratios[key].recommendation.length > 0,
          `${key}.recommendation must not be empty`
        );
      }

      console.log("All zeros test - keys in output:", Object.keys(result.ratios).sort().join(", "));
    });
  });

  // ==========================================================================
  // Meta Field Tests (Absolute Values: numerator, denominator, target, delta)
  // ==========================================================================
  describe("RatioMeta Absolute Values", () => {
    it("should include meta field for all primary ratios when providers > 0", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 6,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // All primary ratios should have meta
      assert.ok(result.ratios.clinicalAssistantRatio.meta, "clinicalAssistantRatio should have meta");
      assert.ok(result.ratios.frontdeskRatio.meta, "frontdeskRatio should have meta");
      assert.ok(result.ratios.supportTotalRatio.meta, "supportTotalRatio should have meta");
      assert.ok(result.ratios.examRoomRatio.meta, "examRoomRatio should have meta");
    });

    it("should calculate meta.numerator as providersCount", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 6,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      assert.strictEqual(result.ratios.clinicalAssistantRatio.meta?.numerator, 2);
      assert.strictEqual(result.ratios.frontdeskRatio.meta?.numerator, 2);
      assert.strictEqual(result.ratios.supportTotalRatio.meta?.numerator, 2);
      assert.strictEqual(result.ratios.examRoomRatio.meta?.numerator, 2);
    });

    it("should calculate meta.denominator correctly for each ratio", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 6,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      assert.strictEqual(result.ratios.clinicalAssistantRatio.meta?.denominator, 3, "denominator = clinicalAssistantsCount");
      assert.strictEqual(result.ratios.frontdeskRatio.meta?.denominator, 1, "denominator = frontdeskCount");
      assert.strictEqual(result.ratios.supportTotalRatio.meta?.denominator, 4, "denominator = supportTotalCount");
      assert.strictEqual(result.ratios.examRoomRatio.meta?.denominator, 6, "denominator = examRooms");
    });

    it("should calculate meta.targetDenominator = optimal * numerator", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 6,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // clinicalAssistantRatio: optimal=1.5, providers=2 => target=3.0
      assert.strictEqual(
        result.ratios.clinicalAssistantRatio.meta?.targetDenominator,
        STAFFING_RATIOS.nursePerDoctor.optimal * 2,
        "clinicalAssistant target = 1.5 * 2 = 3.0"
      );

      // frontdeskRatio: optimal=0.4, providers=2 => target=0.8
      assert.strictEqual(
        result.ratios.frontdeskRatio.meta?.targetDenominator,
        STAFFING_RATIOS.receptionistPerProvider.optimal * 2,
        "frontdesk target = 0.4 * 2 = 0.8"
      );

      // supportTotalRatio: optimal=2.0 (dental), providers=2 => target=4.0
      assert.strictEqual(
        result.ratios.supportTotalRatio.meta?.targetDenominator,
        STAFFING_RATIOS.supportStaffPerDentist.optimal * 2,
        "supportTotal target = 2.0 * 2 = 4.0"
      );

      // examRoomRatio: optimal=3.0, providers=2 => target=6.0
      assert.strictEqual(
        result.ratios.examRoomRatio.meta?.targetDenominator,
        STAFFING_RATIOS.examRoomsPerProvider.optimal * 2,
        "examRoom target = 3.0 * 2 = 6.0"
      );
    });

    it("should calculate meta.deltaDenominator = targetDenominator - denominator", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 2, // below optimal 3.0
        frontdeskCount: 1,           // above optimal 0.8
        supportTotalCount: 3,        // below optimal 4.0
        totalStaff: 5,
        examRooms: 4,                // below optimal 6.0
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // clinicalAssistant: target=3.0, actual=2 => delta=+1.0
      assert.strictEqual(
        result.ratios.clinicalAssistantRatio.meta?.deltaDenominator,
        3.0 - 2,
        "clinicalAssistant delta = 3.0 - 2 = 1.0"
      );

      // frontdesk: target=0.8, actual=1 => delta=-0.2
      assert.strictEqual(
        result.ratios.frontdeskRatio.meta?.deltaDenominator,
        0.8 - 1,
        "frontdesk delta = 0.8 - 1 = -0.2"
      );

      // supportTotal: target=4.0, actual=3 => delta=+1.0
      assert.strictEqual(
        result.ratios.supportTotalRatio.meta?.deltaDenominator,
        4.0 - 3,
        "supportTotal delta = 4.0 - 3 = 1.0"
      );

      // examRoom: target=6.0, actual=4 => delta=+2.0
      assert.strictEqual(
        result.ratios.examRoomRatio.meta?.deltaDenominator,
        6.0 - 4,
        "examRoom delta = 6.0 - 4 = 2.0"
      );

      console.log("Delta Calculations:");
      console.log(`  clinicalAssistant: actual=2, target=3.0, delta=${result.ratios.clinicalAssistantRatio.meta?.deltaDenominator}`);
      console.log(`  frontdesk: actual=1, target=0.8, delta=${result.ratios.frontdeskRatio.meta?.deltaDenominator}`);
      console.log(`  supportTotal: actual=3, target=4.0, delta=${result.ratios.supportTotalRatio.meta?.deltaDenominator}`);
      console.log(`  examRoom: actual=4, target=6.0, delta=${result.ratios.examRoomRatio.meta?.deltaDenominator}`);
    });

    it("should NOT include meta when providers = 0", () => {
      const input: StaffingRatioInput = {
        providersCount: 0,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 4,
        examRooms: 6,
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);

      // Meta should be undefined when no providers
      assert.strictEqual(result.ratios.clinicalAssistantRatio.meta, undefined);
      assert.strictEqual(result.ratios.frontdeskRatio.meta, undefined);
      assert.strictEqual(result.ratios.supportTotalRatio.meta, undefined);
      assert.strictEqual(result.ratios.examRoomRatio.meta, undefined);
    });

    it("should include meta for FTE ratios when providersFte > 0", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 6,
        practiceType: "dental",
        providersFte: 1.8,
        clinicalAssistantsFte: 2.5,
        frontdeskFte: 0.7,
        supportTotalFte: 3.2,
      };

      const result = evaluateStaffingRatios(input);

      // FTE ratios should have meta with providersFte as numerator
      assert.ok(result.ratios.clinicalAssistantFteRatio?.meta, "FTE ratio should have meta");
      assert.strictEqual(result.ratios.clinicalAssistantFteRatio?.meta?.numerator, 1.8);
      assert.strictEqual(result.ratios.clinicalAssistantFteRatio?.meta?.denominator, 2.5);

      assert.ok(result.ratios.frontdeskFteRatio?.meta);
      assert.strictEqual(result.ratios.frontdeskFteRatio?.meta?.numerator, 1.8);
      assert.strictEqual(result.ratios.frontdeskFteRatio?.meta?.denominator, 0.7);

      assert.ok(result.ratios.supportTotalFteRatio?.meta);
      assert.strictEqual(result.ratios.supportTotalFteRatio?.meta?.numerator, 1.8);
      assert.strictEqual(result.ratios.supportTotalFteRatio?.meta?.denominator, 3.2);
    });

    it("meta values should support UI display: 'Bei 2 Behandlern: Ist 4, Ziel 6, Delta +2'", () => {
      const input: StaffingRatioInput = {
        providersCount: 2,
        clinicalAssistantsCount: 3,
        frontdeskCount: 1,
        supportTotalCount: 4,
        totalStaff: 6,
        examRooms: 4, // below optimal 6
        practiceType: "dental",
      };

      const result = evaluateStaffingRatios(input);
      const meta = result.ratios.examRoomRatio.meta!;

      // Build display string
      const basedOn = meta.numerator;       // 2 Behandler
      const actual = meta.denominator;       // 4 Räume
      const target = meta.targetDenominator; // 6 Räume
      const delta = meta.deltaDenominator;   // +2 Räume

      const displayString = `Bei ${basedOn} Behandlern: Ist ${actual} Räume | Ziel ${target} Räume | Δ ${delta >= 0 ? '+' : ''}${delta} Räume`;

      console.log("UI Display Test:");
      console.log(`  ${displayString}`);

      assert.strictEqual(basedOn, 2);
      assert.strictEqual(actual, 4);
      assert.strictEqual(target, 6);
      assert.strictEqual(delta, 2);
    });
  });
});
