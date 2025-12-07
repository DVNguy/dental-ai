import type { Room, Staff } from "@shared/schema";

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
    const distance = calculateDistance(recCenter.x, recCenter.y, waitCenter.x, waitCenter.y);
    
    if (distance < 200) score += 10;
    else if (distance < 300) score += 5;
  }

  if (waiting && examRooms.length > 0) {
    const waitCenter = getRoomCenter(waiting);
    const avgDistance = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistance(waitCenter.x, waitCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;

    if (avgDistance < 250) score += 15;
    else if (avgDistance < 400) score += 8;
  }

  examRooms.forEach(exam => {
    const area = exam.width * exam.height;
    if (area >= 14000) score += 3;
    else if (area >= 10000) score += 2;
  });

  if (lab && examRooms.length > 0) {
    const labCenter = getRoomCenter(lab);
    const avgDistance = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistance(labCenter.x, labCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;

    if (avgDistance < 300) score += 8;
    else if (avgDistance < 500) score += 4;
  }

  if (office && reception) {
    const officeCenter = getRoomCenter(office);
    const recCenter = getRoomCenter(reception);
    const distance = calculateDistance(officeCenter.x, officeCenter.y, recCenter.x, recCenter.y);
    
    if (distance < 250) score += 5;
  }

  if (!reception) score -= 15;
  if (!waiting) score -= 10;
  if (examRooms.length === 0) score -= 20;

  return Math.max(0, Math.min(100, score));
}

function calculateHarmonyScore(staff: Staff[], rooms: Room[]): number {
  if (staff.length === 0) return 50;

  let score = 50;

  const avgEfficiency = staff.reduce((sum, s) => sum + s.efficiency, 0) / staff.length;
  score += (avgEfficiency - 50) * 0.3;

  const avgStress = staff.reduce((sum, s) => sum + s.stress, 0) / staff.length;
  score -= (avgStress - 50) * 0.4;

  const examRooms = rooms.filter(r => r.type === "exam").length;
  const doctors = staff.filter(s => s.role === "doctor" || s.role === "dentist").length;
  
  if (doctors > 0 && examRooms > 0) {
    const ratio = examRooms / doctors;
    if (ratio >= 1.5 && ratio <= 3) score += 10;
    else if (ratio >= 1 && ratio <= 4) score += 5;
    else score -= 5;
  }

  const nurses = staff.filter(s => s.role === "nurse").length;
  if (doctors > 0 && nurses > 0) {
    const nurseRatio = nurses / doctors;
    if (nurseRatio >= 0.5 && nurseRatio <= 2) score += 8;
  }

  const hasReceptionist = staff.some(s => s.role === "receptionist");
  if (hasReceptionist) score += 5;

  const highStressCount = staff.filter(s => s.stress > 70).length;
  if (highStressCount > staff.length * 0.3) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function calculatePatientCapacity(rooms: Room[], staff: Staff[]): number {
  const examRooms = rooms.filter(r => r.type === "exam");
  const waitingRooms = rooms.filter(r => r.type === "waiting");
  
  let capacity = 0;

  examRooms.forEach(room => {
    const area = room.width * room.height;
    capacity += Math.floor(area / 12000);
  });

  waitingRooms.forEach(room => {
    const area = room.width * room.height;
    capacity += Math.floor(area / 5000) * 2;
  });

  const doctors = staff.filter(s => s.role === "doctor" || s.role === "dentist").length;
  const staffMultiplier = Math.min(1 + (doctors * 0.2), 2);
  
  capacity = Math.floor(capacity * staffMultiplier);

  return Math.max(1, capacity);
}

function calculateWaitTime(
  patientCapacity: number, 
  patientVolume: number, 
  efficiencyScore: number,
  staff: Staff[]
): number {
  const baseWaitTime = 15;
  
  const volumeRatio = patientVolume / Math.max(1, patientCapacity);
  let waitTime = baseWaitTime * volumeRatio;

  const efficiencyFactor = (100 - efficiencyScore) / 100;
  waitTime *= (1 + efficiencyFactor);

  const avgEfficiency = staff.length > 0 
    ? staff.reduce((sum, s) => sum + s.efficiency, 0) / staff.length 
    : 50;
  const staffFactor = (100 - avgEfficiency) / 100;
  waitTime *= (1 + staffFactor * 0.5);

  const avgStress = staff.length > 0
    ? staff.reduce((sum, s) => sum + s.stress, 0) / staff.length
    : 50;
  const stressFactor = avgStress / 100;
  waitTime *= (1 + stressFactor * 0.3);

  return Math.max(1, Math.round(waitTime));
}

export function runSimulation(
  rooms: Room[],
  staff: Staff[],
  parameters: SimulationParameters
): SimulationResult {
  const efficiencyScore = calculateEfficiencyScore(rooms);
  const harmonyScore = calculateHarmonyScore(staff, rooms);
  const patientCapacity = calculatePatientCapacity(rooms, staff);
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
