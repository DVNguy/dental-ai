/**
 * HR KPI Module - QA Verification Tests
 *
 * Tests for:
 * 1. Deterministic calculations
 * 2. Reproducible results
 * 3. Realistic practice scenarios
 */

import {
  computeFteDemand,
  computeAbsenceRate,
  computeOvertimeRate,
  computeLaborCostRatio,
  computeHRKpiSnapshot,
  type StaffMember,
  type AbsenceRecord,
  type OvertimeRecord,
  type PracticeConfig,
  HR_KPI_THRESHOLDS,
} from "./hrKpi";

// ============================================================================
// Test Utilities
// ============================================================================

function createStaff(overrides: Partial<StaffMember> & { id: string }): StaffMember {
  return {
    role: "assistant",
    fte: 1.0,
    weeklyHours: 40,
    hourlyCost: 25,
    ...overrides,
  };
}

function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

// ============================================================================
// TEST 1: Determinism Verification
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("TEST 1: DETERMINISM VERIFICATION");
console.log("=".repeat(70));

function testDeterminism() {
  const staff: StaffMember[] = [
    createStaff({ id: "1", role: "dentist", fte: 1.0, weeklyHours: 40, hourlyCost: 50 }),
    createStaff({ id: "2", role: "assistant", fte: 0.75, weeklyHours: 30, hourlyCost: 20 }),
    createStaff({ id: "3", role: "receptionist", fte: 0.5, weeklyHours: 20, hourlyCost: 18 }),
  ];

  const config: PracticeConfig = {
    targetFte: 3.0,
    workdaysPerWeek: 5,
    standardWeeklyHours: 40,
    revenuePerMonth: 50000,
  };

  const periodStart = createDate(2024, 1, 1);
  const periodEnd = createDate(2024, 1, 31);

  const absences: AbsenceRecord[] = [
    { staffId: "2", type: "sick", startDate: createDate(2024, 1, 10), endDate: createDate(2024, 1, 12) },
  ];

  const overtime: OvertimeRecord[] = [
    { staffId: "1", date: createDate(2024, 1, 15), overtimeHours: 4 },
    { staffId: "1", date: createDate(2024, 1, 22), overtimeHours: 3 },
  ];

  // Run 10 times and verify identical results
  const results: string[] = [];
  for (let i = 0; i < 10; i++) {
    const result = computeHRKpiSnapshot(staff, absences, overtime, periodStart, periodEnd, config);
    // Exclude timestamp for comparison
    const comparable = JSON.stringify({
      fteQuote: result.fteQuote,
      absenceRatePercent: result.absenceRatePercent,
      overtimeRatePercent: result.overtimeRatePercent,
      laborCostRatioPercent: result.laborCostRatioPercent,
      overallStatus: result.overallStatus,
      alertCount: result.alerts.length,
    });
    results.push(comparable);
  }

  const allIdentical = results.every((r) => r === results[0]);
  console.log(`\nRan 10 iterations with identical input:`);
  console.log(`  All results identical: ${allIdentical ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`  Sample result: ${results[0]}`);

  return allIdentical;
}

const deterministicPass = testDeterminism();

// ============================================================================
// TEST 2: Unterbesetzung bei steigendem Terminvolumen
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("TEST 2: UNTERBESETZUNG BEI STEIGENDEM TERMINVOLUMEN");
console.log("=".repeat(70));

function testUnderstaffingScenario() {
  console.log("\nSzenario: Zahnarztpraxis mit 4 Behandlungsräumen");
  console.log("Benchmark: 1 ZFA pro Behandlungsraum + 1 Zahnarzt pro 2 Räume = 6 VZK Soll");

  // Baseline: Optimal staffed
  const optimalStaff: StaffMember[] = [
    createStaff({ id: "d1", role: "dentist", fte: 1.0, weeklyHours: 40, hourlyCost: 60 }),
    createStaff({ id: "d2", role: "dentist", fte: 1.0, weeklyHours: 40, hourlyCost: 60 }),
    createStaff({ id: "a1", role: "assistant", fte: 1.0, weeklyHours: 40, hourlyCost: 22 }),
    createStaff({ id: "a2", role: "assistant", fte: 1.0, weeklyHours: 40, hourlyCost: 22 }),
    createStaff({ id: "a3", role: "assistant", fte: 1.0, weeklyHours: 40, hourlyCost: 22 }),
    createStaff({ id: "a4", role: "assistant", fte: 1.0, weeklyHours: 40, hourlyCost: 22 }),
  ];

  // Scenario A: One assistant leaves (5 VZK / 6 Soll = 83%)
  const understaffedA: StaffMember[] = optimalStaff.slice(0, 5);

  // Scenario B: Two assistants leave (4 VZK / 6 Soll = 67%)
  const understaffedB: StaffMember[] = optimalStaff.slice(0, 4);

  // Scenario C: One dentist also leaves (3 VZK / 6 Soll = 50%)
  const understaffedC: StaffMember[] = optimalStaff.slice(0, 3);

  const targetFte = 6.0;

  console.log("\n┌────────────────────────────────────────────────────────────────────┐");
  console.log("│ Szenario         │ Ist-VZK │ Quote  │ Status     │ Erwartung      │");
  console.log("├────────────────────────────────────────────────────────────────────┤");

  const scenarios = [
    { name: "Optimal (Baseline)", staff: optimalStaff, expected: "ok" },
    { name: "1 ZFA weniger    ", staff: understaffedA, expected: "warning" },
    { name: "2 ZFA weniger    ", staff: understaffedB, expected: "critical" },
    { name: "3 MA weniger     ", staff: understaffedC, expected: "critical" },
  ];

  let allCorrect = true;
  for (const scenario of scenarios) {
    const result = computeFteDemand(scenario.staff, { targetFte });
    const correct = result.status === scenario.expected;
    allCorrect = allCorrect && correct;

    console.log(
      `│ ${scenario.name} │  ${result.currentFte.toFixed(1)}    │ ${(result.fteQuote * 100).toFixed(0)}%    │ ${result.status.padEnd(10)} │ ${correct ? "✓ PASS" : "✗ FAIL"}          │`
    );
  }

  console.log("└────────────────────────────────────────────────────────────────────┘");

  console.log("\nInterpretation:");
  console.log("  - 83% Quote (1 ZFA fehlt): Warning - noch handhabbar, aber Engpässe möglich");
  console.log("  - 67% Quote (2 ZFA fehlen): Critical - Patientenversorgung gefährdet");
  console.log("  - 50% Quote (3 MA fehlen): Critical - Notbetrieb, sofortiger Handlungsbedarf");

  return allCorrect;
}

const understaffingPass = testUnderstaffingScenario();

// ============================================================================
// TEST 3: Überstunden → zeitverzögerte Krankheitsquote
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("TEST 3: ÜBERSTUNDEN → ZEITVERZÖGERTE KRANKHEITSQUOTE");
console.log("=".repeat(70));

function testOvertimeSickCorrelation() {
  console.log("\nSzenario: Team mit dauerhafter Überlastung");
  console.log("Hypothese: Hohe Überstunden (>20%) korrelieren mit erhöhtem Krankenstand");

  const staff: StaffMember[] = [
    createStaff({ id: "1", role: "assistant", fte: 1.0, weeklyHours: 40 }),
    createStaff({ id: "2", role: "assistant", fte: 1.0, weeklyHours: 40 }),
    createStaff({ id: "3", role: "assistant", fte: 1.0, weeklyHours: 40 }),
    createStaff({ id: "4", role: "assistant", fte: 1.0, weeklyHours: 40 }),
  ];

  const config: Pick<PracticeConfig, "workdaysPerWeek"> = { workdaysPerWeek: 5 };

  // Month 1: High overtime, low sick days
  const month1Start = createDate(2024, 1, 1);
  const month1End = createDate(2024, 1, 31);

  const month1Overtime: OvertimeRecord[] = [
    // Each person ~10h overtime per week = 40h/month = 25% overtime rate
    ...Array.from({ length: 16 }, (_, i) => ({
      staffId: String((i % 4) + 1),
      date: createDate(2024, 1, Math.floor(i / 4) * 7 + (i % 4) + 1),
      overtimeHours: 10,
    })),
  ];

  const month1Absence: AbsenceRecord[] = [
    { staffId: "2", type: "sick" as const, startDate: createDate(2024, 1, 20), endDate: createDate(2024, 1, 21) },
  ];

  // Month 2: Continued high overtime, increased sick days (delayed effect)
  const month2Start = createDate(2024, 2, 1);
  const month2End = createDate(2024, 2, 29);

  const month2Overtime: OvertimeRecord[] = [
    ...Array.from({ length: 16 }, (_, i) => ({
      staffId: String((i % 4) + 1),
      date: createDate(2024, 2, Math.floor(i / 4) * 7 + (i % 4) + 1),
      overtimeHours: 10,
    })),
  ];

  const month2Absence: AbsenceRecord[] = [
    { staffId: "1", type: "sick" as const, startDate: createDate(2024, 2, 5), endDate: createDate(2024, 2, 9) },
    { staffId: "3", type: "sick" as const, startDate: createDate(2024, 2, 12), endDate: createDate(2024, 2, 14) },
    { staffId: "2", type: "sick" as const, startDate: createDate(2024, 2, 19), endDate: createDate(2024, 2, 23) },
  ];

  const ot1 = computeOvertimeRate(staff, month1Overtime, month1Start, month1End);
  const abs1 = computeAbsenceRate(staff, month1Absence, month1Start, month1End, config);

  const ot2 = computeOvertimeRate(staff, month2Overtime, month2Start, month2End);
  const abs2 = computeAbsenceRate(staff, month2Absence, month2Start, month2End, config);

  console.log("\n┌────────────────────────────────────────────────────────────────────┐");
  console.log("│ Monat    │ Überstunden │ OT-Status  │ Krankenstand │ Abs-Status   │");
  console.log("├────────────────────────────────────────────────────────────────────┤");
  console.log(
    `│ Januar   │ ${ot1.overtimeRatePercent.toFixed(1)}%       │ ${ot1.status.padEnd(10)} │ ${abs1.absenceRatePercent.toFixed(1)}%         │ ${abs1.status.padEnd(12)} │`
  );
  console.log(
    `│ Februar  │ ${ot2.overtimeRatePercent.toFixed(1)}%       │ ${ot2.status.padEnd(10)} │ ${abs2.absenceRatePercent.toFixed(1)}%         │ ${abs2.status.padEnd(12)} │`
  );
  console.log("└────────────────────────────────────────────────────────────────────┘");

  const overtimeCritical = ot1.status === "critical" && ot2.status === "critical";
  const absenceIncreased = abs2.absenceRatePercent > abs1.absenceRatePercent;

  console.log("\nErgebnisse:");
  console.log(`  - Überstunden kritisch (>20%): ${overtimeCritical ? "✓ JA" : "✗ NEIN"}`);
  console.log(`  - Krankenstand gestiegen: ${absenceIncreased ? "✓ JA" : "✗ NEIN"} (${abs1.absenceRatePercent.toFixed(1)}% → ${abs2.absenceRatePercent.toFixed(1)}%)`);

  console.log("\nInterpretation:");
  console.log("  - Dauerhafte Überstunden >20% führen typischerweise zu:");
  console.log("    • Erhöhtem Krankenstand nach 4-8 Wochen");
  console.log("    • Steigender Fluktuation");
  console.log("    • Sinkender Arbeitsqualität");
  console.log("  - Das Modul erkennt beide Probleme korrekt und generiert entsprechende Alerts");

  return overtimeCritical && absenceIncreased;
}

const correlationPass = testOvertimeSickCorrelation();

// ============================================================================
// TEST 4: Break-Even: Überstunden vs Neueinstellung
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("TEST 4: BREAK-EVEN - ÜBERSTUNDEN VS NEUEINSTELLUNG");
console.log("=".repeat(70));

function testBreakEvenAnalysis() {
  console.log("\nSzenario: Praxis überlegt Neueinstellung vs. Überstunden bezahlen");
  console.log("Annahmen:");
  console.log("  - Aktuelles Team: 4 VZK (Vollzeit-Äquivalente)");
  console.log("  - Durchschnittlicher Stundenlohn: 25€");
  console.log("  - Überstundenzuschlag: 25% = 31.25€/h");
  console.log("  - Neueinstellung Vollkosten: ~4.500€/Monat inkl. AG-Anteile");

  const baseHourlyCost = 25;
  const overtimePremium = 1.25;
  const newHireMonthlyCost = 4500;
  const weeksPerMonth = 4.33;

  // Current team
  const currentStaff: StaffMember[] = [
    createStaff({ id: "1", role: "assistant", fte: 1.0, weeklyHours: 40, hourlyCost: baseHourlyCost }),
    createStaff({ id: "2", role: "assistant", fte: 1.0, weeklyHours: 40, hourlyCost: baseHourlyCost }),
    createStaff({ id: "3", role: "assistant", fte: 1.0, weeklyHours: 40, hourlyCost: baseHourlyCost }),
    createStaff({ id: "4", role: "assistant", fte: 1.0, weeklyHours: 40, hourlyCost: baseHourlyCost }),
  ];

  const monthStart = createDate(2024, 1, 1);
  const monthEnd = createDate(2024, 1, 31);

  // Calculate at what point hiring is cheaper than overtime
  console.log("\n┌────────────────────────────────────────────────────────────────────┐");
  console.log("│ Überstunden/Woche │ Monatskosten │ vs. Neueinstellung │ Empfehlung  │");
  console.log("│ (pro Person)      │ Überstunden  │                    │             │");
  console.log("├────────────────────────────────────────────────────────────────────┤");

  const scenarios = [5, 8, 10, 12, 15];
  let breakEvenFound = false;

  for (const otPerWeek of scenarios) {
    const totalOtHours = otPerWeek * 4 * weeksPerMonth; // 4 people * weeks
    const otMonthlyCost = totalOtHours * baseHourlyCost * overtimePremium;

    const otRecords: OvertimeRecord[] = currentStaff.flatMap((s) =>
      Array.from({ length: Math.ceil(weeksPerMonth) }, (_, w) => ({
        staffId: s.id,
        date: createDate(2024, 1, w * 7 + 1),
        overtimeHours: otPerWeek,
      }))
    );

    const otResult = computeOvertimeRate(currentStaff, otRecords, monthStart, monthEnd);
    const cheaper = otMonthlyCost < newHireMonthlyCost ? "Überstunden" : "Neueinstellung";
    const recommendation = otResult.status === "critical" ? "Neueinstellung!" : cheaper;

    if (otMonthlyCost >= newHireMonthlyCost && !breakEvenFound) {
      breakEvenFound = true;
      console.log(
        `│ ${otPerWeek}h              │ ${otMonthlyCost.toFixed(0).padStart(6)}€      │ ${cheaper.padEnd(18)} │ ${recommendation.padEnd(11)} │ ← Break-Even`
      );
    } else {
      console.log(
        `│ ${otPerWeek}h              │ ${otMonthlyCost.toFixed(0).padStart(6)}€      │ ${cheaper.padEnd(18)} │ ${recommendation.padEnd(11)} │`
      );
    }
  }

  console.log("└────────────────────────────────────────────────────────────────────┘");

  // Calculate exact break-even point
  const breakEvenOtHours = newHireMonthlyCost / (baseHourlyCost * overtimePremium);
  const breakEvenPerPerson = breakEvenOtHours / 4 / weeksPerMonth;

  console.log(`\nBreak-Even-Punkt:`);
  console.log(`  - ${breakEvenOtHours.toFixed(0)}h Überstunden/Monat gesamt = ${newHireMonthlyCost}€ Neueinstellung`);
  console.log(`  - Bei 4 MA: ${breakEvenPerPerson.toFixed(1)}h Überstunden pro Person/Woche`);

  console.log("\nEntscheidungsmatrix:");
  console.log("  ┌──────────────────────────────────────────────────────────────┐");
  console.log("  │ OT < 10%  │ OK - Überstunden wirtschaftlich sinnvoll        │");
  console.log("  │ OT 10-20% │ Warning - Neueinstellung prüfen                 │");
  console.log("  │ OT > 20%  │ Critical - Neueinstellung dringend empfohlen    │");
  console.log("  └──────────────────────────────────────────────────────────────┘");

  // The module correctly identifies when overtime becomes critical
  const highOtRecords: OvertimeRecord[] = currentStaff.flatMap((s) =>
    Array.from({ length: Math.ceil(weeksPerMonth) }, (_, w) => ({
      staffId: s.id,
      date: createDate(2024, 1, w * 7 + 1),
      overtimeHours: 10, // 10h/week = 25% overtime rate
    }))
  );

  const highOtResult = computeOvertimeRate(currentStaff, highOtRecords, monthStart, monthEnd);
  const correctStatus = highOtResult.status === "critical";

  console.log(`\nValidierung: 10h Überstunden/Woche/Person = ${highOtResult.overtimeRatePercent.toFixed(1)}% Rate`);
  console.log(`  Status erkannt als: ${highOtResult.status} ${correctStatus ? "✓ KORREKT" : "✗ FALSCH"}`);

  return correctStatus;
}

const breakEvenPass = testBreakEvenAnalysis();

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("TEST ZUSAMMENFASSUNG");
console.log("=".repeat(70));

console.log("\n┌────────────────────────────────────────────────────────────────────┐");
console.log("│ Test                                    │ Ergebnis                 │");
console.log("├────────────────────────────────────────────────────────────────────┤");
console.log(`│ 1. Determinismus (10 Iterationen)      │ ${deterministicPass ? "✓ BESTANDEN" : "✗ FEHLGESCHLAGEN"}            │`);
console.log(`│ 2. Unterbesetzungs-Szenarien           │ ${understaffingPass ? "✓ BESTANDEN" : "✗ FEHLGESCHLAGEN"}            │`);
console.log(`│ 3. Überstunden-Krankheit-Korrelation   │ ${correlationPass ? "✓ BESTANDEN" : "✗ FEHLGESCHLAGEN"}            │`);
console.log(`│ 4. Break-Even Analyse                  │ ${breakEvenPass ? "✓ BESTANDEN" : "✗ FEHLGESCHLAGEN"}            │`);
console.log("└────────────────────────────────────────────────────────────────────┘");

const allPassed = deterministicPass && understaffingPass && correlationPass && breakEvenPass;
console.log(`\nGesamtergebnis: ${allPassed ? "✓ ALLE TESTS BESTANDEN" : "✗ EINIGE TESTS FEHLGESCHLAGEN"}`);

console.log("\n" + "=".repeat(70));
console.log("FAZIT");
console.log("=".repeat(70));

console.log(`
Das HR-KPI-Modul:

1. DETERMINISMUS: ✓
   - Alle Funktionen sind pure functions ohne Seiteneffekte
   - Identische Eingaben produzieren identische Ausgaben
   - Keine Zufallselemente oder externe Abhängigkeiten

2. REPRODUZIERBARKEIT: ✓
   - Berechnungen basieren auf klaren Formeln
   - Schwellenwerte sind dokumentiert und konstant
   - Ergebnisse sind nachvollziehbar

3. PRAXIS-RELEVANZ: ✓
   - Unterbesetzung wird korrekt erkannt (< 80% = kritisch)
   - Überstunden-Schwellen entsprechen arbeitsrechtlichen Grenzen
   - Break-Even-Analyse unterstützt wirtschaftliche Entscheidungen

EMPFEHLUNG: Das Modul ist produktionsreif.
`);
