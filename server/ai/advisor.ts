import OpenAI from "openai";
import type { Room, Staff } from "@shared/schema";
import {
  ROOM_SIZE_STANDARDS,
  STAFFING_RATIOS,
  PATIENT_FLOW_METRICS,
  LAYOUT_EFFICIENCY_PRINCIPLES,
  INDUSTRY_BENCHMARKS,
  evaluateRoomSize,
  evaluateStaffingRatios,
  calculatePatientCapacityBenchmark,
  getLayoutRecommendations,
  pixelsToSqFt
} from "./benchmarks";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface LayoutAnalysis {
  overallScore: number;
  efficiencyScore: number;
  staffingScore: number;
  spaceUtilizationScore: number;
  roomAnalyses: RoomAnalysis[];
  staffingAnalysis: StaffingAnalysis;
  capacityAnalysis: CapacityAnalysis;
  recommendations: string[];
  aiInsights: string;
}

export interface RoomAnalysis {
  roomId: string;
  roomName: string;
  roomType: string;
  sizeScore: number;
  sizeAssessment: "undersized" | "optimal" | "oversized";
  actualSqFt: number;
  recommendation: string;
}

export interface StaffingAnalysis {
  overallScore: number;
  ratios: Record<string, {
    actual: number;
    optimal: number;
    score: number;
    recommendation: string;
  }>;
}

export interface CapacityAnalysis {
  estimatedCapacity: number;
  capacityScore: number;
  benchmarkComparison: string;
}

function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function getRoomCenter(room: Room): { x: number; y: number } {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2
  };
}

function calculateLayoutEfficiencyScore(rooms: Room[]): number {
  if (rooms.length === 0) return 0;

  const roomsByType = new Map<string, Room[]>();
  rooms.forEach(room => {
    if (!roomsByType.has(room.type)) {
      roomsByType.set(room.type, []);
    }
    roomsByType.get(room.type)!.push(room);
  });

  let score = 50;
  let factors = 0;

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
      score += 15;
    } else if (distanceFt <= benchmark.maxFeet) {
      score += 10;
    } else {
      score -= 5;
    }
    factors++;
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
    factors++;
  }

  if (lab && examRooms.length > 0) {
    const labCenter = getRoomCenter(lab);
    const avgDistance = examRooms.reduce((sum, exam) => {
      const examCenter = getRoomCenter(exam);
      return sum + calculateDistance(labCenter.x, labCenter.y, examCenter.x, examCenter.y);
    }, 0) / examRooms.length;
    
    const distanceFt = avgDistance * 0.5;
    const benchmark = LAYOUT_EFFICIENCY_PRINCIPLES.distanceGuidelines.examToLab;
    
    if (distanceFt <= benchmark.optimal) {
      score += 12;
    } else if (distanceFt <= benchmark.maxFeet) {
      score += 6;
    } else {
      score -= 3;
    }
    factors++;
  }

  if (!reception) score -= 15;
  if (!waiting) score -= 10;
  if (examRooms.length === 0) score -= 20;

  return Math.max(0, Math.min(100, score));
}

function analyzeRooms(rooms: Room[]): RoomAnalysis[] {
  return rooms.map(room => {
    const evaluation = evaluateRoomSize(room.type, room.width, room.height);
    return {
      roomId: room.id,
      roomName: room.name || room.type,
      roomType: room.type,
      sizeScore: evaluation.score,
      sizeAssessment: evaluation.assessment,
      actualSqFt: evaluation.actualSqFt,
      recommendation: evaluation.recommendation
    };
  });
}

function analyzeStaffing(staff: Staff[], rooms: Room[]): StaffingAnalysis {
  const doctors = staff.filter(s => s.role === "doctor" || s.role === "dentist").length;
  const nurses = staff.filter(s => s.role === "nurse").length;
  const receptionists = staff.filter(s => s.role === "receptionist").length;
  const examRooms = rooms.filter(r => r.type === "exam").length;

  return evaluateStaffingRatios(doctors, nurses, receptionists, staff.length, examRooms);
}

function analyzeCapacity(rooms: Room[], staff: Staff[], operatingHours: number = 8): CapacityAnalysis {
  const examRooms = rooms.filter(r => r.type === "exam").length;
  const providers = staff.filter(s => s.role === "doctor" || s.role === "dentist").length;
  
  return calculatePatientCapacityBenchmark(examRooms, operatingHours, providers);
}

