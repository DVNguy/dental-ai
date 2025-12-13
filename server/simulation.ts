import type { Room, Staff } from "@shared/schema";
import {
  ROOM_SIZE_STANDARDS,
  STAFFING_RATIOS,
  PATIENT_FLOW_METRICS,
  evaluateRoomSizeM,
  evaluateStaffingRatios
} from "./ai/benchmarks";
import {
  getKnowledgePoweredScheduling,
  getKnowledgePoweredStaffing,
  getKnowledgePoweredLayout,
  type KnowledgePoweredLayout
} from "./ai/artifactBenchmarks";
import { normalizeRoomType } from "@shared/roomTypes";
import { pxToM } from "@shared/units";

export interface SimulationParameters {
  patientVolume: number;
  operatingHours: number;
}

export interface SimulationResult {
  efficiencyScore: number;
  harmonyScore: number;
  waitTime: number;
  patientCapacity: number;
  parameters: SimulationParameters;
}

export interface LayoutEfficiencyBreakdown {
  overallScore: number;
  categories: {
    patientFlow: {
      score: number;
      maxScore: number;
      items: EfficiencyItem[];
    };
    roomSizing: {
      score: number;
      maxScore: number;
      items: EfficiencyItem[];
    };
    essentialRooms: {
      score: number;
      maxScore: number;
      items: EfficiencyItem[];
    };
    staffAccess: {
      score: number;
      maxScore: number;
      items: EfficiencyItem[];
    };
  };
  tips: string[];
}

export interface EfficiencyItem {
  label: string;
  status: "optimal" | "acceptable" | "needs_work" | "missing";
  points: number;
  maxPoints: number;
  detail?: string;
}

function calculateDistanceM(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function getRoomCenter(room: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
  };
}

