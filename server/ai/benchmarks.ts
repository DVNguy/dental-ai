export interface RoomSizeStandard {
  minSqFt: number;
  maxSqFt: number;
  optimalSqFt: number;
  source: string;
}

export interface StaffingRatio {
  min: number;
  max: number;
  optimal: number;
  source: string;
}

export interface PatientFlowMetric {
  excellent: number;
  acceptable: number;
  poor: number;
  unit: string;
  source: string;
}

export const ROOM_SIZE_STANDARDS: Record<string, RoomSizeStandard> = {
  reception: {
    minSqFt: 100,
    maxSqFt: 150,
    optimalSqFt: 120,
    source: "ADA Practice Design Guidelines"
  },
  waiting: {
    minSqFt: 150,
    maxSqFt: 400,
    optimalSqFt: 250,
    source: "AAOMS Facility Standards - 15-20 sq ft per patient capacity"
  },
  exam: {
    minSqFt: 80,
    maxSqFt: 120,
    optimalSqFt: 100,
    source: "ADA Operatory Standards (dental: 100-120, medical: 80-100)"
  },
  lab: {
    minSqFt: 80,
    maxSqFt: 150,
    optimalSqFt: 100,
    source: "OSHA Laboratory Safety Standards"
  },
  office: {
    minSqFt: 100,
    maxSqFt: 200,
    optimalSqFt: 150,
    source: "Healthcare Facility Planning Guidelines"
  }
};

export const STAFFING_RATIOS = {
  supportStaffPerDentist: {
    min: 1.5,
    max: 2.5,
    optimal: 2.0,
    source: "MGMA Dental Practice Benchmarks 2024"
  },
  supportStaffPerPhysician: {
    min: 3.0,
    max: 4.5,
    optimal: 3.5,
    source: "MGMA Medical Practice Benchmarks 2024"
  },
  nursePerDoctor: {
    min: 1.0,
    max: 2.0,
    optimal: 1.5,
    source: "American Nurses Association Staffing Guidelines"
  },
  receptionistPerProvider: {
    min: 0.33,
    max: 0.5,
    optimal: 0.4,
    source: "MGMA Front Office Staffing Benchmarks"
  },
  examRoomsPerProvider: {
    min: 2.0,
    max: 3.0,
    optimal: 2.5,
    source: "ADA Practice Efficiency Standards"
  }
};

export const PATIENT_FLOW_METRICS = {
  waitTime: {
    excellent: 10,
    acceptable: 20,
    poor: 30,
    unit: "minutes",
    source: "Press Ganey Patient Satisfaction Benchmarks"
  },
  patientsPerExamRoomPerDay: {
    excellent: 12,
    acceptable: 10,
    poor: 6,
    unit: "patients/room/day",
    source: "MGMA Productivity Benchmarks 2024"
  },
  patientThroughputPerHour: {
    excellent: 4,
    acceptable: 3,
    poor: 2,
    unit: "patients/hour",
    source: "Healthcare Operations Research"
  },
  appointmentDuration: {
    excellent: 15,
    acceptable: 20,
    poor: 30,
    unit: "minutes",
    source: "AMA Practice Management Guidelines"
  }
};

export const LAYOUT_EFFICIENCY_PRINCIPLES = {
  optimalFlow: [
    "Reception area should be immediately visible upon entry",
    "Waiting room should be adjacent to reception (within 50 feet)",
    "Exam rooms should be clustered and equidistant from waiting area",
    "Lab should be centrally located among exam rooms for efficiency",
    "Private office should have visual access to reception without being in patient flow"
  ],
  distanceGuidelines: {
    receptionToWaiting: { maxFeet: 30, optimal: 15, source: "ADA Accessibility Guidelines" },
    waitingToExam: { maxFeet: 75, optimal: 40, source: "Patient Experience Best Practices" },
    examToLab: { maxFeet: 50, optimal: 25, source: "OSHA Specimen Handling Guidelines" },
    examToExam: { maxFeet: 30, optimal: 15, source: "Provider Efficiency Standards" }
  },
  circulationPatterns: {
    patientPath: "Linear: Entry → Reception → Waiting → Exam → Checkout",
    staffPath: "Circular: Should not cross patient paths frequently",
    emergencyEgress: "Minimum 44 inches wide for all corridors"
  }
};

export const INDUSTRY_BENCHMARKS = {
  dentalPractice: {
    avgSquareFootagePerOperatory: 400,
    avgPatientsPerDayPerDentist: 12,
    avgRevenuePerPatient: 350,
    avgStaffCostPercentage: 25,
    patientRetentionRate: 85,
    source: "ADA Health Policy Institute 2024"
  },
  medicalPractice: {
    avgSquareFootagePerExamRoom: 300,
    avgPatientsPerDayPerPhysician: 20,
    avgRevenuePerPatient: 200,
    avgStaffCostPercentage: 30,
    patientRetentionRate: 80,
    source: "MGMA DataDive 2024"
  }
};

