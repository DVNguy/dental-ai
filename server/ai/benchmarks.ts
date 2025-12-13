export interface RoomSizeStandard {
  minSqM: number;
  maxSqM: number;
  optimalSqM: number;
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
    minSqM: 8,
    maxSqM: 14,
    optimalSqM: 10,
    source: "Arbeitsstättenverordnung (ArbStättV) - ASR A1.2"
  },
  waiting: {
    minSqM: 15,
    maxSqM: 35,
    optimalSqM: 22,
    source: "Praxisbegehung - 1.2-1.5 m² pro Sitzplatz, 12-15 Patienten"
  },
  exam: {
    minSqM: 9,
    maxSqM: 12,
    optimalSqM: 10,
    source: "Praxisbegehung & Hygieneverordnung - Behandlungsraum Standards"
  },
  lab: {
    minSqM: 8,
    maxSqM: 15,
    optimalSqM: 10,
    source: "RKI Laborrichtlinien & Hygieneverordnung"
  },
  office: {
    minSqM: 10,
    maxSqM: 18,
    optimalSqM: 14,
    source: "Arbeitsstättenverordnung (ArbStättV) - ASR A1.2"
  }
};

export const STAFFING_RATIOS = {
  supportStaffPerDentist: {
    min: 1.5,
    max: 2.5,
    optimal: 2.0,
    source: "KZBV Praxis-Benchmarks"
  },
  supportStaffPerPhysician: {
    min: 2.5,
    max: 4.0,
    optimal: 3.0,
    source: "KV Praxisorganisation Empfehlungen"
  },
  nursePerDoctor: {
    min: 1.0,
    max: 2.0,
    optimal: 1.5,
    source: "Berufsverband der Medizinischen Fachangestellten"
  },
  receptionistPerProvider: {
    min: 0.33,
    max: 0.5,
    optimal: 0.4,
    source: "KV Empfehlung Praxisorganisation"
  },
  examRoomsPerProvider: {
    min: 2.0,
    max: 4.0,
    optimal: 3.0,
    source: "KV Praxisplanung - 3-4 Behandlungsräume pro Arzt optimal"
  }
};

export const PATIENT_FLOW_METRICS = {
  waitTime: {
    excellent: 10,
    acceptable: 20,
    poor: 30,
    unit: "Minuten",
    source: "Qualitätsmanagement-Richtlinie (QM-RL) - Gemeinsamer Bundesausschuss"
  },
  patientsPerExamRoomPerDay: {
    excellent: 12,
    acceptable: 10,
    poor: 6,
    unit: "Patienten/Raum/Tag",
    source: "KV Benchmarks Praxisauslastung"
  },
  patientThroughputPerHour: {
    excellent: 4,
    acceptable: 3,
    poor: 2,
    unit: "Patienten/Stunde",
    source: "Praxismanagement Leitfaden"
  },
  appointmentDuration: {
    excellent: 15,
    acceptable: 20,
    poor: 30,
    unit: "Minuten",
    source: "EBM Einheitlicher Bewertungsmaßstab Zeitvorgaben"
  }
};

export const LAYOUT_EFFICIENCY_PRINCIPLES = {
  optimalFlow: [
    "Empfangsbereich sollte beim Betreten sofort sichtbar sein",
    "Wartebereich sollte neben dem Empfang liegen (max. 15m Entfernung)",
    "Behandlungsräume sollten gruppiert und gleich weit vom Wartebereich entfernt sein",
    "Labor sollte zentral zwischen den Behandlungsräumen liegen für Effizienz",
    "Büro/Verwaltung sollte Sichtverbindung zum Empfang haben, aber nicht im Patientenfluss"
  ],
  distanceGuidelines: {
    receptionToWaiting: { maxMeters: 10, optimal: 5, source: "DIN 18040 Barrierefreies Bauen" },
    waitingToExam: { maxMeters: 25, optimal: 12, source: "Praxisbegehung Laufwege" },
    examToLab: { maxMeters: 15, optimal: 8, source: "RKI Probenhandhabung Richtlinien" },
    examToExam: { maxMeters: 10, optimal: 5, source: "Praxiseffizienz Standards" }
  },
  circulationPatterns: {
    patientPath: "Linear: Eingang → Empfang → Warten → Behandlung → Abrechnung",
    staffPath: "Zirkulär: Sollte Patientenwege nicht häufig kreuzen",
    emergencyEgress: "Mindestens 1,2m breite Flure (DIN 18040 Barrierefreiheit)"
  }
};

