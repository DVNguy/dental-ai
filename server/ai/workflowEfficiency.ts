import type { Room, Workflow, WorkflowStep } from "@shared/schema";

const PX_PER_METER = 40;

const DISTANCE_BANDS = {
  short: 3,
  medium: 8,
} as const;

const FLOOR_PENALTY_METERS = 10;

export interface StepAnalysis {
  stepIndex: number;
  stepId: string;
  fromRoomId: string;
  toRoomId: string;
  fromRoomName: string;
  toRoomName: string;
  distanceM: number;
  distanceBand: "short" | "medium" | "long";
  isFloorChange: boolean;
  frictionScore: number;
}

export interface WorkflowAnalysisResult {
  workflowId: string;
  workflowName: string;
  actorType: string;
  totalDistanceM: number;
  distanceBandCounts: {
    short: number;
    medium: number;
    long: number;
  };
  floorChangeCount: number;
  frictionIndex: number;
  score: number;
  top3ExpensiveSteps: StepAnalysis[];
  allSteps: StepAnalysis[];
}

export interface AnalyzeWorkflowsResult {
  practiceId: string;
  workflows: WorkflowAnalysisResult[];
  overallScore: number;
  overallFrictionIndex: number;
  recommendations: Recommendation[];
}

export interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  category: "backtracking" | "distance" | "floor" | "process" | "digital";
}

function computeDistance(
  room1: Room,
  room2: Room,
  pxPerMeter: number = PX_PER_METER
): { distanceM: number; isFloorChange: boolean } {
  const isFloorChange = room1.floor !== room2.floor;
  
  const center1X = room1.x + room1.width / 2;
  const center1Y = room1.y + room1.height / 2;
  const center2X = room2.x + room2.width / 2;
  const center2Y = room2.y + room2.height / 2;
  
  const dxPx = Math.abs(center2X - center1X);
  const dyPx = Math.abs(center2Y - center1Y);
  
  let distancePx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
  let distanceM = distancePx / pxPerMeter;
  
  if (isFloorChange) {
    distanceM += FLOOR_PENALTY_METERS;
  }
  
  return { distanceM: Math.round(distanceM * 10) / 10, isFloorChange };
}

function classifyDistance(distanceM: number): "short" | "medium" | "long" {
  if (distanceM <= DISTANCE_BANDS.short) return "short";
  if (distanceM <= DISTANCE_BANDS.medium) return "medium";
  return "long";
}

function computeFrictionScore(step: { distanceM: number; isFloorChange: boolean; weight: number }): number {
  const baseFriction = step.distanceM;
  const weightMultiplier = step.weight || 1;
  const floorPenalty = step.isFloorChange ? 1.5 : 1;
  
  return Math.round(baseFriction * weightMultiplier * floorPenalty * 10) / 10;
}

function getRoomName(room: Room, roomTypes: Record<string, string>): string {
  if (room.name && room.name.trim()) return room.name;
  return roomTypes[room.type] || room.type;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  reception: "Empfang",
  waiting: "Wartebereich",
  exam: "Behandlung",
  xray: "Röntgen",
  office: "Büro",
  sterilization: "Sterilisation",
  lab: "Labor",
  storage: "Lager",
  toilet: "WC",
  kitchen: "Küche",
  changing: "Umkleide",
};

export function analyzeWorkflow(
  workflow: Workflow,
  steps: WorkflowStep[],
  rooms: Room[],
  pxPerMeter: number = PX_PER_METER
): WorkflowAnalysisResult {
  const roomMap = new Map(rooms.map(r => [r.id, r]));
  const sortedSteps = [...steps].sort((a, b) => a.stepIndex - b.stepIndex);
  
  const distanceBandCounts = { short: 0, medium: 0, long: 0 };
  let totalDistanceM = 0;
  let totalFriction = 0;
  let floorChangeCount = 0;
  
  const analyzedSteps: StepAnalysis[] = sortedSteps.map(step => {
    const fromRoom = roomMap.get(step.fromRoomId);
    const toRoom = roomMap.get(step.toRoomId);
    
    if (!fromRoom || !toRoom) {
      return {
        stepIndex: step.stepIndex,
        stepId: step.id,
        fromRoomId: step.fromRoomId,
        toRoomId: step.toRoomId,
        fromRoomName: "Unbekannt",
        toRoomName: "Unbekannt",
        distanceM: 0,
        distanceBand: "short" as const,
        isFloorChange: false,
        frictionScore: 0,
      };
    }
    
    const { distanceM, isFloorChange } = computeDistance(fromRoom, toRoom, pxPerMeter);
    const distanceBand = classifyDistance(distanceM);
    const frictionScore = computeFrictionScore({ 
      distanceM, 
      isFloorChange, 
      weight: step.weight 
    });
    
    totalDistanceM += distanceM;
    totalFriction += frictionScore;
    distanceBandCounts[distanceBand]++;
    if (isFloorChange) floorChangeCount++;
    
    return {
      stepIndex: step.stepIndex,
      stepId: step.id,
      fromRoomId: step.fromRoomId,
      toRoomId: step.toRoomId,
      fromRoomName: getRoomName(fromRoom, ROOM_TYPE_LABELS),
      toRoomName: getRoomName(toRoom, ROOM_TYPE_LABELS),
      distanceM,
      distanceBand,
      isFloorChange,
      frictionScore,
    };
  });
  
  const stepCount = analyzedSteps.length;
  const avgFriction = stepCount > 0 ? totalFriction / stepCount : 0;
  const maxReasonableFriction = 15;
  const frictionIndex = Math.min(avgFriction / maxReasonableFriction, 1) * 100;
  
  const score = Math.max(0, Math.round(100 - frictionIndex));
  
  const top3ExpensiveSteps = [...analyzedSteps]
    .sort((a, b) => b.frictionScore - a.frictionScore)
    .slice(0, 3);
  
  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    actorType: workflow.actorType,
    totalDistanceM: Math.round(totalDistanceM * 10) / 10,
    distanceBandCounts,
    floorChangeCount,
    frictionIndex: Math.round(frictionIndex),
    score,
    top3ExpensiveSteps,
    allSteps: analyzedSteps,
  };
}

