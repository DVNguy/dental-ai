import type { Room, WorkflowConnection } from "@shared/schema";
import { pxToM } from "@shared/units";
import { normalizeRoomType } from "@shared/roomTypes";

export interface WorkflowMetrics {
  totalDistanceMeters: number;
  avgStepDistanceMeters: number;
  backtrackingCount: number;
  longestConnections: Array<{ fromName: string; toName: string; distanceMeters: number }>;
  motionWasteScore: number;
}

export interface LayoutFlowBreakdown {
  patientFlowMeters: number;
  staffMotionMeters: number;
  steriLoopMeters: number;
  labLoopMeters: number;
  crossFloorPenaltyMeters: number;
  privacyRisk: boolean;
}

export interface LayoutIssue {
  severity: "critical" | "high" | "medium" | "low";
  code: string;
  title: string;
  detail: string;
  current: number;
  target?: number;
  unit: string;
}

export interface LayoutEfficiencyResult {
  score: number;
  breakdown: LayoutFlowBreakdown;
  issues: LayoutIssue[];
  tips: string[];
  workflowMetrics?: WorkflowMetrics;
}

interface RoomM {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  floor: number;
}

const FLOOR_PENALTY_METERS = 15;
const PRIVACY_MIN_DISTANCE_M = 1.5;

const FLOW_WEIGHTS = {
  patient: 0.35,
  steri: 0.35,
  staff: 0.2,
  lab: 0.1,
};

function convertToMeters(room: Room): RoomM {
  return {
    id: room.id,
    type: normalizeRoomType(room.type),
    name: room.name,
    x: pxToM(room.x),
    y: pxToM(room.y),
    width: pxToM(room.width),
    height: pxToM(room.height),
    floor: room.floor,
  };
}

function getRoomCenter(room: RoomM): { x: number; y: number } {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
  };
}

function calculateDistance(r1: RoomM, r2: RoomM): number {
  const c1 = getRoomCenter(r1);
  const c2 = getRoomCenter(r2);
  const horizontalDist = Math.sqrt(
    Math.pow(c2.x - c1.x, 2) + Math.pow(c2.y - c1.y, 2)
  );
  const floorDiff = Math.abs(r1.floor - r2.floor);
  return horizontalDist + floorDiff * FLOOR_PENALTY_METERS;
}

function findClosestRoom(from: RoomM, candidates: RoomM[]): { room: RoomM; distance: number } | null {
  if (candidates.length === 0) return null;
  let closest = candidates[0];
  let minDist = calculateDistance(from, closest);
  for (let i = 1; i < candidates.length; i++) {
    const dist = calculateDistance(from, candidates[i]);
    if (dist < minDist) {
      minDist = dist;
      closest = candidates[i];
    }
  }
  return { room: closest, distance: minDist };
}

function calculateFlowDistance(
  roomsM: RoomM[],
  sequence: string[]
): { totalMeters: number; crossFloorMeters: number } {
  const roomsByType = new Map<string, RoomM[]>();
  roomsM.forEach((r) => {
    if (!roomsByType.has(r.type)) roomsByType.set(r.type, []);
    roomsByType.get(r.type)!.push(r);
  });

  let totalMeters = 0;
  let crossFloorMeters = 0;

  for (let i = 0; i < sequence.length - 1; i++) {
    const fromType = sequence[i];
    const toType = sequence[i + 1];
    const fromRooms = roomsByType.get(fromType) || [];
    const toRooms = roomsByType.get(toType) || [];

    if (fromRooms.length === 0 || toRooms.length === 0) continue;

    let segmentTotal = 0;
    let segmentCrossFloor = 0;
    let count = 0;

    for (const from of fromRooms) {
      const closest = findClosestRoom(from, toRooms);
      if (closest) {
        segmentTotal += closest.distance;
        if (from.floor !== closest.room.floor) {
          segmentCrossFloor += Math.abs(from.floor - closest.room.floor) * FLOOR_PENALTY_METERS;
        }
        count++;
      }
    }

    if (count > 0) {
      totalMeters += segmentTotal / count;
      crossFloorMeters += segmentCrossFloor / count;
    }
  }

  return { totalMeters, crossFloorMeters };
}

