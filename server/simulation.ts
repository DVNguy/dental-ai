import type { Room, Staff } from "@shared/schema";
import {
  ROOM_SIZE_STANDARDS,
  STAFFING_RATIOS,
  PATIENT_FLOW_METRICS,
  LAYOUT_EFFICIENCY_PRINCIPLES,
  evaluateRoomSize,
  evaluateStaffingRatios,
  pixelsToSqM
} from "./ai/benchmarks";
import {
  getKnowledgePoweredScheduling,
  getKnowledgePoweredStaffing
} from "./ai/artifactBenchmarks";
import { 
  normalizeRoomType, 
  pxToMeters,
  DEFAULT_LAYOUT_SCALE_PX_PER_METER 
} from "@shared/roomTypes";

export interface SimulationParameters {
  patientVolume: number;
  operatingHours: number;
  layoutScalePxPerMeter?: number;
}

export interface SimulationResult {
  efficiencyScore: number;
  harmonyScore: number;
  waitTime: number;
  patientCapacity: number;
  parameters: SimulationParameters;
}

function calculateDistancePx(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function getRoomCenter(room: Room): { x: number; y: number } {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
  };
}

function calculateEfficiencyScore(rooms: Room[], scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER): number {
  if (rooms.length === 0) return 0;

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
    const distancePx = calculateDistancePx(recCenter.x, recCenter.y, waitCenter.x, waitCenter.y);
    const distanceM = pxToMeters(distancePx, scalePxPerMeter);
    
    const benchmark = LAYOUT_EFFICIENCY_PRINCIPLES.distanceGuidelines.receptionToWaiting;
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
    const avgDistancePx = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistancePx(waitCenter.x, waitCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;
    
    const distanceM = pxToMeters(avgDistancePx, scalePxPerMeter);
    const benchmark = LAYOUT_EFFICIENCY_PRINCIPLES.distanceGuidelines.waitingToExam;
    
    if (distanceM <= benchmark.optimal) {
      score += 15;
    } else if (distanceM <= benchmark.maxMeters) {
      score += 8;
    } else {
      score -= 5;
    }
  }

  examRooms.forEach(exam => {
    const evaluation = evaluateRoomSize("exam", exam.width, exam.height, scalePxPerMeter);
    if (evaluation.assessment === "optimal") {
      score += 3;
    } else if (evaluation.assessment === "undersized") {
      score -= 2;
    }
  });

  if (lab && examRooms.length > 0) {
    const labCenter = getRoomCenter(lab);
    const avgDistancePx = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistancePx(labCenter.x, labCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;
    
    const distanceM = pxToMeters(avgDistancePx, scalePxPerMeter);
    const benchmark = LAYOUT_EFFICIENCY_PRINCIPLES.distanceGuidelines.examToLab;
    
    if (distanceM <= benchmark.optimal) {
      score += 10;
    } else if (distanceM <= benchmark.maxMeters) {
      score += 5;
    } else {
      score -= 3;
    }
  }

  if (office && reception) {
    const officeCenter = getRoomCenter(office);
    const recCenter = getRoomCenter(reception);
    const distancePx = calculateDistancePx(officeCenter.x, officeCenter.y, recCenter.x, recCenter.y);
    const distanceM = pxToMeters(distancePx, scalePxPerMeter);
    
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

export async function runSimulation(
  rooms: Room[],
  staff: Staff[],
  parameters: SimulationParameters
): Promise<SimulationResult> {
  const schedulingDefaults = await loadSchedulingDefaults();
  const scale = parameters.layoutScalePxPerMeter || DEFAULT_LAYOUT_SCALE_PX_PER_METER;
  
  const efficiencyScore = calculateEfficiencyScore(rooms, scale);
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