export const INDUSTRY_BENCHMARKS = {
  dentalPractice: {
    avgSquareMetersPerOperatory: 37,
    avgPatientsPerDayPerDentist: 12,
    avgRevenuePerPatient: 300,
    avgStaffCostPercentage: 25,
    patientRetentionRate: 85,
    source: "KZBV Jahrbuch 2024"
  },
  medicalPractice: {
    avgSquareMetersPerExamRoom: 28,
    avgPatientsPerDayPerPhysician: 25,
    avgRevenuePerPatient: 45,
    avgStaffCostPercentage: 28,
    patientRetentionRate: 80,
    source: "Zi-Praxis-Panel 2024 (Zentralinstitut für die kassenärztliche Versorgung)"
  }
};

import { pxAreaToSqM, pxToMeters, metersToPx, normalizeRoomType, DEFAULT_LAYOUT_SCALE_PX_PER_METER } from "@shared/roomTypes";

export function pixelsToSqM(widthPx: number, heightPx: number, scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER): number {
  return pxAreaToSqM(widthPx, heightPx, scalePxPerMeter);
}

export function sqMToPixels(sqM: number, scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER): number {
  const sideM = Math.sqrt(sqM);
  const sidePx = metersToPx(sideM, scalePxPerMeter);
  return Math.round(sidePx * sidePx);
}