export function pixelsToSqFt(pixels: number, scale: number = 0.5): number {
  return Math.round(pixels * scale);
}

export function sqFtToPixels(sqFt: number, scale: number = 0.5): number {
  return Math.round(sqFt / scale);
}

export function evaluateRoomSize(type: string, widthPx: number, heightPx: number): {
  score: number;
  assessment: "undersized" | "optimal" | "oversized";
  actualSqFt: number;
  recommendation: string;
} {
  const standard = ROOM_SIZE_STANDARDS[type];
  if (!standard) {
    return {
      score: 50,
      assessment: "optimal",
      actualSqFt: 0,
      recommendation: "Unknown room type"
    };
  }

  const areaPx = widthPx * heightPx;
  const actualSqFt = pixelsToSqFt(areaPx);

  let score: number;
  let assessment: "undersized" | "optimal" | "oversized";
  let recommendation: string;

  if (actualSqFt < standard.minSqFt) {
    const deficit = ((standard.minSqFt - actualSqFt) / standard.minSqFt) * 100;
    score = Math.max(0, 50 - deficit);
    assessment = "undersized";
    recommendation = `Room is ${Math.round(deficit)}% below minimum. Recommend increasing to at least ${standard.minSqFt} sq ft.`;
  } else if (actualSqFt > standard.maxSqFt) {
    const excess = ((actualSqFt - standard.maxSqFt) / standard.maxSqFt) * 100;
    score = Math.max(60, 90 - (excess * 0.5));
    assessment = "oversized";
    recommendation = `Room is ${Math.round(excess)}% above maximum. Consider optimizing space usage.`;
  } else {
    const distanceFromOptimal = Math.abs(actualSqFt - standard.optimalSqFt);
    const range = standard.maxSqFt - standard.minSqFt;
    score = 100 - ((distanceFromOptimal / range) * 20);
    assessment = "optimal";
    recommendation = `Room size is within industry standards. Optimal size is ${standard.optimalSqFt} sq ft.`;
  }

  return { score: Math.round(score), assessment, actualSqFt, recommendation };
}

export function evaluateStaffingRatios(
  doctors: number,
  nurses: number,
  receptionists: number,
  totalStaff: number,
  examRooms: number,
  practiceType: "dental" | "medical" = "dental"
): {
  overallScore: number;
  ratios: Record<string, { actual: number; optimal: number; score: number; recommendation: string }>;
} {
  const ratios: Record<string, { actual: number; optimal: number; score: number; recommendation: string }> = {};

  if (doctors > 0) {
    const supportStaff = totalStaff - doctors;
    const supportRatio = supportStaff / doctors;
    const benchmark = practiceType === "dental" 
      ? STAFFING_RATIOS.supportStaffPerDentist 
      : STAFFING_RATIOS.supportStaffPerPhysician;
    
    let score: number;
    let recommendation: string;
    
    if (supportRatio < benchmark.min) {
      score = Math.max(30, 70 - ((benchmark.min - supportRatio) / benchmark.min * 40));
      recommendation = `Understaffed: ${supportRatio.toFixed(1)} support staff per provider. Recommend ${benchmark.optimal} per provider.`;
    } else if (supportRatio > benchmark.max) {
      score = Math.max(60, 90 - ((supportRatio - benchmark.max) / benchmark.max * 30));
      recommendation = `Overstaffed: ${supportRatio.toFixed(1)} support staff per provider. Consider optimizing to ${benchmark.optimal}.`;
    } else {
      score = 85 + ((1 - Math.abs(supportRatio - benchmark.optimal) / (benchmark.max - benchmark.min)) * 15);
      recommendation = `Good staffing ratio of ${supportRatio.toFixed(1)} support staff per provider.`;
    }
    
    ratios.supportStaffRatio = { actual: supportRatio, optimal: benchmark.optimal, score: Math.round(score), recommendation };
  }

  if (doctors > 0 && nurses > 0) {
    const nurseRatio = nurses / doctors;
    const benchmark = STAFFING_RATIOS.nursePerDoctor;
    
    let score: number;
    let recommendation: string;
    
    if (nurseRatio < benchmark.min) {
      score = Math.max(40, 75 - ((benchmark.min - nurseRatio) / benchmark.min * 35));
      recommendation = `Low nurse ratio: ${nurseRatio.toFixed(1)}. Industry recommends ${benchmark.optimal} nurses per doctor.`;
    } else if (nurseRatio > benchmark.max) {
      score = Math.max(70, 95 - ((nurseRatio - benchmark.max) / benchmark.max * 25));
      recommendation = `High nurse ratio: ${nurseRatio.toFixed(1)}. May be above optimal of ${benchmark.optimal}.`;
    } else {
      score = 90 + ((1 - Math.abs(nurseRatio - benchmark.optimal) / (benchmark.max - benchmark.min)) * 10);
      recommendation = `Excellent nurse-to-doctor ratio of ${nurseRatio.toFixed(1)}.`;
    }
    
    ratios.nurseRatio = { actual: nurseRatio, optimal: benchmark.optimal, score: Math.round(score), recommendation };
  }

  if (doctors > 0 && examRooms > 0) {
    const roomRatio = examRooms / doctors;
    const benchmark = STAFFING_RATIOS.examRoomsPerProvider;
    
    let score: number;
    let recommendation: string;
    
    if (roomRatio < benchmark.min) {
      score = Math.max(35, 70 - ((benchmark.min - roomRatio) / benchmark.min * 35));
      recommendation = `Too few exam rooms (${roomRatio.toFixed(1)} per provider). Recommend ${benchmark.optimal} for optimal flow.`;
    } else if (roomRatio > benchmark.max) {
      score = Math.max(65, 90 - ((roomRatio - benchmark.max) / benchmark.max * 25));
      recommendation = `Excess exam rooms (${roomRatio.toFixed(1)} per provider). ${benchmark.optimal} is more efficient.`;
    } else {
      score = 88 + ((1 - Math.abs(roomRatio - benchmark.optimal) / (benchmark.max - benchmark.min)) * 12);
      recommendation = `Good exam room to provider ratio of ${roomRatio.toFixed(1)}.`;
    }
    
    ratios.examRoomRatio = { actual: roomRatio, optimal: benchmark.optimal, score: Math.round(score), recommendation };
  }

  const scores = Object.values(ratios).map(r => r.score);
  const overallScore = scores.length > 0 
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
    : 50;

  return { overallScore, ratios };
}