export function computeWorkflowMetrics(
  rooms: Room[],
  connections: WorkflowConnection[]
): WorkflowMetrics | null {
  if (connections.length === 0) return null;

  const roomsM = rooms.map(convertToMeters);
  const roomMap = new Map(roomsM.map((r) => [r.id, r]));

  const validConnections = connections.filter(
    (c) => roomMap.has(c.fromRoomId) && roomMap.has(c.toRoomId)
  );
  
  if (validConnections.length === 0) return null;

  const connectionDistances: Array<{
    fromName: string;
    toName: string;
    distanceMeters: number;
    fromRoomId: string;
    toRoomId: string;
  }> = [];

  let totalDistanceMeters = 0;
  let backtrackingCount = 0;
  const visitedPairs = new Set<string>();

  for (const conn of validConnections) {
    const fromRoom = roomMap.get(conn.fromRoomId)!;
    const toRoom = roomMap.get(conn.toRoomId)!;

    const distance = calculateDistance(fromRoom, toRoom);
    totalDistanceMeters += distance;

    connectionDistances.push({
      fromName: fromRoom.name || fromRoom.type,
      toName: toRoom.name || toRoom.type,
      distanceMeters: Math.round(distance * 10) / 10,
      fromRoomId: conn.fromRoomId,
      toRoomId: conn.toRoomId,
    });

    const pairKey = [conn.fromRoomId, conn.toRoomId].sort().join("-");
    const reversePairKey = [conn.toRoomId, conn.fromRoomId].sort().join("-");
    if (visitedPairs.has(pairKey) || visitedPairs.has(reversePairKey)) {
      backtrackingCount++;
    }
    visitedPairs.add(pairKey);
  }

  const avgStepDistanceMeters =
    connectionDistances.length > 0
      ? Math.round((totalDistanceMeters / connectionDistances.length) * 10) / 10
      : 0;

  const longestConnections = connectionDistances
    .sort((a, b) => b.distanceMeters - a.distanceMeters)
    .slice(0, 3)
    .map(({ fromName, toName, distanceMeters }) => ({
      fromName,
      toName,
      distanceMeters,
    }));

  const OPTIMAL_TOTAL_DISTANCE = 20;
  const OPTIMAL_AVG_STEP = 4;

  let motionWasteScore = 0;
  if (totalDistanceMeters > OPTIMAL_TOTAL_DISTANCE) {
    motionWasteScore += Math.min(50, (totalDistanceMeters - OPTIMAL_TOTAL_DISTANCE) * 2);
  }
  if (avgStepDistanceMeters > OPTIMAL_AVG_STEP) {
    motionWasteScore += Math.min(30, (avgStepDistanceMeters - OPTIMAL_AVG_STEP) * 5);
  }
  motionWasteScore += backtrackingCount * 5;
  motionWasteScore = Math.min(100, Math.round(motionWasteScore));

  return {
    totalDistanceMeters: Math.round(totalDistanceMeters * 10) / 10,
    avgStepDistanceMeters,
    backtrackingCount,
    longestConnections,
    motionWasteScore,
  };
}

