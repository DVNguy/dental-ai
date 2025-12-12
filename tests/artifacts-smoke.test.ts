import { z } from "zod";
import { ARTIFACT_TYPES, MODULES, type SourceCitation, type BenchmarkPayload, type RulePayload } from "../shared/taxonomy";
import { runSimulation, type SimulationParameters } from "../server/simulation";
import type { Room, Staff } from "../shared/schema";

const SourceCitationSchema = z.object({
  docName: z.string(),
  headingPath: z.string().nullable(),
  chunkId: z.string()
});

const BenchmarkPayloadSchema = z.object({
  metric: z.string(),
  unit: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
  optimal: z.number().optional(),
  description: z.string(),
  source: z.string()
});

const RulePayloadSchema = z.object({
  condition: z.string(),
  action: z.string(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  description: z.string()
});

const ArtifactSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().nullable().optional(),
  artifactType: z.enum(ARTIFACT_TYPES),
  module: z.enum(MODULES),
  topic: z.string(),
  payloadJson: z.union([BenchmarkPayloadSchema, RulePayloadSchema, z.record(z.any())]),
  sourceCitations: z.array(SourceCitationSchema),
  confidence: z.number().min(0).max(1),
  version: z.number().int().positive(),
  sourceHash: z.string().nullable().optional()
});

async function testArtifactSchemaValidation(): Promise<boolean> {
  console.log("Testing artifact schema validation...");

  const validBenchmark = {
    artifactType: "benchmark" as const,
    module: "layout" as const,
    topic: "Behandlungsraum Größe",
    payloadJson: {
      metric: "Raumgröße",
      unit: "m²",
      min: 9,
      max: 12,
      optimal: 10,
      description: "Behandlungsraum Mindest- und Maximalgröße gemäß ArbStättV",
      source: "ArbStättV"
    },
    sourceCitations: [{
      docName: "coaching-guide.docx",
      headingPath: "Layout > Raumgrößen",
      chunkId: "chunk-123"
    }],
    confidence: 0.85,
    version: 1
  };

  const validRule = {
    artifactType: "rule" as const,
    module: "layout" as const,
    topic: "Wartebereich Pflicht",
    payloadJson: {
      condition: "Kein Wartebereich vorhanden",
      action: "Wartebereich hinzufügen (mind. 15m²)",
      priority: "critical" as const,
      description: "Wartebereich ist für Patientenkomfort essenziell"
    },
    sourceCitations: [],
    confidence: 0.9,
    version: 1
  };

  const invalidArtifact = {
    artifactType: "unknown_type",
    module: "layout",
    topic: "Test"
  };

  try {
    const result1 = ArtifactSchema.safeParse(validBenchmark);
    if (!result1.success) {
      console.error("  FAIL: Valid benchmark should pass validation", result1.error.issues);
      return false;
    }
    console.log("  PASS: Benchmark artifact validated");

    const result2 = ArtifactSchema.safeParse(validRule);
    if (!result2.success) {
      console.error("  FAIL: Valid rule should pass validation", result2.error.issues);
      return false;
    }
    console.log("  PASS: Rule artifact validated");

    const result3 = ArtifactSchema.safeParse(invalidArtifact);
    if (result3.success) {
      console.error("  FAIL: Invalid artifact should fail validation");
      return false;
    }
    console.log("  PASS: Invalid artifact correctly rejected");

    return true;
  } catch (error) {
    console.error("  ERROR:", error);
    return false;
  }
}

