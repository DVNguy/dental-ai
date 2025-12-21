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
});