export function generateRuleBasedRecommendations(
  workflowResults: WorkflowAnalysisResult[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  
  for (const wf of workflowResults) {
    const longDistanceSteps = wf.allSteps.filter(s => s.distanceBand === "long");
    if (longDistanceSteps.length > 0) {
      const topLong = longDistanceSteps[0];
      recommendations.push({
        id: `long-distance-${wf.workflowId}`,
        priority: "high",
        title: "Lange Wege reduzieren",
        description: `Der Weg von "${topLong.fromRoomName}" zu "${topLong.toRoomName}" ist ${topLong.distanceM}m lang. Erwägen Sie, diese Räume näher zusammen zu platzieren oder Materialien dezentral vorzuhalten.`,
        category: "distance",
      });
    }
    
    if (wf.floorChangeCount > 0) {
      recommendations.push({
        id: `floor-change-${wf.workflowId}`,
        priority: "high",
        title: "Etagenwechsel minimieren",
        description: `${wf.floorChangeCount} Etagenwechsel im Workflow "${wf.workflowName}". Jeder Wechsel kostet ca. ${FLOOR_PENALTY_METERS}m Zusatzweg. Prüfen Sie, ob alle Schritte auf einer Etage möglich sind.`,
        category: "floor",
      });
    }
    
    const visitedRooms = new Set<string>();
    let backtrackCount = 0;
    for (const step of wf.allSteps) {
      if (visitedRooms.has(step.toRoomId)) {
        backtrackCount++;
      }
      visitedRooms.add(step.fromRoomId);
      visitedRooms.add(step.toRoomId);
    }
    
    if (backtrackCount > 0) {
      recommendations.push({
        id: `backtrack-${wf.workflowId}`,
        priority: "medium",
        title: "Rückläufe vermeiden",
        description: `${backtrackCount}x wird ein bereits besuchter Raum erneut angelaufen. Überlegen Sie, ob Arbeitsschritte gebündelt werden können.`,
        category: "backtracking",
      });
    }
  }
  
  const hasReception = workflowResults.some(wf => 
    wf.allSteps.some(s => 
      s.fromRoomName.toLowerCase().includes("empfang") || 
      s.toRoomName.toLowerCase().includes("empfang")
    )
  );
  
  if (hasReception) {
    recommendations.push({
      id: "digital-intake",
      priority: "low",
      title: "Digitale Anamnese",
      description: "Patienten können Formulare vorab online ausfüllen. Das spart Wartezeit und reduziert Laufwege am Empfang.",
      category: "digital",
    });
  }
  
  if (workflowResults.some(wf => wf.score < 70)) {
    recommendations.push({
      id: "satellite-materials",
      priority: "medium",
      title: "Material-Satelliten einrichten",
      description: "Häufig benötigte Materialien dezentral in der Nähe der Behandlungsräume lagern, um Wege zur Sterilisation/Lager zu reduzieren.",
      category: "process",
    });
  }
  
  return recommendations.slice(0, 5);
}

export async function analyzeWorkflows(
  practiceId: string,
  rooms: Room[],
  workflows: Workflow[],
  workflowStepsMap: Map<string, WorkflowStep[]>,
  pxPerMeter: number = PX_PER_METER
): Promise<AnalyzeWorkflowsResult> {
  const workflowResults: WorkflowAnalysisResult[] = [];
  
  for (const workflow of workflows) {
    const steps = workflowStepsMap.get(workflow.id) || [];
    if (steps.length === 0) continue;
    
    const analysis = analyzeWorkflow(workflow, steps, rooms, pxPerMeter);
    workflowResults.push(analysis);
  }
  
  let overallScore = 100;
  let overallFriction = 0;
  
  if (workflowResults.length > 0) {
    const totalScore = workflowResults.reduce((sum, w) => sum + w.score, 0);
    overallScore = Math.round(totalScore / workflowResults.length);
    
    const totalFriction = workflowResults.reduce((sum, w) => sum + w.frictionIndex, 0);
    overallFriction = Math.round(totalFriction / workflowResults.length);
  }
  
  const recommendations = generateRuleBasedRecommendations(workflowResults);
  
  return {
    practiceId,
    workflows: workflowResults,
    overallScore,
    overallFrictionIndex: overallFriction,
    recommendations,
  };
}