async function testSimulatorWithMockData(): Promise<boolean> {
  console.log("\nTesting simulator with mock practice data...");

  const mockRooms: Room[] = [
    { id: "1", practiceId: "test", type: "reception", name: "Empfang", x: 0, y: 0, width: 150, height: 120 },
    { id: "2", practiceId: "test", type: "waiting", name: "Wartebereich", x: 200, y: 0, width: 200, height: 180 },
    { id: "3", practiceId: "test", type: "exam", name: "Behandlungsraum 1", x: 0, y: 200, width: 180, height: 150 },
    { id: "4", practiceId: "test", type: "exam", name: "Behandlungsraum 2", x: 200, y: 200, width: 180, height: 150 },
    { id: "5", practiceId: "test", type: "lab", name: "Labor", x: 400, y: 200, width: 150, height: 120 }
  ];

  const mockStaff: Staff[] = [
    { id: "1", practiceId: "test", name: "Dr. Müller", role: "dentist", avatar: "doctor-1", experienceLevel: 4, specializations: ["Implantologie"] },
    { id: "2", practiceId: "test", name: "MFA Schmidt", role: "nurse", avatar: "nurse-1", experienceLevel: 3, specializations: [] },
    { id: "3", practiceId: "test", name: "MFA Weber", role: "nurse", avatar: "nurse-2", experienceLevel: 5, specializations: [] },
    { id: "4", practiceId: "test", name: "Frau Klein", role: "receptionist", avatar: "receptionist-1", experienceLevel: 3, specializations: [] }
  ];

  const parameters: SimulationParameters = {
    patientVolume: 25,
    operatingHours: 8
  };

  try {
    const result = await runSimulation(mockRooms, mockStaff, parameters);

    if (typeof result.efficiencyScore !== 'number' || isNaN(result.efficiencyScore)) {
      console.error("  FAIL: efficiencyScore is not a valid number");
      return false;
    }
    console.log(`  efficiencyScore: ${result.efficiencyScore}`);

    if (typeof result.harmonyScore !== 'number' || isNaN(result.harmonyScore)) {
      console.error("  FAIL: harmonyScore is not a valid number");
      return false;
    }
    console.log(`  harmonyScore: ${result.harmonyScore}`);

    if (typeof result.waitTime !== 'number' || isNaN(result.waitTime)) {
      console.error("  FAIL: waitTime is not a valid number");
      return false;
    }
    console.log(`  waitTime: ${result.waitTime} min`);

    if (typeof result.patientCapacity !== 'number' || isNaN(result.patientCapacity)) {
      console.error("  FAIL: patientCapacity is not a valid number");
      return false;
    }
    console.log(`  patientCapacity: ${result.patientCapacity} patients/day`);

    if (result.efficiencyScore < 0 || result.efficiencyScore > 100) {
      console.error("  FAIL: efficiencyScore out of range [0-100]");
      return false;
    }

    if (result.harmonyScore < 0 || result.harmonyScore > 100) {
      console.error("  FAIL: harmonyScore out of range [0-100]");
      return false;
    }

    if (result.waitTime < 5 || result.waitTime > 60) {
      console.error("  FAIL: waitTime out of expected range [5-60]");
      return false;
    }

    console.log("  PASS: Simulator returned valid results");
    return true;
  } catch (error) {
    console.error("  ERROR:", error);
    return false;
  }
}

async function testSimulatorWithEmptyData(): Promise<boolean> {
  console.log("\nTesting simulator with empty practice data...");

  const emptyRooms: Room[] = [];
  const emptyStaff: Staff[] = [];
  const parameters: SimulationParameters = {
    patientVolume: 10,
    operatingHours: 8
  };

  try {
    const result = await runSimulation(emptyRooms, emptyStaff, parameters);

    if (result.efficiencyScore !== 0) {
      console.log(`  Note: efficiencyScore for empty practice: ${result.efficiencyScore}`);
    }

    if (result.patientCapacity < 1) {
      console.error("  FAIL: patientCapacity should be at least 1");
      return false;
    }

    console.log("  PASS: Simulator handles empty data gracefully");
    return true;
  } catch (error) {
    console.error("  ERROR:", error);
    return false;
  }
}

async function main() {
  console.log("=== Phase 2.5 Smoke Tests ===\n");

  let passed = 0;
  let failed = 0;

  if (await testArtifactSchemaValidation()) {
    passed++;
  } else {
    failed++;
  }

  if (await testSimulatorWithMockData()) {
    passed++;
  } else {
    failed++;
  }

  if (await testSimulatorWithEmptyData()) {
    passed++;
  } else {
    failed++;
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