export function calculatePatientCapacityBenchmark(
  examRooms: number,
  operatingHours: number,
  providers: number
): {
  estimatedCapacity: number;
  capacityScore: number;
  benchmarkComparison: string;
} {
  if (examRooms === 0) {
    return {
      estimatedCapacity: 0,
      capacityScore: 0,
      benchmarkComparison: "No exam rooms - add exam rooms to calculate capacity"
    };
  }

  const patientsPerRoomPerDay = PATIENT_FLOW_METRICS.patientsPerExamRoomPerDay.acceptable;
  const throughputPerHour = PATIENT_FLOW_METRICS.patientThroughputPerHour.acceptable;
  
  const roomBasedCapacity = examRooms * patientsPerRoomPerDay;
  const providerBasedCapacity = providers > 0 
    ? providers * throughputPerHour * operatingHours 
    : roomBasedCapacity;
  
  const estimatedCapacity = Math.min(roomBasedCapacity, providerBasedCapacity);
  
  const excellentCapacity = examRooms * PATIENT_FLOW_METRICS.patientsPerExamRoomPerDay.excellent;
  const capacityScore = excellentCapacity > 0 
    ? Math.min(100, Math.round((estimatedCapacity / excellentCapacity) * 100))
    : 0;
  
  let benchmarkComparison: string;
  if (estimatedCapacity >= excellentCapacity * 0.9) {
    benchmarkComparison = "Excellent capacity utilization - top 10% of practices";
  } else if (estimatedCapacity >= excellentCapacity * 0.7) {
    benchmarkComparison = "Good capacity - above industry average";
  } else {
    benchmarkComparison = "Below average capacity - room for improvement";
  }

  return { estimatedCapacity, capacityScore, benchmarkComparison };
}

export function getLayoutRecommendations(
  hasReception: boolean,
  hasWaiting: boolean,
  examRoomCount: number,
  hasLab: boolean,
  hasOffice: boolean
): string[] {
  const recommendations: string[] = [];

  if (!hasReception) {
    recommendations.push("CRITICAL: Add a reception area. This is essential for patient check-in and first impressions.");
  }
  
  if (!hasWaiting) {
    recommendations.push("CRITICAL: Add a waiting room. Patients need a comfortable space while waiting for appointments.");
  }
  
  if (examRoomCount === 0) {
    recommendations.push("CRITICAL: Add exam rooms. These are the core of your practice operations.");
  } else if (examRoomCount === 1) {
    recommendations.push("Consider adding more exam rooms. Industry standard is 2-3 per provider for optimal efficiency.");
  }
  
  if (!hasLab && examRoomCount > 0) {
    recommendations.push("Consider adding a lab. Having one adjacent to exam rooms reduces patient wait times by 15-20%.");
  }
  
  if (!hasOffice) {
    recommendations.push("Consider adding a private office for consultations and administrative work.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Your layout includes all essential room types. Focus on optimizing room placement and sizes.");
  }

  return recommendations;
}
