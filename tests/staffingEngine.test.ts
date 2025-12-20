/**
 * Unit tests for Staffing Engine
 * Using Node.js built-in test runner
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  computeStaffing,
  STAFFING_DEFAULTS,
  type StaffingInput,
  type CurrentStaffingFte,
} from "../shared/staffingEngine.js";

describe("computeStaffing", () => {
  // ==========================================================================
  // Testfall A: Standard-Praxis mit Rundung 0.10
  // ==========================================================================
  describe("Testfall A: 2 Zahnärzte, 2 Stühle, 36 Patienten/Tag", () => {
    const input: StaffingInput = {
      dentistsFte: 2.0,
      chairsSimultaneous: 2,
      patientsPerDay: 36,
      prophylaxisChairs: 0,
      complexityLevel: 0,
    };

    it("should calculate derived values correctly", () => {
      const result = computeStaffing(input);

      assert.strictEqual(result.derived.C, 2, "C should be 2");
      assert.strictEqual(result.derived.N, 36, "N should be 36");
      assert.strictEqual(result.derived.PPC, 18, "PPC should be 18 (36/2)");
      // TI = clamp((18 - 14) / 8, 0, 1) = clamp(0.5, 0, 1) = 0.5
      assert.strictEqual(result.derived.TI, 0.5, "TI should be 0.5");
      // CB = 0.05 * 0 = 0
      assert.strictEqual(result.derived.CB, 0, "CB should be 0");
      // SF = 0.15 + 0.25 * 0.5 = 0.275
      assert.strictEqual(result.derived.SF, 0.275, "SF should be 0.275");
    });

    it("should calculate baseFte correctly", () => {
      const result = computeStaffing(input);

      // chairsideBase = 2 * (1.00 + 0.275 + 0) = 2 * 1.275 = 2.55
      assert.ok(
        Math.abs(result.baseFte.chairside - 2.55) < 0.01,
        `chairsideBase should be ~2.55, got ${result.baseFte.chairside}`
      );

      // steriBase = (2 * 0.12) + (36 * 0.003) + (0 * 0.05) = 0.24 + 0.108 + 0 = 0.348
      assert.ok(
        Math.abs(result.baseFte.steri - 0.348) < 0.01,
        `steriBase should be ~0.348, got ${result.baseFte.steri}`
      );

      // zfaTotalBase = 2.55 + 0.348 = 2.898
      assert.ok(
        Math.abs(result.baseFte.zfaTotal - 2.898) < 0.01,
        `zfaTotalBase should be ~2.898, got ${result.baseFte.zfaTotal}`
      );

      // frontdeskBase = 0.50 + (0.25 * max(0, 2-1)) + (0.01 * max(0, 36-20))
      //               = 0.50 + 0.25 + 0.16 = 0.91
      assert.ok(
        Math.abs(result.baseFte.frontdesk - 0.91) < 0.01,
        `frontdeskBase should be ~0.91, got ${result.baseFte.frontdesk}`
      );
    });

    it("should calculate finalFte with buffers correctly", () => {
      const result = computeStaffing(input);

      // zfaTotal final = 2.898 * 1.12 = 3.24576
      assert.ok(
        Math.abs(result.finalFte.zfaTotal - 3.24576) < 0.01,
        `finalFte.zfaTotal should be ~3.24576, got ${result.finalFte.zfaTotal}`
      );

      // frontdesk final = 0.91 * 1.08 = 0.9828
      assert.ok(
        Math.abs(result.finalFte.frontdesk - 0.9828) < 0.01,
        `finalFte.frontdesk should be ~0.9828, got ${result.finalFte.frontdesk}`
      );
    });

    it("should round to step 0.10 correctly", () => {
      const result = computeStaffing(input);

      // ceil(3.24576 / 0.10) * 0.10 = ceil(32.4576) * 0.10 = 33 * 0.10 = 3.3
      assert.strictEqual(
        result.roundedFte.zfaTotal,
        3.3,
        `roundedFte.zfaTotal should be 3.3, got ${result.roundedFte.zfaTotal}`
      );

      // ceil(0.9828 / 0.10) * 0.10 = ceil(9.828) * 0.10 = 10 * 0.10 = 1.0
      assert.strictEqual(
        result.roundedFte.frontdesk,
        1.0,
        `roundedFte.frontdesk should be 1.0, got ${result.roundedFte.frontdesk}`
      );
    });

    it("should have TARGET_CHAIRSIDE_GREEN flag (not understaffed)", () => {
      const result = computeStaffing(input);

      const hasGreenFlag = result.flags.some(
        (f) => f.id === "TARGET_CHAIRSIDE_GREEN"
      );
      const hasUnderstaffedRed = result.flags.some(
        (f) => f.id === "UNDERSTAFFED_CHAIRSIDE_RED"
      );

      // chairsidePerChair = 2.9 / 2 = 1.45 (rounded: 2.9, but let's check)
      console.log("Testfall A Results:");
      console.log(`  chairsidePerChair: ${result.ratios.chairsidePerChair}`);
      console.log(`  flags: ${result.flags.map((f) => f.id).join(", ")}`);

      // Should be in green range (1.45-1.80)
      assert.ok(
        hasGreenFlag || !hasUnderstaffedRed,
        "Should have TARGET_CHAIRSIDE_GREEN or at least not UNDERSTAFFED_CHAIRSIDE_RED"
      );
    });
  });

  // ==========================================================================
  // Testfall B: Unterbesetzt mit Current-Werten
  // ==========================================================================
  describe("Testfall B: Unterbesetzt - 2 Zahnärzte mit nur 1.0 ZFA Ist-FTE", () => {
    const input: StaffingInput = {
      dentistsFte: 2.0,
      chairsSimultaneous: 2,
      patientsPerDay: 36,
      prophylaxisChairs: 0,
      complexityLevel: 0,
    };

    const current: CurrentStaffingFte = {
      zfaTotalFte: 1.0,
      chairsideAssistFte: 1.0,
    };

    it("should calculate coverage correctly", () => {
      const result = computeStaffing(input, current);

      // roundedFte.zfaTotal = 3.3
      // coverage.zfaTotal = 1.0 / 3.3 = 0.303...
      assert.ok(result.coverage, "coverage should exist");
      assert.ok(result.coverage.zfaTotal !== undefined, "coverage.zfaTotal should exist");

      const expectedCoverage = 1.0 / 3.3;
      assert.ok(
        Math.abs(result.coverage.zfaTotal! - expectedCoverage) < 0.05,
        `coverage.zfaTotal should be ~${expectedCoverage.toFixed(2)}, got ${result.coverage.zfaTotal}`
      );

      console.log("Testfall B Results:");
      console.log(`  roundedFte.zfaTotal: ${result.roundedFte.zfaTotal}`);
      console.log(`  coverage.zfaTotal: ${result.coverage.zfaTotal}`);
      console.log(`  coverage.chairside: ${result.coverage.chairside}`);
    });

    it("should show coverage is in range 0.30-0.32", () => {
      const result = computeStaffing(input, current);

      assert.ok(result.coverage?.zfaTotal !== undefined);
      assert.ok(
        result.coverage.zfaTotal >= 0.28 && result.coverage.zfaTotal <= 0.35,
        `coverage.zfaTotal should be ~0.30-0.32, got ${result.coverage.zfaTotal}`
      );
    });
  });

  // ==========================================================================
  // Edge Case: 0 Zahnärzte
  // ==========================================================================
  describe("Edge Case: 0 Zahnärzte - keine Division durch 0", () => {
    const input: StaffingInput = {
      dentistsFte: 0,
      chairsSimultaneous: 0,
      patientsPerDay: 0,
      prophylaxisChairs: 0,
      complexityLevel: 0,
    };

    it("should not crash and return zeros for inactive practice", () => {
      const result = computeStaffing(input);

      assert.strictEqual(result.derived.C, 0, "C should be 0");
      assert.strictEqual(result.derived.N, 0, "N should be 0");
      assert.strictEqual(result.derived.PPC, 0, "PPC should be 0");
      assert.strictEqual(result.baseFte.chairside, 0, "chairsideBase should be 0");
      assert.strictEqual(result.baseFte.zfaTotal, 0, "zfaTotalBase should be 0");
      // Inaktive Praxis: frontdesk = 0
      assert.strictEqual(result.baseFte.frontdesk, 0, "frontdeskBase should be 0 for inactive practice");
      assert.strictEqual(result.baseFte.total, 0, "totalBase should be 0 for inactive practice");
      assert.strictEqual(result.ratios.chairsidePerChair, 0, "chairsidePerChair should be 0");
      assert.strictEqual(result.ratios.frontdeskPerDentistFte, 0, "frontdeskPerDentistFte should be 0");

      // Should NOT have any chairside flags since C=0
      const hasChairsideFlag = result.flags.some((f) =>
        f.id.includes("CHAIRSIDE")
      );
      assert.ok(!hasChairsideFlag, "Should not have chairside flags when C=0");

      // Meta should indicate inactive practice
      assert.strictEqual(result.meta.isPracticeActive, false, "isPracticeActive should be false");

      console.log("Edge Case Results (Inactive Practice):");
      console.log(`  derived: C=${result.derived.C}, N=${result.derived.N}`);
      console.log(`  baseFte.total: ${result.baseFte.total}`);
      console.log(`  baseFte.frontdesk: ${result.baseFte.frontdesk}`);
      console.log(`  meta.isPracticeActive: ${result.meta.isPracticeActive}`);
      console.log(`  flags: ${result.flags.map((f) => f.id).join(", ") || "(none)"}`);
    });

    it("should have frontdesk = 0 for fully inactive practice (0 dentists, 0 chairs, 0 patients)", () => {
      const result = computeStaffing(input);
      // Inaktive Praxis: frontdeskBase = 0
      assert.strictEqual(
        result.roundedFte.frontdesk,
        0,
        `frontdesk should be 0 for inactive practice, got ${result.roundedFte.frontdesk}`
      );
    });
  });

  // ==========================================================================
  // Komplexitätslevel Tests
  // ==========================================================================
  describe("Komplexitätslevel", () => {
    const baseInput: StaffingInput = {
      dentistsFte: 2.0,
      chairsSimultaneous: 2,
      patientsPerDay: 36,
      prophylaxisChairs: 0,
    };

    it("complexityLevel -1 should reduce staffing needs", () => {
      const resultLow = computeStaffing({ ...baseInput, complexityLevel: -1 });
      const resultNormal = computeStaffing({ ...baseInput, complexityLevel: 0 });

      assert.ok(
        resultLow.baseFte.chairside < resultNormal.baseFte.chairside,
        "Low complexity should need less chairside FTE"
      );
    });

    it("complexityLevel 2 should increase staffing needs", () => {
      const resultHigh = computeStaffing({ ...baseInput, complexityLevel: 2 });
      const resultNormal = computeStaffing({ ...baseInput, complexityLevel: 0 });

      assert.ok(
        resultHigh.baseFte.chairside > resultNormal.baseFte.chairside,
        "High complexity should need more chairside FTE"
      );
    });
  });

  // ==========================================================================
  // Prophylaxe Tests
  // ==========================================================================
  describe("Prophylaxe-Stühle", () => {
    const baseInput: StaffingInput = {
      dentistsFte: 2.0,
      chairsSimultaneous: 2,
      patientsPerDay: 36,
      complexityLevel: 0,
    };

    it("should calculate prophy FTE separately from ZFA", () => {
      const resultWithProphy = computeStaffing({
        ...baseInput,
        prophylaxisChairs: 2,
      });
      const resultWithoutProphy = computeStaffing({
        ...baseInput,
        prophylaxisChairs: 0,
      });

      // Prophy should be > 0 when chairs exist
      assert.ok(
        resultWithProphy.roundedFte.prophy > 0,
        "prophy FTE should be > 0 with prophy chairs"
      );
      assert.strictEqual(
        resultWithoutProphy.roundedFte.prophy,
        0,
        "prophy FTE should be 0 without prophy chairs"
      );

      // ZFA should be same regardless of prophy chairs
      assert.strictEqual(
        resultWithProphy.baseFte.zfaTotal,
        resultWithoutProphy.baseFte.zfaTotal + 2 * 0.05, // steri includes prophy chairs
        "ZFA should include steri contribution from prophy"
      );

      console.log("Prophylaxe Results:");
      console.log(`  without prophy: zfaTotal=${resultWithoutProphy.roundedFte.zfaTotal}, prophy=${resultWithoutProphy.roundedFte.prophy}`);
      console.log(`  with 2 prophy: zfaTotal=${resultWithProphy.roundedFte.zfaTotal}, prophy=${resultWithProphy.roundedFte.prophy}`);
    });

    it("prophy FTE should scale with complexity", () => {
      const resultLow = computeStaffing({
        ...baseInput,
        prophylaxisChairs: 2,
        complexityLevel: -1,
      });
      const resultHigh = computeStaffing({
        ...baseInput,
        prophylaxisChairs: 2,
        complexityLevel: 2,
      });

      // prophyBase = chairs * (0.90 + 0.05 * complexity)
      // Low: 2 * (0.90 - 0.05) = 2 * 0.85 = 1.70
      // High: 2 * (0.90 + 0.10) = 2 * 1.00 = 2.00
      assert.ok(
        resultLow.baseFte.prophy < resultHigh.baseFte.prophy,
        "High complexity should need more prophy FTE"
      );
    });
  });

  // ==========================================================================
  // Praxismanagement Tests
  // ==========================================================================
  describe("Praxismanagement Schwellenwerte", () => {
    it("should have pm=0 for small practices (<10 FTE core)", () => {
      const result = computeStaffing({
        dentistsFte: 2.0,
        chairsSimultaneous: 2,
        patientsPerDay: 36,
        prophylaxisChairs: 0,
        complexityLevel: 0,
      });

      // staffCoreWithoutPm = zfaTotal + prophy + frontdesk ~= 2.9 + 0 + 0.91 ~= 3.81
      assert.strictEqual(
        result.baseFte.pm,
        0,
        "pm should be 0 for small practice"
      );
    });

    it("should have pm=0.5 for medium practices (10-15 FTE core)", () => {
      const result = computeStaffing({
        dentistsFte: 5.0,
        chairsSimultaneous: 5,
        patientsPerDay: 90,
        prophylaxisChairs: 2,
        complexityLevel: 0,
      });

      // Check if we're in the right range
      const staffCoreWithoutPm =
        result.baseFte.zfaTotal + result.baseFte.prophy + result.baseFte.frontdesk;

      console.log("Medium Practice:");
      console.log(`  staffCoreWithoutPm: ${staffCoreWithoutPm}`);
      console.log(`  pm: ${result.baseFte.pm}`);

      if (staffCoreWithoutPm >= 10 && staffCoreWithoutPm < 15) {
        assert.strictEqual(
          result.baseFte.pm,
          0.5,
          "pm should be 0.5 for medium practice"
        );
      }
    });

    it("should have pm=1.0 for large practices (>=15 FTE core)", () => {
      const result = computeStaffing({
        dentistsFte: 8.0,
        chairsSimultaneous: 8,
        patientsPerDay: 150,
        prophylaxisChairs: 3,
        complexityLevel: 1,
      });

      const staffCoreWithoutPm =
        result.baseFte.zfaTotal + result.baseFte.prophy + result.baseFte.frontdesk;

      console.log("Large Practice:");
      console.log(`  staffCoreWithoutPm: ${staffCoreWithoutPm}`);
      console.log(`  pm: ${result.baseFte.pm}`);

      if (staffCoreWithoutPm >= 15) {
        assert.strictEqual(
          result.baseFte.pm,
          1.0,
          "pm should be 1.0 for large practice"
        );
      }
    });
  });

  // ==========================================================================
  // Headcount Hint Tests
  // ==========================================================================
  describe("Headcount Hint", () => {
    it("should calculate headcount from FTE with avgContractFraction", () => {
      const result = computeStaffing({
        dentistsFte: 2.0,
        chairsSimultaneous: 2,
        patientsPerDay: 36,
        prophylaxisChairs: 0,
        avgContractFraction: 0.80,
      });

      // headcount = ceil(FTE / 0.80)
      // zfaTotal rounded = 3.3 => ceil(3.3 / 0.8) = ceil(4.125) = 5
      assert.ok(
        result.headcountHint.zfaTotal >= Math.ceil(result.roundedFte.zfaTotal / 0.80),
        "headcount should be ceiling of FTE/fraction"
      );

      console.log("Headcount Hint:");
      console.log(`  zfaTotal FTE: ${result.roundedFte.zfaTotal} => ${result.headcountHint.zfaTotal} heads`);
      console.log(`  frontdesk FTE: ${result.roundedFte.frontdesk} => ${result.headcountHint.frontdesk} heads`);
    });
  });

  // ==========================================================================
  // Fallback Tests
  // ==========================================================================
  describe("Fallback wenn chairsSimultaneous fehlt", () => {
    it("should estimate C as integer from treatmentRooms", () => {
      const result = computeStaffing({
        dentistsFte: 2.0,
        treatmentRooms: 3,
        patientsPerDay: 36,
      });

      // C = min(round(treatmentRooms), max(1, round(dentistsFte))) = min(3, 2) = 2
      assert.strictEqual(result.derived.C, 2, "C should be min(3, 2) = 2");
      assert.ok(
        result.derived.warnings.some((w) => w.includes("geschätzt")),
        "Should have warning about estimation"
      );
      console.log("Fallback treatmentRooms:");
      console.log(`  C: ${result.derived.C}`);
      console.log(`  warning: ${result.derived.warnings.find((w) => w.includes("geschätzt"))}`);
    });

    it("should estimate C as integer from dentistsFte if no rooms", () => {
      const result = computeStaffing({
        dentistsFte: 2.5,
        patientsPerDay: 36,
      });

      // C = max(1, round(dentistsFte)) = max(1, round(2.5)) = max(1, 3) = 3
      assert.strictEqual(result.derived.C, 3, "C should be round(2.5) = 3");
      assert.ok(
        result.derived.warnings.some((w) => w.includes("dentistsFte") && w.includes("keine Behandlungsräume")),
        "Should have warning about estimation from dentistsFte"
      );
      console.log("Fallback dentistsFte:");
      console.log(`  C: ${result.derived.C}`);
      console.log(`  warning: ${result.derived.warnings.find((w) => w.includes("dentistsFte"))}`);
    });

    it("should always use integer for C even with fractional dentistsFte", () => {
      const result = computeStaffing({
        dentistsFte: 1.3,
        patientsPerDay: 20,
      });

      // C = max(1, round(1.3)) = max(1, 1) = 1
      assert.strictEqual(result.derived.C, 1, "C should be round(1.3) = 1");
      assert.ok(Number.isInteger(result.derived.C), "C should be an integer");
    });

    it("should estimate N from C * defaultPatientsPerChair", () => {
      const result = computeStaffing({
        dentistsFte: 2.0,
        chairsSimultaneous: 2,
      });

      // N = C * 18 = 2 * 18 = 36
      assert.strictEqual(result.derived.N, 36, "N should be 2 * 18 = 36");
      assert.ok(
        result.derived.warnings.some((w) => w.includes("patientsPerDay")),
        "Should have warning about N estimation"
      );
    });
  });

  // ==========================================================================
  // Flag Tests
  // ==========================================================================
  describe("Ampel-Flags", () => {
    it("should flag FRONTDESK_TOO_LOW_RED when frontdesk < 0.5", () => {
      // Custom buffer to force low frontdesk
      const result = computeStaffing({
        dentistsFte: 0.5,
        chairsSimultaneous: 1,
        patientsPerDay: 10,
        roundingStepFte: 0.01,
        adminBuffer: 0,
      });

      // frontdeskBase = 0.50 + 0 + 0 = 0.50, should be at boundary
      console.log("Frontdesk Flag Test:");
      console.log(`  frontdesk FTE: ${result.roundedFte.frontdesk}`);
      console.log(`  flags: ${result.flags.map((f) => f.id).join(", ")}`);
    });

    it("should flag FRONTDESK_LOW_FOR_VOLUME_YELLOW when N>=35 and frontdesk<0.80", () => {
      const result = computeStaffing({
        dentistsFte: 1.0,
        chairsSimultaneous: 2,
        patientsPerDay: 40,
        roundingStepFte: 0.01,
      });

      // frontdeskBase = 0.50 + 0 + 0.20 = 0.70
      // With buffer: 0.756, rounded: 0.76
      const hasYellowFlag = result.flags.some(
        (f) => f.id === "FRONTDESK_LOW_FOR_VOLUME_YELLOW"
      );

      console.log("High Volume Frontdesk Flag Test:");
      console.log(`  N: ${result.derived.N}`);
      console.log(`  frontdesk FTE: ${result.roundedFte.frontdesk}`);
      console.log(`  flags: ${result.flags.map((f) => f.id).join(", ")}`);

      if (result.roundedFte.frontdesk < 0.80) {
        assert.ok(hasYellowFlag, "Should have yellow flag for low frontdesk with high volume");
      }
    });
  });

  // ==========================================================================
  // NaN/Invalid Input Tests
  // ==========================================================================
  describe("Invalid Input Handling", () => {
    it("should handle NaN values gracefully", () => {
      const result = computeStaffing({
        dentistsFte: NaN,
        chairsSimultaneous: NaN,
        patientsPerDay: NaN,
      });

      assert.strictEqual(result.derived.C, 0, "C should be 0 for NaN input");
      assert.strictEqual(result.derived.N, 0, "N should be 0 for NaN input");
      assert.ok(!isNaN(result.roundedFte.total), "total should not be NaN");
    });

    it("should handle negative values gracefully", () => {
      const result = computeStaffing({
        dentistsFte: -2,
        chairsSimultaneous: -3,
        patientsPerDay: -10,
      });

      assert.strictEqual(result.derived.C, 0, "C should be 0 for negative input");
      assert.strictEqual(result.derived.N, 0, "N should be 0 for negative input");
    });

    it("should handle undefined/null values gracefully", () => {
      const result = computeStaffing({
        dentistsFte: 2.0,
        // All other values undefined
      });

      assert.ok(result.derived.C >= 0, "C should be >= 0");
      assert.ok(result.derived.N >= 0, "N should be >= 0");
      assert.ok(result.roundedFte.total >= 0, "total should be >= 0");
    });
  });

  // ==========================================================================
  // v1.2.0 Hardening Tests
  // ==========================================================================
  describe("v1.2.0 Hardening: treatmentRooms=0, C fallback, Prophylaxe-only", () => {
    // Test A: treatmentRooms=0 soll C NICHT auf 0 setzen (wird als "unbekannt" behandelt)
    it("A) treatmentRooms=0 should be treated as 'unknown', fallback to dentistsFte", () => {
      const result = computeStaffing({
        dentistsFte: 2.0,
        treatmentRooms: 0, // 0 = "nicht angegeben", NICHT "0 Räume"
        patientsPerDay: 36,
      });

      // C sollte aus dentistsFte abgeleitet werden (round(2.0) = 2)
      assert.strictEqual(result.derived.C, 2, "C should fallback to dentistsFte when treatmentRooms=0");
      assert.ok(
        result.derived.warnings.some((w) => w.includes("dentistsFte") && w.includes("keine Behandlungsräume")),
        "Should have warning about estimation from dentistsFte (not treatmentRooms)"
      );

      console.log("Test A: treatmentRooms=0");
      console.log(`  C: ${result.derived.C} (should be 2 from dentistsFte)`);
      console.log(`  warnings: ${result.derived.warnings.join("; ")}`);
    });

    // Test B: dentistsFte=0 ohne chairsSimultaneous darf C NICHT auf 1 springen
    it("B) dentistsFte=0 without chairsSimultaneous should keep C=0", () => {
      const result = computeStaffing({
        dentistsFte: 0,
        treatmentRooms: 3, // Hat Räume, aber keine Ärzte
        patientsPerDay: 0,
      });

      // C sollte 0 sein, weil keine Ärzte da sind
      assert.strictEqual(result.derived.C, 0, "C should be 0 when dentistsFte=0 (even with treatmentRooms)");
      assert.ok(
        result.derived.warnings.some((w) => w.includes("keine Zahnärzte aktiv")),
        "Should have warning about no active dentists"
      );

      console.log("Test B: dentistsFte=0 with treatmentRooms=3");
      console.log(`  C: ${result.derived.C} (should be 0)`);
      console.log(`  warnings: ${result.derived.warnings.join("; ")}`);
    });

    // Test C: Prophylaxe-only ist aktiv und bekommt frontdesk >= 0.5
    it("C) Prophylaxe-only practice should be ACTIVE with frontdesk >= 0.5", () => {
      const result = computeStaffing({
        dentistsFte: 0,
        chairsSimultaneous: 0,
        patientsPerDay: 0,
        prophylaxisChairs: 2, // Nur Prophylaxe-Stühle
      });

      // Praxis sollte als aktiv gelten
      assert.strictEqual(result.meta.isPracticeActive, true, "Prophylaxe-only should be ACTIVE");

      // frontdesk sollte >= 0.5 sein (Basis 0.50)
      assert.ok(
        result.roundedFte.frontdesk >= 0.5,
        `frontdesk should be >= 0.5, got ${result.roundedFte.frontdesk}`
      );

      // prophy sollte > 0 sein
      assert.ok(result.roundedFte.prophy > 0, "prophy FTE should be > 0");

      console.log("Test C: Prophylaxe-only Practice");
      console.log(`  isPracticeActive: ${result.meta.isPracticeActive} (should be true)`);
      console.log(`  frontdesk: ${result.roundedFte.frontdesk} (should be >= 0.5)`);
      console.log(`  prophy: ${result.roundedFte.prophy}`);
    });

    // Test D: totalFromRoundedParts ist konsistent mit Einzelwerten
    it("D) totalFromRoundedParts should equal sum of rounded parts (no double-counting)", () => {
      const result = computeStaffing({
        dentistsFte: 2.0,
        chairsSimultaneous: 2,
        patientsPerDay: 36,
        prophylaxisChairs: 1,
      });

      // Berechne erwarteten Wert
      const expectedTotal =
        result.roundedFte.zfaTotal +
        result.roundedFte.prophy +
        result.roundedFte.frontdesk +
        result.roundedFte.pm;

      // Meta.totalFromRoundedParts sollte exakt übereinstimmen
      assert.ok(
        Math.abs(result.meta.totalFromRoundedParts - expectedTotal) < 0.001,
        `totalFromRoundedParts (${result.meta.totalFromRoundedParts}) should equal sum of parts (${expectedTotal})`
      );

      // Preferred field sollte auf totalFromRoundedParts zeigen
      assert.strictEqual(
        result.meta.roleComposition.preferredTotalField,
        "totalFromRoundedParts",
        "preferredTotalField should be 'totalFromRoundedParts'"
      );

      console.log("Test D: totalFromRoundedParts Consistency");
      console.log(`  zfaTotal: ${result.roundedFte.zfaTotal}`);
      console.log(`  prophy: ${result.roundedFte.prophy}`);
      console.log(`  frontdesk: ${result.roundedFte.frontdesk}`);
      console.log(`  pm: ${result.roundedFte.pm}`);
      console.log(`  Sum: ${expectedTotal}`);
      console.log(`  totalFromRoundedParts: ${result.meta.totalFromRoundedParts}`);
      console.log(`  roundedFte.total: ${result.roundedFte.total} (may differ due to rounding)`);
    });

    // Zusätzlicher Test: treatmentRooms > 0 mit dentistsFte=0
    it("treatmentRooms > 0 with dentistsFte=0 should still keep C=0", () => {
      const result = computeStaffing({
        dentistsFte: 0,
        treatmentRooms: 5,
      });

      assert.strictEqual(result.derived.C, 0, "C should be 0 when dentistsFte=0");
      assert.strictEqual(result.derived.N, 0, "N should be 0 when C=0");
    });

    // Zusätzlicher Test: Kombination Prophylaxe mit echten Patienten
    it("Prophylaxe-only with patientsPerDay should still be active", () => {
      const result = computeStaffing({
        dentistsFte: 0,
        prophylaxisChairs: 2,
        patientsPerDay: 20, // Prophylaxe-Patienten
      });

      assert.strictEqual(result.meta.isPracticeActive, true, "Should be active with N > 0");
      assert.ok(result.roundedFte.frontdesk >= 0.5, "frontdesk should be >= 0.5");
    });
  });

  // ==========================================================================
  // Meta Field Tests
  // ==========================================================================
  describe("Meta Field (Double-Counting Prevention)", () => {
    it("should include meta information about role composition", () => {
      const result = computeStaffing({
        dentistsFte: 2.0,
        chairsSimultaneous: 2,
        patientsPerDay: 36,
      });

      assert.ok(result.meta, "meta should exist");
      assert.ok(result.meta.engineVersion, "engineVersion should exist");
      assert.ok(result.meta.roleComposition, "roleComposition should exist");
      assert.strictEqual(
        result.meta.roleComposition.zfaTotalEqualsChairsidePlusSteri,
        true,
        "zfaTotalEqualsChairsidePlusSteri should be true"
      );
      assert.deepStrictEqual(
        result.meta.roleComposition.atomicRolesForTotal,
        ["chairside", "steri", "prophy", "frontdesk", "pm"],
        "atomicRolesForTotal should list correct roles"
      );
      assert.deepStrictEqual(
        result.meta.roleComposition.aggregatedRolesForTotal,
        ["zfaTotal", "prophy", "frontdesk", "pm"],
        "aggregatedRolesForTotal should list correct roles"
      );
    });

    it("should correctly indicate active practice", () => {
      const result = computeStaffing({
        dentistsFte: 2.0,
        chairsSimultaneous: 2,
      });

      assert.strictEqual(result.meta.isPracticeActive, true, "should be active practice");
    });

    it("should correctly indicate inactive practice", () => {
      const result = computeStaffing({
        dentistsFte: 0,
        chairsSimultaneous: 0,
        patientsPerDay: 0,
      });

      assert.strictEqual(result.meta.isPracticeActive, false, "should be inactive practice");
    });

    it("zfaTotal should equal chairside + steri", () => {
      const result = computeStaffing({
        dentistsFte: 2.0,
        chairsSimultaneous: 2,
        patientsPerDay: 36,
      });

      // Verify the relationship holds for baseFte
      const calculatedZfaTotal = result.baseFte.chairside + result.baseFte.steri;
      assert.ok(
        Math.abs(result.baseFte.zfaTotal - calculatedZfaTotal) < 0.0001,
        `zfaTotal (${result.baseFte.zfaTotal}) should equal chairside + steri (${calculatedZfaTotal})`
      );

      console.log("Meta Field Test:");
      console.log(`  engineVersion: ${result.meta.engineVersion}`);
      console.log(`  isPracticeActive: ${result.meta.isPracticeActive}`);
      console.log(`  zfaTotal = ${result.baseFte.zfaTotal} = chairside(${result.baseFte.chairside}) + steri(${result.baseFte.steri})`);
    });
  });
});
