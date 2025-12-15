#!/usr/bin/env npx tsx
/**
 * Smoke Test für Authentication
 * 
 * Führt grundlegende Checks aus, um sicherzustellen, dass:
 * 1. Unauthenticated Requests korrekt mit 401 abgelehnt werden
 * 2. Protected Endpoints nicht ohne Login zugänglich sind
 * 
 * Ausführung: npx tsx scripts/smoke-auth.ts
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

interface TestResult {
  name: string;
  passed: boolean;
  expected: number;
  actual: number;
  message?: string;
}

async function runTest(
  name: string,
  url: string,
  method: string,
  expectedStatus: number
): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      method,
      headers: { "Content-Type": "application/json" },
    });
    
    const passed = response.status === expectedStatus;
    return {
      name,
      passed,
      expected: expectedStatus,
      actual: response.status,
      message: passed ? "✅ OK" : `❌ Expected ${expectedStatus}, got ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      passed: false,
      expected: expectedStatus,
      actual: 0,
      message: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function main() {
  console.log("🔐 Auth Smoke Test");
  console.log("==================");
  console.log(`Base URL: ${BASE_URL}\n`);

  const tests: TestResult[] = [];

  tests.push(await runTest(
    "GET /api/benchmarks ohne Auth → 401",
    "/api/benchmarks",
    "GET",
    401
  ));

  tests.push(await runTest(
    "GET /api/me ohne Auth → 401",
    "/api/me",
    "GET",
    401
  ));

  tests.push(await runTest(
    "PUT /api/rooms/fake-id ohne Auth → 401",
    "/api/rooms/fake-id",
    "PUT",
    401
  ));

  tests.push(await runTest(
    "GET /api/practices/fake-id ohne Auth → 401",
    "/api/practices/fake-id",
    "GET",
    401
  ));

  tests.push(await runTest(
    "POST /api/simulations/run ohne Auth → 401",
    "/api/simulations/run",
    "POST",
    401
  ));

  console.log("Results:");
  console.log("---------");
  
  let allPassed = true;
  for (const test of tests) {
    console.log(`${test.message} - ${test.name}`);
    if (!test.passed) allPassed = false;
  }

  console.log("\n---------");
  if (allPassed) {
    console.log("✅ Alle Tests bestanden!");
    process.exit(0);
  } else {
    console.log("❌ Einige Tests fehlgeschlagen!");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
