import type { Room, Staff } from "@shared/schema";
import {
  ROOM_SIZE_STANDARDS,
  STAFFING_RATIOS,
  PATIENT_FLOW_METRICS,
  LAYOUT_EFFICIENCY_PRINCIPLES,
  evaluateRoomSize,
  evaluateStaffingRatios,
  pixelsToSqFt
} from "./ai/benchmarks";

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

function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function getRoomCenter(room: Room): { x: number; y: number } {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
  };
}

function calculateEfficiencyScore(rooms: Room[]): number {
  if (rooms.length === 0) return 0;

  const roomsByType = new Map<string, Room[]>();
  rooms.forEach(room => {
    if (!roomsByType.has(room.type)) {
      roomsByType.set(room.type, []);
    }
    roomsByType.get(room.type)!.push(room);
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
    const distancePx = calculateDistance(recCenter.x, recCenter.y, waitCenter.x, waitCenter.y);
    const distanceFt = distancePx * 0.5;
    
    const benchmark = LAYOUT_EFFICIENCY_PRINCIPLES.distanceGuidelines.receptionToWaiting;
    if (distanceFt <= benchmark.optimal) {
      score += 12;
    } else if (distanceFt <= benchmark.maxFeet) {
      score += 8;
    } else {
      score -= 5;
    }
  }

  if (waiting && examRooms.length > 0) {
    const waitCenter = getRoomCenter(waiting);
    const avgDistance = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistance(waitCenter.x, waitCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;
    
    const distanceFt = avgDistance * 0.5;
    const benchmark = LAYOUT_EFFICIENCY_PRINCIPLES.distanceGuidelines.waitingToExam;
    
    if (distanceFt <= benchmark.optimal) {
      score += 15;
    } else if (distanceFt <= benchmark.maxFeet) {
      score += 8;
    } else {
      score -= 5;
    }
  }

  examRooms.forEach(exam => {
    const evaluation = evaluateRoomSize("exam", exam.width, exam.height);
    if (evaluation.assessment === "optimal") {
      score += 3;
    } else if (evaluation.assessment === "undersized") {
      score -= 2;
    }
  });

  if (lab && examRooms.length > 0) {
    const labCenter = getRoomCenter(lab);
    const avgDistance = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistance(labCenter.x, labCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;
    
    const distanceFt = avgDistance * 0.5;
    const benchmark = LAYOUT_EFFICIENCY_PRINCIPLES.distanceGuidelines.examToLab;
    
    if (distanceFt <= benchmark.optimal) {
      score += 10;
    } else if (distanceFt <= benchmark.maxFeet) {
      score += 5;
    } else {
      score -= 3;
    }
  }

  if (office && reception) {
    const officeCenter = getRoomCenter(office);
    const recCenter = getRoomCenter(reception);
    const distancePx = calculateDistance(officeCenter.x, officeCenter.y, recCenter.x, recCenter.y);
    const distanceFt = distancePx * 0.5;
    
    if (distanceFt < 100) score += 5;
    else if (distanceFt < 150) score += 3;
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

  const avgEfficiency = staff.reduce((sum, s) => sum + s.efficiency, 0) / staff.length;
  score += (avgEfficiency - 50) * 0.2;

  const avgStress = staff.reduce((sum, s) => sum + s.stress, 0) / staff.length;
  score -= (avgStress - 50) * 0.3;

  const highStressCount = staff.filter(s => s.stress > 70).length;
  if (highStressCount > staff.length * 0.3) score -= 8;

  return Math.max(0, Math.min(100, score));
}

function calculatePatientCapacity(rooms: Room[], staff: Staff[], operatingHours: number): number {
  const examRooms = rooms.filter(r => r.type === "exam");
  const doctors = staff.filter(s => s.role === "doctor" || s.role === "dentist").length;
  
  const patientsPerRoomPerDay = PATIENT_FLOW_METRICS.patientsPerExamRoomPerDay.acceptable;
  const throughputPerHour = PATIENT_FLOW_METRICS.patientThroughputPerHour.acceptable;
  
  const roomBasedCapacity = examRooms.length * patientsPerRoomPerDay;
  const providerBasedCapacity = doctors * throughputPerHour * operatingHours;
  
  let capacity = Math.min(roomBasedCapacity, providerBasedCapacity);
  
  if (capacity === 0 && examRooms.length > 0) {
    capacity = examRooms.length * Math.floor(patientsPerRoomPerDay * 0.6);
  }

  const avgEfficiency = staff.length > 0 
    ? staff.reduce((sum, s) => sum + s.efficiency, 0) / staff.length 
    : 50;
  const efficiencyMultiplier = 0.5 + (avgEfficiency / 100);
  capacity = Math.floor(capacity * efficiencyMultiplier);

  return Math.max(1, capacity);
}

function calculateWaitTime(
  patientCapacity: number, 
  patientVolume: number, 
  efficiencyScore: number,
  staff: Staff[]
): number {
  const excellentWaitTime = PATIENT_FLOW_METRICS.waitTime.excellent;
  const acceptableWaitTime = PATIENT_FLOW_METRICS.waitTime.acceptable;
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
    const avgEfficiency = staff.reduce((sum, s) => sum + s.efficiency, 0) / staff.length;
    const staffFactor = 1 + ((100 - avgEfficiency) / 100) * 0.3;
    waitTime *= staffFactor;

    const avgStress = staff.reduce((sum, s) => sum + s.stress, 0) / staff.length;
    const stressFactor = 1 + (avgStress / 100) * 0.2;
    waitTime *= stressFactor;
  }

  return Math.max(5, Math.min(60, Math.round(waitTime)));
}

export function runSimulation(
  rooms: Room[],
  staff: Staff[],
  parameters: SimulationParameters
): SimulationResult {
  const efficiencyScore = calculateEfficiencyScore(rooms);
  const harmonyScore = calculateHarmonyScore(staff, rooms);
  const patientCapacity = calculatePatientCapacity(rooms, staff, parameters.operatingHours);
  const waitTime = calculateWaitTime(
    patientCapacity,
    parameters.patientVolume,
    efficiencyScore,
    staff
  );

  return {
    efficiencyScore: Math.round(efficiencyScore * 10) / 10,
    harmonyScore: Math.round(harmonyScore * 10) / 10,
    waitTime,
    patientCapacity,
    parameters,
  };
}