export function computeLayoutEfficiency(rooms: Room[]): LayoutEfficiencyResult {
  const roomsM = rooms.map(convertToMeters);
  const issues: LayoutIssue[] = [];
  const tips: string[] = [];

  const roomsByType = new Map<string, RoomM[]>();
  roomsM.forEach((r) => {
    if (!roomsByType.has(r.type)) roomsByType.set(r.type, []);
    roomsByType.get(r.type)!.push(r);
  });

  const hasReception = (roomsByType.get("reception")?.length || 0) > 0;
  const hasWaiting = (roomsByType.get("waiting")?.length || 0) > 0;
  const hasExam = (roomsByType.get("exam")?.length || 0) > 0;
  const hasSteri = (roomsByType.get("sterilization")?.length || 0) > 0;
  const hasLab = (roomsByType.get("lab")?.length || 0) > 0;
  const hasOffice = (roomsByType.get("office")?.length || 0) > 0;

  if (!hasReception) {
    issues.push({
      severity: "critical",
      code: "MISSING_RECEPTION",
      title: "Empfang fehlt",
      detail: "Kein Empfangsbereich vorhanden. Patientenfluss nicht berechenbar.",
      current: 0,
      target: 1,
      unit: "Räume",
    });
    tips.push("Fügen Sie einen Empfangsbereich hinzu.");
  }

  if (!hasWaiting) {
    issues.push({
      severity: "critical",
      code: "MISSING_WAITING",
      title: "Wartezimmer fehlt",
      detail: "Kein Wartebereich vorhanden.",
      current: 0,
      target: 1,
      unit: "Räume",
    });
    tips.push("Fügen Sie ein Wartezimmer hinzu.");
  }

  if (!hasExam) {
    issues.push({
      severity: "critical",
      code: "MISSING_EXAM",
      title: "Behandlungsraum fehlt",
      detail: "Keine Behandlungsräume vorhanden.",
      current: 0,
      target: 1,
      unit: "Räume",
    });
    tips.push("Fügen Sie mindestens einen Behandlungsraum hinzu.");
  }

  const patientFlow = calculateFlowDistance(roomsM, ["reception", "waiting", "exam", "reception"]);
  const staffFlow = calculateFlowDistance(roomsM, ["exam", "office", "exam"]);
  
  const steriType = hasSteri ? "sterilization" : hasLab ? "lab" : null;
  const steriFlow = steriType
    ? calculateFlowDistance(roomsM, ["exam", steriType, "exam"])
    : { totalMeters: 0, crossFloorMeters: 0 };
  
  const labFlow = hasLab
    ? calculateFlowDistance(roomsM, ["exam", "lab", "exam"])
    : { totalMeters: 0, crossFloorMeters: 0 };

  const crossFloorPenaltyMeters =
    patientFlow.crossFloorMeters +
    staffFlow.crossFloorMeters +
    steriFlow.crossFloorMeters +
    labFlow.crossFloorMeters;

  let privacyRisk = false;
  const receptions = roomsByType.get("reception") || [];
  const waitings = roomsByType.get("waiting") || [];
  
  for (const rec of receptions) {
    for (const wait of waitings) {
      if (rec.floor === wait.floor) {
        const c1 = getRoomCenter(rec);
        const c2 = getRoomCenter(wait);
        const dist = Math.sqrt(Math.pow(c2.x - c1.x, 2) + Math.pow(c2.y - c1.y, 2));
        if (dist < PRIVACY_MIN_DISTANCE_M) {
          privacyRisk = true;
          issues.push({
            severity: "high",
            code: "PRIVACY_RISK",
            title: "Diskretionszone fehlt",
            detail: `Wartezimmer zu nah am Empfang (${dist.toFixed(1)}m). Mindestabstand: ${PRIVACY_MIN_DISTANCE_M}m.`,
            current: Math.round(dist * 10) / 10,
            target: PRIVACY_MIN_DISTANCE_M,
            unit: "m",
          });
        }
      }
    }
  }

  if (crossFloorPenaltyMeters > 0) {
    issues.push({
      severity: "medium",
      code: "CROSS_FLOOR_PENALTY",
      title: "Etagenwechsel erhöht Laufwege",
      detail: `Räume auf verschiedenen Etagen verursachen ${crossFloorPenaltyMeters.toFixed(0)}m zusätzliche Wege.`,
      current: Math.round(crossFloorPenaltyMeters),
      unit: "m",
    });
    tips.push("Platzieren Sie zusammengehörige Räume auf derselben Etage.");
  }

  if (!hasSteri && !hasLab) {
    issues.push({
      severity: "medium",
      code: "NO_STERI_OR_LAB",
      title: "Sterilisation/Labor fehlt",
      detail: "Kein Sterilisations- oder Laborraum vorhanden.",
      current: 0,
      target: 1,
      unit: "Räume",
    });
  }

  if (!hasOffice) {
    issues.push({
      severity: "low",
      code: "NO_OFFICE",
      title: "Arztzimmer fehlt",
      detail: "Kein Büro/Arztzimmer für administrative Aufgaben.",
      current: 0,
      target: 1,
      unit: "Räume",
    });
  }

  const OPTIMAL_PATIENT_FLOW = 15;
  const OPTIMAL_STAFF_FLOW = 8;
  const OPTIMAL_STERI_FLOW = 10;
  const OPTIMAL_LAB_FLOW = 10;

  let score = 100;

  const patientPenalty = Math.max(0, patientFlow.totalMeters - OPTIMAL_PATIENT_FLOW);
  const staffPenalty = Math.max(0, staffFlow.totalMeters - OPTIMAL_STAFF_FLOW);
  const steriPenalty = Math.max(0, steriFlow.totalMeters - OPTIMAL_STERI_FLOW);
  const labPenalty = Math.max(0, labFlow.totalMeters - OPTIMAL_LAB_FLOW);

  score -= patientPenalty * FLOW_WEIGHTS.patient * 2;
  score -= staffPenalty * FLOW_WEIGHTS.staff * 2;
  score -= steriPenalty * FLOW_WEIGHTS.steri * 2;
  score -= labPenalty * FLOW_WEIGHTS.lab * 2;

  if (!hasReception) score -= 20;
  if (!hasWaiting) score -= 15;
  if (!hasExam) score -= 25;
  if (privacyRisk) score -= 10;

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (patientFlow.totalMeters > OPTIMAL_PATIENT_FLOW && tips.length < 6) {
    tips.push(`Verkürzen Sie den Patientenweg (aktuell ${patientFlow.totalMeters.toFixed(0)}m, optimal <${OPTIMAL_PATIENT_FLOW}m).`);
  }
  if (privacyRisk && tips.length < 6) {
    tips.push("Vergrößern Sie den Abstand zwischen Empfang und Wartezimmer für mehr Diskretion.");
  }
  if (steriFlow.totalMeters > OPTIMAL_STERI_FLOW && tips.length < 6) {
    tips.push("Platzieren Sie die Sterilisation näher an den Behandlungsräumen.");
  }

  return {
    score,
    breakdown: {
      patientFlowMeters: Math.round(patientFlow.totalMeters * 10) / 10,
      staffMotionMeters: Math.round(staffFlow.totalMeters * 10) / 10,
      steriLoopMeters: Math.round(steriFlow.totalMeters * 10) / 10,
      labLoopMeters: Math.round(labFlow.totalMeters * 10) / 10,
      crossFloorPenaltyMeters: Math.round(crossFloorPenaltyMeters * 10) / 10,
      privacyRisk,
    },
    issues,
    tips: tips.slice(0, 6),
  };
}