export function evaluateRoomSize(
  type: string, 
  widthPx: number, 
  heightPx: number,
  scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER
): {
  score: number;
  assessment: "undersized" | "optimal" | "oversized";
  actualSqM: number;
  recommendation: string;
} {
  const normalizedType = normalizeRoomType(type);
  const standard = ROOM_SIZE_STANDARDS[normalizedType];
  if (!standard) {
    return {
      score: 50,
      assessment: "optimal",
      actualSqM: 0,
      recommendation: "Unbekannter Raumtyp"
    };
  }

  const actualSqM = pxAreaToSqM(widthPx, heightPx, scalePxPerMeter);

  let score: number;
  let assessment: "undersized" | "optimal" | "oversized";
  let recommendation: string;

  if (actualSqM < standard.minSqM) {
    const deficit = ((standard.minSqM - actualSqM) / standard.minSqM) * 100;
    score = Math.max(0, 50 - deficit);
    assessment = "undersized";
    recommendation = `Raum ist ${Math.round(deficit)}% unter dem Minimum. Empfehlung: mindestens ${standard.minSqM} m² gemäß ${standard.source}.`;
  } else if (actualSqM > standard.maxSqM) {
    const excess = ((actualSqM - standard.maxSqM) / standard.maxSqM) * 100;
    score = Math.max(60, 90 - (excess * 0.5));
    assessment = "oversized";
    recommendation = `Raum ist ${Math.round(excess)}% über dem Maximum. Raumnutzung optimieren.`;
  } else {
    const distanceFromOptimal = Math.abs(actualSqM - standard.optimalSqM);
    const range = standard.maxSqM - standard.minSqM;
    score = 100 - ((distanceFromOptimal / range) * 20);
    assessment = "optimal";
    recommendation = `Raumgröße entspricht den deutschen Standards. Optimale Größe: ${standard.optimalSqM} m².`;
  }

  return { score: Math.round(score), assessment, actualSqM, recommendation };
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
      recommendation = `Unterbesetzt: ${supportRatio.toFixed(1)} Mitarbeiter pro Arzt. Empfehlung: ${benchmark.optimal} pro Arzt.`;
    } else if (supportRatio > benchmark.max) {
      score = Math.max(60, 90 - ((supportRatio - benchmark.max) / benchmark.max * 30));
      recommendation = `Überbesetzt: ${supportRatio.toFixed(1)} Mitarbeiter pro Arzt. Optimierung auf ${benchmark.optimal} empfohlen.`;
    } else {
      score = 85 + ((1 - Math.abs(supportRatio - benchmark.optimal) / (benchmark.max - benchmark.min)) * 15);
      recommendation = `Gutes Personalverhältnis von ${supportRatio.toFixed(1)} Mitarbeitern pro Arzt.`;
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
      recommendation = `Niedriges MFA-Verhältnis: ${nurseRatio.toFixed(1)}. Empfehlung: ${benchmark.optimal} MFA pro Arzt.`;
    } else if (nurseRatio > benchmark.max) {
      score = Math.max(70, 95 - ((nurseRatio - benchmark.max) / benchmark.max * 25));
      recommendation = `Hohes MFA-Verhältnis: ${nurseRatio.toFixed(1)}. Möglicherweise über dem Optimum von ${benchmark.optimal}.`;
    } else {
      score = 90 + ((1 - Math.abs(nurseRatio - benchmark.optimal) / (benchmark.max - benchmark.min)) * 10);
      recommendation = `Ausgezeichnetes MFA-zu-Arzt-Verhältnis von ${nurseRatio.toFixed(1)}.`;
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
      recommendation = `Zu wenig Behandlungsräume (${roomRatio.toFixed(1)} pro Arzt). Empfehlung: ${benchmark.optimal} für optimalen Patientenfluss.`;
    } else if (roomRatio > benchmark.max) {
      score = Math.max(65, 90 - ((roomRatio - benchmark.max) / benchmark.max * 25));
      recommendation = `Überschuss an Behandlungsräumen (${roomRatio.toFixed(1)} pro Arzt). ${benchmark.optimal} wäre effizienter.`;
    } else {
      score = 88 + ((1 - Math.abs(roomRatio - benchmark.optimal) / (benchmark.max - benchmark.min)) * 12);
      recommendation = `Gutes Verhältnis von ${roomRatio.toFixed(1)} Behandlungsräumen pro Arzt.`;
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
      benchmarkComparison: "Keine Behandlungsräume - Behandlungsräume hinzufügen um Kapazität zu berechnen"
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
    benchmarkComparison = "Ausgezeichnete Kapazitätsauslastung - Top 10% der Praxen";
  } else if (estimatedCapacity >= excellentCapacity * 0.7) {
    benchmarkComparison = "Gute Kapazität - über dem Branchendurchschnitt";
  } else {
    benchmarkComparison = "Unterdurchschnittliche Kapazität - Verbesserungspotenzial vorhanden";
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
    recommendations.push("KRITISCH: Empfangsbereich hinzufügen. Unerlässlich für Patientenanmeldung und ersten Eindruck.");
  }
  
  if (!hasWaiting) {
    recommendations.push("KRITISCH: Wartebereich hinzufügen. Patienten benötigen einen komfortablen Raum während der Wartezeit.");
  }
  
  if (examRoomCount === 0) {
    recommendations.push("KRITISCH: Behandlungsräume hinzufügen. Diese sind der Kern Ihrer Praxistätigkeit.");
  } else if (examRoomCount === 1) {
    recommendations.push("Erwägen Sie weitere Behandlungsräume. Standard ist 3-4 pro Arzt für optimale Effizienz (KV-Empfehlung).");
  }
  
  if (!hasLab && examRoomCount > 0) {
    recommendations.push("Erwägen Sie einen Laborbereich. Ein Labor neben den Behandlungsräumen reduziert Wartezeiten um 15-20%.");
  }
  
  if (!hasOffice) {
    recommendations.push("Erwägen Sie ein Büro für Beratungsgespräche und Verwaltungsarbeit.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Ihr Layout enthält alle wesentlichen Raumtypen. Fokussieren Sie auf Optimierung der Raumplatzierung und -größen.");
  }

  return recommendations;
}