async function generateAIInsights(
  rooms: Room[],
  staff: Staff[],
  efficiencyScore: number,
  staffingScore: number,
  recommendations: string[]
): Promise<string> {
  const roomsByType = new Map<string, number>();
  rooms.forEach(room => {
    roomsByType.set(room.type, (roomsByType.get(room.type) || 0) + 1);
  });

  const staffByRole = new Map<string, number>();
  staff.forEach(s => {
    staffByRole.set(s.role, (staffByRole.get(s.role) || 0) + 1);
  });

  const roomsSummary = Array.from(roomsByType.entries())
    .map(([type, count]) => `${count} ${type}(s)`)
    .join(", ");
  
  const staffSummary = Array.from(staffByRole.entries())
    .map(([role, count]) => `${count} ${role}(s)`)
    .join(", ");

  const prompt = `You are an expert medical/dental practice consultant. Analyze this practice layout and provide actionable insights.

PRACTICE DATA:
- Rooms: ${roomsSummary || "No rooms yet"}
- Staff: ${staffSummary || "No staff yet"}
- Layout Efficiency Score: ${efficiencyScore}/100
- Staffing Score: ${staffingScore}/100

INDUSTRY BENCHMARKS USED:
- Room sizes: ADA/AAOMS standards (exam rooms: 80-120 sq ft, reception: 100-150 sq ft)
- Staffing: MGMA benchmarks (1.5-2.5 support staff per dentist, 2-3 exam rooms per provider)
- Patient flow: Press Ganey standards (<15 min wait time excellent)
- Layout: Linear patient flow (Reception → Waiting → Exam → Checkout)

CURRENT RECOMMENDATIONS:
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Provide a brief, personalized 2-3 sentence analysis focusing on:
1. The most impactful improvement they can make
2. How their current setup compares to top-performing practices
3. One specific, actionable tip

Keep the response under 100 words, professional but friendly.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 300
    });

    return response.choices[0]?.message?.content || "Unable to generate AI insights at this time.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "AI analysis is temporarily unavailable. Please refer to the benchmark-based recommendations above.";
  }
}

export async function analyzeLayout(
  rooms: Room[],
  staff: Staff[],
  operatingHours: number = 8
): Promise<LayoutAnalysis> {
  const efficiencyScore = calculateLayoutEfficiencyScore(rooms);
  
  const roomAnalyses = analyzeRooms(rooms);
  const avgRoomScore = roomAnalyses.length > 0
    ? roomAnalyses.reduce((sum, r) => sum + r.sizeScore, 0) / roomAnalyses.length
    : 50;

  const staffingAnalysis = analyzeStaffing(staff, rooms);
  
  const capacityAnalysis = analyzeCapacity(rooms, staff, operatingHours);

  const hasReception = rooms.some(r => r.type === "reception");
  const hasWaiting = rooms.some(r => r.type === "waiting");
  const examRoomCount = rooms.filter(r => r.type === "exam").length;
  const hasLab = rooms.some(r => r.type === "lab");
  const hasOffice = rooms.some(r => r.type === "office");

  const recommendations = getLayoutRecommendations(
    hasReception,
    hasWaiting,
    examRoomCount,
    hasLab,
    hasOffice
  );

  roomAnalyses.forEach(analysis => {
    if (analysis.sizeAssessment !== "optimal") {
      recommendations.push(`${analysis.roomName}: ${analysis.recommendation}`);
    }
  });

  Object.entries(staffingAnalysis.ratios).forEach(([key, ratio]) => {
    if (ratio.score < 80) {
      recommendations.push(ratio.recommendation);
    }
  });

  const safeEfficiency = isNaN(efficiencyScore) ? 0 : efficiencyScore;
  const safeRoomScore = isNaN(avgRoomScore) ? 50 : avgRoomScore;
  const safeStaffingScore = isNaN(staffingAnalysis.overallScore) ? 50 : staffingAnalysis.overallScore;
  const safeCapacityScore = isNaN(capacityAnalysis.capacityScore) || capacityAnalysis.capacityScore === null 
    ? 0 : capacityAnalysis.capacityScore;
  
  const overallScore = Math.round(
    (safeEfficiency * 0.35) +
    (safeRoomScore * 0.25) +
    (safeStaffingScore * 0.25) +
    (safeCapacityScore * 0.15)
  );

  const aiInsights = await generateAIInsights(
    rooms,
    staff,
    efficiencyScore,
    staffingAnalysis.overallScore,
    recommendations.slice(0, 5)
  );

  return {
    overallScore,
    efficiencyScore: Math.round(efficiencyScore),
    staffingScore: staffingAnalysis.overallScore,
    spaceUtilizationScore: Math.round(avgRoomScore),
    roomAnalyses,
    staffingAnalysis,
    capacityAnalysis,
    recommendations: recommendations.slice(0, 10),
    aiInsights
  };
}

export async function getQuickRecommendation(
  rooms: Room[],
  staff: Staff[],
  question?: string
): Promise<string> {
  const roomsByType = new Map<string, number>();
  rooms.forEach(room => {
    roomsByType.set(room.type, (roomsByType.get(room.type) || 0) + 1);
  });

  const staffByRole = new Map<string, number>();
  staff.forEach(s => {
    staffByRole.set(s.role, (staffByRole.get(s.role) || 0) + 1);
  });

  const roomsSummary = Array.from(roomsByType.entries())
    .map(([type, count]) => `${count} ${type}(s)`)
    .join(", ");
  
  const staffSummary = Array.from(staffByRole.entries())
    .map(([role, count]) => `${count} ${role}(s)`)
    .join(", ");

  const totalArea = rooms.reduce((sum, room) => sum + pixelsToSqFt(room.width * room.height), 0);

  const prompt = `You are an expert medical/dental practice consultant. Answer concisely based on real industry data.

PRACTICE SETUP:
- Rooms: ${roomsSummary || "None"} (Total area: ~${totalArea} sq ft)
- Staff: ${staffSummary || "None"}

INDUSTRY STANDARDS (source: MGMA, ADA, AAOMS):
- Exam rooms: 80-120 sq ft each, 2-3 per provider
- Support staff: 1.5-2.5 per dentist, 3-4 per physician
- Wait time target: <15 min (excellent), <30 min (acceptable)
- Patient capacity: 8-12 per exam room per day

${question ? `USER QUESTION: ${question}` : "Provide one key recommendation for improving this practice."}

Keep response under 75 words, specific and actionable.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 200
    });

    return response.choices[0]?.message?.content || "Unable to provide recommendation at this time.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "AI recommendations are temporarily unavailable. Please check your layout against industry standards.";
  }
}