async function calculateEfficiencyScore(
  rooms: Room[], 
  layoutConfig?: KnowledgePoweredLayout
): Promise<number> {
  if (rooms.length === 0) return 0;

  const layout = layoutConfig || await getKnowledgePoweredLayout();

  const roomsByType = new Map<string, Room[]>();
  rooms.forEach(room => {
    const normalizedType = normalizeRoomType(room.type);
    if (!roomsByType.has(normalizedType)) {
      roomsByType.set(normalizedType, []);
    }
    roomsByType.get(normalizedType)!.push(room);
  });

  let score = 50;

  const reception = roomsByType.get("reception")?.[0];
  const waiting = roomsByType.get("waiting")?.[0];
  const examRooms = roomsByType.get("exam") || [];
  const lab = roomsByType.get("lab")?.[0];
  const office = roomsByType.get("office")?.[0];

  if (reception && waiting) {
    const recCenter = getRoomCenter(reception);
    const waitCenter = getRoomCenter(waiting);
    const distanceM = calculateDistanceM(recCenter.x, recCenter.y, waitCenter.x, waitCenter.y);
    
    const benchmark = layout.distanceGuidelines.receptionToWaiting;
    if (distanceM <= benchmark.optimal) {
      score += 12;
    } else if (distanceM <= benchmark.maxMeters) {
      score += 8;
    } else {
      score -= 5;
    }
  }

  if (waiting && examRooms.length > 0) {
    const waitCenter = getRoomCenter(waiting);
    const avgDistanceM = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistanceM(waitCenter.x, waitCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;
    
    const benchmark = layout.distanceGuidelines.waitingToExam;
    
    if (avgDistanceM <= benchmark.optimal) {
      score += 15;
    } else if (avgDistanceM <= benchmark.maxMeters) {
      score += 8;
    } else {
      score -= 5;
    }
  }

  examRooms.forEach(exam => {
    const evaluation = evaluateRoomSizeM("exam", exam.width, exam.height);
    if (evaluation.assessment === "optimal") {
      score += 3;
    } else if (evaluation.assessment === "undersized") {
      score -= 2;
    }
  });

  if (lab && examRooms.length > 0) {
    const labCenter = getRoomCenter(lab);
    const avgDistanceM = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistanceM(labCenter.x, labCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;
    
    const benchmark = layout.distanceGuidelines.examToLab;
    
    if (avgDistanceM <= benchmark.optimal) {
      score += 10;
    } else if (avgDistanceM <= benchmark.maxMeters) {
      score += 5;
    } else {
      score -= 3;
    }
  }

  if (office && reception) {
    const officeCenter = getRoomCenter(office);
    const recCenter = getRoomCenter(reception);
    const distanceM = calculateDistanceM(officeCenter.x, officeCenter.y, recCenter.x, recCenter.y);
    
    if (distanceM < 6) score += 5;
    else if (distanceM < 10) score += 3;
  }

  if (!reception) score -= 15;
  if (!waiting) score -= 10;
  if (examRooms.length === 0) score -= 20;

  return Math.max(0, Math.min(100, score));
}

function calculateHarmonyScore(staff: Staff[], rooms: Room[]): number {
  if (staff.length === 0) return 50;

  const doctors = staff.filter(s => s.role === "doctor" || s.role === "dentist").length;
  const nurses = staff.filter(s => s.role === "nurse").length;
  const receptionists = staff.filter(s => s.role === "receptionist").length;
  const examRooms = rooms.filter(r => r.type === "exam").length;

  const staffingAnalysis = evaluateStaffingRatios(
    doctors, 
    nurses, 
    receptionists, 
    staff.length, 
    examRooms
  );

  let score = staffingAnalysis.overallScore;

  const avgExperience = staff.reduce((sum, s) => sum + s.experienceLevel, 0) / staff.length;
  score += (avgExperience - 3) * 5;

  return Math.max(0, Math.min(100, score));
}

interface SchedulingDefaults {
  avgServiceTime: number;
  bufferMinutes: number;
  maxWaitTime: number;
}

const DEFAULT_SCHEDULING: SchedulingDefaults = {
  avgServiceTime: 30,
  bufferMinutes: 5,
  maxWaitTime: 15
};

async function loadSchedulingDefaults(): Promise<SchedulingDefaults> {
  try {
    const scheduling = await getKnowledgePoweredScheduling();
    const serviceTimes = Object.values(scheduling.serviceTimes);
    const avgServiceTime = serviceTimes.length > 0
      ? serviceTimes.reduce((sum, s) => sum + (typeof s.value === 'number' ? s.value : 30), 0) / serviceTimes.length
      : DEFAULT_SCHEDULING.avgServiceTime;
    
    const bufferMinutes = scheduling.bufferMinutes?.value != null && typeof scheduling.bufferMinutes.value === 'number'
      ? scheduling.bufferMinutes.value
      : DEFAULT_SCHEDULING.bufferMinutes;
    
    const maxWaitTime = scheduling.maxWaitTime?.value != null && typeof scheduling.maxWaitTime.value === 'number'
      ? scheduling.maxWaitTime.value
      : DEFAULT_SCHEDULING.maxWaitTime;
    
    return {
      avgServiceTime: Math.max(5, Math.min(120, avgServiceTime)),
      bufferMinutes: Math.max(0, Math.min(30, bufferMinutes)),
      maxWaitTime: Math.max(5, Math.min(60, maxWaitTime))
    };
  } catch (error) {
    return DEFAULT_SCHEDULING;
  }
}

function calculatePatientCapacity(
  rooms: Room[], 
  staff: Staff[], 
  operatingHours: number,
  schedulingDefaults?: SchedulingDefaults
): number {
  const examRooms = rooms.filter(r => r.type === "exam");
  const doctors = staff.filter(s => s.role === "doctor" || s.role === "dentist").length;
  
  const patientsPerRoomPerDay = PATIENT_FLOW_METRICS.patientsPerExamRoomPerDay.acceptable;
  
  let throughputPerHour = PATIENT_FLOW_METRICS.patientThroughputPerHour.acceptable;
  if (schedulingDefaults) {
    const totalServiceTime = schedulingDefaults.avgServiceTime + schedulingDefaults.bufferMinutes;
    throughputPerHour = Math.max(1, Math.round(60 / Math.max(1, totalServiceTime)));
  }
  
  const roomBasedCapacity = examRooms.length * patientsPerRoomPerDay;
  const providerBasedCapacity = doctors * throughputPerHour * operatingHours;
  
  let capacity = Math.min(roomBasedCapacity, providerBasedCapacity);
  
  if (capacity === 0 && examRooms.length > 0) {
    capacity = examRooms.length * Math.floor(patientsPerRoomPerDay * 0.6);
  }

  const avgExperience = staff.length > 0 
    ? staff.reduce((sum, s) => sum + s.experienceLevel, 0) / staff.length 
    : 3;
  const experienceMultiplier = 0.7 + (avgExperience / 5) * 0.6;
  capacity = Math.floor(capacity * experienceMultiplier);

  return Math.max(1, capacity);
}

function calculateWaitTime(
  patientCapacity: number, 
  patientVolume: number, 
  efficiencyScore: number,
  staff: Staff[],
  schedulingDefaults?: SchedulingDefaults
): number {
  const excellentWaitTime = PATIENT_FLOW_METRICS.waitTime.excellent;
  const acceptableWaitTime = schedulingDefaults?.maxWaitTime || PATIENT_FLOW_METRICS.waitTime.acceptable;
  const poorWaitTime = PATIENT_FLOW_METRICS.waitTime.poor;
  
  const volumeRatio = patientVolume / Math.max(1, patientCapacity);
  
  let baseWaitTime: number;
  if (volumeRatio <= 0.7) {
    baseWaitTime = excellentWaitTime;
  } else if (volumeRatio <= 1.0) {
    baseWaitTime = acceptableWaitTime;
  } else {
    baseWaitTime = poorWaitTime + (volumeRatio - 1) * 15;
  }

  const efficiencyFactor = 1 + ((100 - efficiencyScore) / 100) * 0.5;
  let waitTime = baseWaitTime * efficiencyFactor;

  if (staff.length > 0) {
    const avgExperience = staff.reduce((sum, s) => sum + s.experienceLevel, 0) / staff.length;
    const experienceFactor = 1.3 - (avgExperience / 5) * 0.3;
    waitTime *= experienceFactor;
  }

  return Math.max(5, Math.min(60, Math.round(waitTime)));
}

interface RoomInMeters {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  floor: number;
}

function convertRoomToMeters(room: Room): RoomInMeters {
  return {
    id: room.id,
    name: room.name,
    type: room.type,
    x: pxToM(room.x),
    y: pxToM(room.y),
    width: pxToM(room.width),
    height: pxToM(room.height),
    floor: room.floor,
  };
}

export async function calculateLayoutEfficiencyBreakdown(
  rooms: Room[]
): Promise<LayoutEfficiencyBreakdown> {
  const layout = await getKnowledgePoweredLayout();
  
  const roomsM = rooms.map(convertRoomToMeters);
  
  const roomsByType = new Map<string, RoomInMeters[]>();
  roomsM.forEach(room => {
    const normalizedType = normalizeRoomType(room.type);
    if (!roomsByType.has(normalizedType)) {
      roomsByType.set(normalizedType, []);
    }
    roomsByType.get(normalizedType)!.push(room);
  });

  const reception = roomsByType.get("reception")?.[0];
  const waiting = roomsByType.get("waiting")?.[0];
  const examRooms = roomsByType.get("exam") || [];
  const lab = roomsByType.get("lab")?.[0];
  const office = roomsByType.get("office")?.[0];

  const patientFlowItems: EfficiencyItem[] = [];
  const roomSizingItems: EfficiencyItem[] = [];
  const essentialRoomsItems: EfficiencyItem[] = [];
  const staffAccessItems: EfficiencyItem[] = [];
  const tips: string[] = [];

  let patientFlowScore = 0;
  const patientFlowMax = 27;
  let roomSizingScore = 0;
  let roomSizingMax = 0;
  let essentialRoomsScore = 0;
  const essentialRoomsMax = 45;
  let staffAccessScore = 0;
  const staffAccessMax = 5;

  if (reception) {
    essentialRoomsScore += 15;
    essentialRoomsItems.push({
      label: "Reception",
      status: "optimal",
      points: 15,
      maxPoints: 15,
      detail: "Reception area present"
    });
  } else {
    essentialRoomsItems.push({
      label: "Reception",
      status: "missing",
      points: 0,
      maxPoints: 15,
      detail: "Add a reception area"
    });
    tips.push("Add a reception area for patient check-in.");
  }

  if (waiting) {
    essentialRoomsScore += 10;
    essentialRoomsItems.push({
      label: "Waiting Room",
      status: "optimal",
      points: 10,
      maxPoints: 10,
      detail: "Waiting area present"
    });
  } else {
    essentialRoomsItems.push({
      label: "Waiting Room",
      status: "missing",
      points: 0,
      maxPoints: 10,
      detail: "Add a waiting area"
    });
    tips.push("Add a waiting room for patients.");
  }

  if (examRooms.length > 0) {
    essentialRoomsScore += 20;
    essentialRoomsItems.push({
      label: "Exam Rooms",
      status: "optimal",
      points: 20,
      maxPoints: 20,
      detail: `${examRooms.length} exam room(s) present`
    });
  } else {
    essentialRoomsItems.push({
      label: "Exam Rooms",
      status: "missing",
      points: 0,
      maxPoints: 20,
      detail: "Add at least one exam room"
    });
    tips.push("Add exam rooms for patient consultations.");
  }

  if (reception && waiting) {
    const recCenter = getRoomCenter(reception);
    const waitCenter = getRoomCenter(waiting);
    const distanceM = calculateDistanceM(recCenter.x, recCenter.y, waitCenter.x, waitCenter.y);
    const benchmark = layout.distanceGuidelines.receptionToWaiting;
    
    if (distanceM <= benchmark.optimal) {
      patientFlowScore += 12;
      patientFlowItems.push({
        label: "Reception → Waiting",
        status: "optimal",
        points: 12,
        maxPoints: 12,
        detail: `${distanceM.toFixed(1)}m (optimal: ≤${benchmark.optimal}m)`
      });
    } else if (distanceM <= benchmark.maxMeters) {
      patientFlowScore += 8;
      patientFlowItems.push({
        label: "Reception → Waiting",
        status: "acceptable",
        points: 8,
        maxPoints: 12,
        detail: `${distanceM.toFixed(1)}m (acceptable: ≤${benchmark.maxMeters}m)`
      });
    } else {
      patientFlowItems.push({
        label: "Reception → Waiting",
        status: "needs_work",
        points: 0,
        maxPoints: 12,
        detail: `${distanceM.toFixed(1)}m (max: ${benchmark.maxMeters}m)`
      });
      tips.push("Move waiting room closer to reception.");
    }
  }

  if (waiting && examRooms.length > 0) {
    const waitCenter = getRoomCenter(waiting);
    const avgDistanceM = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistanceM(waitCenter.x, waitCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;
    const benchmark = layout.distanceGuidelines.waitingToExam;
    
    if (avgDistanceM <= benchmark.optimal) {
      patientFlowScore += 15;
      patientFlowItems.push({
        label: "Waiting → Exam Rooms",
        status: "optimal",
        points: 15,
        maxPoints: 15,
        detail: `Avg ${avgDistanceM.toFixed(1)}m (optimal: ≤${benchmark.optimal}m)`
      });
    } else if (avgDistanceM <= benchmark.maxMeters) {
      patientFlowScore += 8;
      patientFlowItems.push({
        label: "Waiting → Exam Rooms",
        status: "acceptable",
        points: 8,
        maxPoints: 15,
        detail: `Avg ${avgDistanceM.toFixed(1)}m (acceptable: ≤${benchmark.maxMeters}m)`
      });
    } else {
      patientFlowItems.push({
        label: "Waiting → Exam Rooms",
        status: "needs_work",
        points: 0,
        maxPoints: 15,
        detail: `Avg ${avgDistanceM.toFixed(1)}m (max: ${benchmark.maxMeters}m)`
      });
      tips.push("Position exam rooms closer to the waiting area.");
    }
  }

  roomsM.forEach(room => {
    const normalizedType = normalizeRoomType(room.type);
    const standard = ROOM_SIZE_STANDARDS[normalizedType];
    if (standard) {
      roomSizingMax += 3;
      const areaM = room.width * room.height;
      const evaluation = evaluateRoomSizeM(normalizedType, room.width, room.height);
      
      if (evaluation.assessment === "optimal") {
        roomSizingScore += 3;
        roomSizingItems.push({
          label: room.name || normalizedType,
          status: "optimal",
          points: 3,
          maxPoints: 3,
          detail: `${areaM.toFixed(1)}m² (optimal: ${standard.optimalSqM}m²)`
        });
      } else if (evaluation.assessment === "undersized") {
        roomSizingItems.push({
          label: room.name || normalizedType,
          status: "needs_work",
          points: 0,
          maxPoints: 3,
          detail: `${areaM.toFixed(1)}m² (min: ${standard.minSqM}m²)`
        });
        tips.push(`Increase size of ${room.name || normalizedType} (currently ${areaM.toFixed(1)}m², min: ${standard.minSqM}m²).`);
      } else {
        roomSizingScore += 1;
        roomSizingItems.push({
          label: room.name || normalizedType,
          status: "acceptable",
          points: 1,
          maxPoints: 3,
          detail: `${areaM.toFixed(1)}m² (oversized, max: ${standard.maxSqM}m²)`
        });
      }
    }
  });

  if (office && reception) {
    const officeCenter = getRoomCenter(office);
    const recCenter = getRoomCenter(reception);
    const distanceM = calculateDistanceM(officeCenter.x, officeCenter.y, recCenter.x, recCenter.y);
    
    if (distanceM < 6) {
      staffAccessScore += 5;
      staffAccessItems.push({
        label: "Office → Reception",
        status: "optimal",
        points: 5,
        maxPoints: 5,
        detail: `${distanceM.toFixed(1)}m (optimal: <6m)`
      });
    } else if (distanceM < 10) {
      staffAccessScore += 3;
      staffAccessItems.push({
        label: "Office → Reception",
        status: "acceptable",
        points: 3,
        maxPoints: 5,
        detail: `${distanceM.toFixed(1)}m (acceptable: <10m)`
      });
    } else {
      staffAccessItems.push({
        label: "Office → Reception",
        status: "needs_work",
        points: 0,
        maxPoints: 5,
        detail: `${distanceM.toFixed(1)}m (optimal: <6m)`
      });
      tips.push("Consider placing doctor's office closer to reception for quick access.");
    }
  }

  const totalScore = patientFlowScore + roomSizingScore + essentialRoomsScore + staffAccessScore;
  const totalMax = patientFlowMax + Math.max(roomSizingMax, 9) + essentialRoomsMax + staffAccessMax;
  const overallScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    categories: {
      patientFlow: {
        score: patientFlowScore,
        maxScore: patientFlowMax,
        items: patientFlowItems
      },
      roomSizing: {
        score: roomSizingScore,
        maxScore: roomSizingMax || 9,
        items: roomSizingItems
      },
      essentialRooms: {
        score: essentialRoomsScore,
        maxScore: essentialRoomsMax,
        items: essentialRoomsItems
      },
      staffAccess: {
        score: staffAccessScore,
        maxScore: staffAccessMax,
        items: staffAccessItems
      }
    },
    tips: tips.slice(0, 5)
  };
}

export async function runSimulation(
  rooms: Room[],
  staff: Staff[],
  parameters: SimulationParameters
): Promise<SimulationResult> {
  const [schedulingDefaults, layoutConfig] = await Promise.all([
    loadSchedulingDefaults(),
    getKnowledgePoweredLayout()
  ]);
  
  const efficiencyScore = await calculateEfficiencyScore(rooms, layoutConfig);
  const harmonyScore = calculateHarmonyScore(staff, rooms);
  const patientCapacity = calculatePatientCapacity(rooms, staff, parameters.operatingHours, schedulingDefaults);
  const waitTime = calculateWaitTime(
    patientCapacity,
    parameters.patientVolume,
    efficiencyScore,
    staff,
    schedulingDefaults
  );

  return {
    efficiencyScore: Math.round(efficiencyScore * 10) / 10,
    harmonyScore: Math.round(harmonyScore * 10) / 10,
    waitTime,
    patientCapacity,
    parameters,
  };
}
