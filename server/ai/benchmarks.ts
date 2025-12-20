export const DENTAL_BENCHMARKS = {
  financial: {
    min_revenue_per_hour: 300.00,
    target_overhead_ratio: 0.60,
    collection_ratio: 0.98,
    skonto_max: 0.03,
    break_even_crowns_cadcam: 30,
    marketing_budget_percent: 0.05,
    min_case_acceptance: 0.75
  },
  tax_rates: {
    heilbehandlung: 0.00,
    zahntechnik_eigen: 0.07,
    kosmetik_shop: 0.19,
    bagatellgrenze_geschenke: 5.00,
    geschenke_steuerfrei_p_a: 50.00
  },
  standard_times_min: {
    exam_new_patient: 60,
    prophylaxis_pzr: 50,
    prep_crown: 75,
    endo_root_canal: 105,
    extraction_simple: 25,
    implant_placement: 90,
    scan_intraoral: 5
  },
  operational_limits: {
    max_waiting_time: 15,
    inventory_turnover: 5,
    no_show_rate_max: 0.05,
    hygiene_rebooking: 0.90,
    oee_target: 0.85
  },
  structural: {
    room_size_treatment_sqm: 12.0,
    room_size_prophy_sqm: 10.0,
    staff_ratio_zfa_per_dentist: 1.5,
    chairs_per_dentist: 2,
    steri_capacity_per_hour: 6
  }
};

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
  },
  sterilization: {
    minSqM: 8,
    maxSqM: 14,
    optimalSqM: 10.5,
    source: "RKI Aufbereitung Medizinprodukte & Hygieneverordnung"
  },
  storage: {
    minSqM: 4,
    maxSqM: 10,
    optimalSqM: 6,
    source: "Arbeitsstättenverordnung (ArbStättV) - Lagerräume"
  },
  toilet: {
    minSqM: 3,
    maxSqM: 6,
    optimalSqM: 4.4,
    source: "DIN 18040 Barrierefreies Bauen - Sanitärräume"
  },
  kitchen: {
    minSqM: 6,
    maxSqM: 12,
    optimalSqM: 7.5,
    source: "Arbeitsstättenverordnung (ArbStättV) - ASR A4.2 Pausenräume"
  },
  changing: {
    minSqM: 5,
    maxSqM: 10,
    optimalSqM: 6.6,
    source: "Arbeitsstättenverordnung (ArbStättV) - ASR A4.1 Umkleideräume"
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

export function evaluateRoomSizeM(
  type: string, 
  widthM: number, 
  heightM: number
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

  const actualSqM = widthM * heightM;

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

/**
 * Input parameters for staffing ratio evaluation.
 */
export interface StaffingRatioInput {
  // Headcount
  providersCount: number;
  clinicalAssistantsCount: number;  // MFA/ZFA
  frontdeskCount: number;           // Receptionists
  supportTotalCount: number;        // clinicalAssistants + frontdesk
  // FTE (optional - if not provided, headcount ratios are used)
  providersFte?: number;
  clinicalAssistantsFte?: number;
  frontdeskFte?: number;
  supportTotalFte?: number;
  // Other
  totalStaff: number;
  examRooms: number;
  practiceType?: "dental" | "medical";
}

/**
 * Evaluates staffing ratios against industry benchmarks.
 *
 * New ratio structure (v2):
 * - clinicalAssistantRatio: MFA/ZFA per provider (headcount)
 * - frontdeskRatio: Receptionists per provider (headcount)
 * - supportTotalRatio: All support (clinical + frontdesk) per provider (headcount)
 * - clinicalAssistantFteRatio: MFA/ZFA FTE per provider FTE (if FTE data available)
 * - frontdeskFteRatio: Frontdesk FTE per provider FTE (if FTE data available)
 * - supportTotalFteRatio: All support FTE per provider FTE (if FTE data available)
 * - examRoomRatio: Treatment rooms per provider
 *
 * Backward compatibility aliases (deprecated):
 * - nurseRatio → alias for clinicalAssistantRatio
 * - supportStaffRatio → alias for supportTotalRatio
 *
 * @param input - Staffing counts and FTE values
 */
export function evaluateStaffingRatios(
  input: StaffingRatioInput
): {
  overallScore: number;
  ratios: Record<string, { actual: number; optimal: number; score: number; recommendation: string }>;
} {
  const {
    providersCount,
    clinicalAssistantsCount,
    frontdeskCount,
    supportTotalCount,
    providersFte,
    clinicalAssistantsFte,
    frontdeskFte,
    supportTotalFte,
    examRooms,
    practiceType = "dental"
  } = input;

  const ratios: Record<string, { actual: number; optimal: number; score: number; recommendation: string }> = {};

  // Keys used for overallScore calculation (to prevent unintended score changes)
  // Only these keys contribute to the overall score
  const scoreKeys = ["clinicalAssistantRatio", "supportTotalRatio", "examRoomRatio"];

  const noProviderMessage = "Kein Behandler vorhanden. Fügen Sie Zahnärzte/Ärzte hinzu.";

  // --- Clinical Assistant Ratio (MFA/ZFA per provider) ---
  if (providersCount > 0) {
    const clinicalRatio = clinicalAssistantsCount / providersCount;
    const benchmark = STAFFING_RATIOS.nursePerDoctor;

    let score: number;
    let recommendation: string;

    if (clinicalAssistantsCount === 0) {
      score = 30;
      recommendation = "Keine MFA/ZFA vorhanden. Fügen Sie Assistenzpersonal hinzu.";
    } else if (clinicalRatio < benchmark.min) {
      score = Math.max(40, 75 - ((benchmark.min - clinicalRatio) / benchmark.min * 35));
      recommendation = `Niedriges MFA/ZFA-Verhältnis: ${clinicalRatio.toFixed(1)}. Empfehlung: ${benchmark.optimal} pro Behandler.`;
    } else if (clinicalRatio > benchmark.max) {
      score = Math.max(70, 95 - ((clinicalRatio - benchmark.max) / benchmark.max * 25));
      recommendation = `Hohes MFA/ZFA-Verhältnis: ${clinicalRatio.toFixed(1)}. Möglicherweise über dem Optimum von ${benchmark.optimal}.`;
    } else {
      score = 90 + ((1 - Math.abs(clinicalRatio - benchmark.optimal) / (benchmark.max - benchmark.min)) * 10);
      recommendation = `Ausgezeichnetes MFA/ZFA-zu-Behandler-Verhältnis von ${clinicalRatio.toFixed(1)}.`;
    }

    ratios.clinicalAssistantRatio = { actual: clinicalRatio, optimal: benchmark.optimal, score: Math.round(score), recommendation };
  } else {
    ratios.clinicalAssistantRatio = {
      actual: 0,
      optimal: STAFFING_RATIOS.nursePerDoctor.optimal,
      score: 0,
      recommendation: noProviderMessage
    };
  }

  // --- Frontdesk Ratio (Receptionists per provider) ---
  if (providersCount > 0) {
    const fdRatio = frontdeskCount / providersCount;
    const benchmark = STAFFING_RATIOS.receptionistPerProvider;

    let score: number;
    let recommendation: string;

    if (frontdeskCount === 0) {
      score = 40;
      recommendation = "Kein Empfangspersonal vorhanden. Empfehlung: mindestens 1 Empfangskraft.";
    } else if (fdRatio < benchmark.min) {
      score = Math.max(50, 80 - ((benchmark.min - fdRatio) / benchmark.min * 30));
      recommendation = `Wenig Empfangspersonal: ${fdRatio.toFixed(2)} pro Behandler. Empfehlung: ${benchmark.optimal}.`;
    } else if (fdRatio > benchmark.max) {
      score = Math.max(70, 95 - ((fdRatio - benchmark.max) / benchmark.max * 25));
      recommendation = `Hohe Empfangsbesetzung: ${fdRatio.toFixed(2)} pro Behandler. Optimum wäre ${benchmark.optimal}.`;
    } else {
      score = 90 + ((1 - Math.abs(fdRatio - benchmark.optimal) / (benchmark.max - benchmark.min)) * 10);
      recommendation = `Gutes Empfangsverhältnis von ${fdRatio.toFixed(2)} pro Behandler.`;
    }

    ratios.frontdeskRatio = { actual: fdRatio, optimal: benchmark.optimal, score: Math.round(score), recommendation };
  } else {
    ratios.frontdeskRatio = {
      actual: 0,
      optimal: STAFFING_RATIOS.receptionistPerProvider.optimal,
      score: 0,
      recommendation: noProviderMessage
    };
  }

  // --- Support Total Ratio (all support staff per provider) ---
  if (providersCount > 0) {
    const supportRatio = supportTotalCount / providersCount;
    const benchmark = practiceType === "dental"
      ? STAFFING_RATIOS.supportStaffPerDentist
      : STAFFING_RATIOS.supportStaffPerPhysician;

    let score: number;
    let recommendation: string;

    if (supportRatio < benchmark.min) {
      score = Math.max(30, 70 - ((benchmark.min - supportRatio) / benchmark.min * 40));
      recommendation = `Unterbesetzt: ${supportRatio.toFixed(1)} Mitarbeiter pro Behandler. Empfehlung: ${benchmark.optimal}.`;
    } else if (supportRatio > benchmark.max) {
      score = Math.max(60, 90 - ((supportRatio - benchmark.max) / benchmark.max * 30));
      recommendation = `Überbesetzt: ${supportRatio.toFixed(1)} Mitarbeiter pro Behandler. Optimierung auf ${benchmark.optimal} empfohlen.`;
    } else {
      score = 85 + ((1 - Math.abs(supportRatio - benchmark.optimal) / (benchmark.max - benchmark.min)) * 15);
      recommendation = `Gutes Personalverhältnis von ${supportRatio.toFixed(1)} Mitarbeitern pro Behandler.`;
    }

    ratios.supportTotalRatio = { actual: supportRatio, optimal: benchmark.optimal, score: Math.round(score), recommendation };
  } else {
    ratios.supportTotalRatio = {
      actual: 0,
      optimal: STAFFING_RATIOS.supportStaffPerDentist.optimal,
      score: 0,
      recommendation: noProviderMessage
    };
  }

  // --- FTE Ratios (only if FTE data is available and providersFte > 0) ---
  if (providersFte !== undefined && providersFte > 0) {
    // Clinical Assistant FTE Ratio
    if (clinicalAssistantsFte !== undefined) {
      const clinicalFteRatio = clinicalAssistantsFte / providersFte;
      const benchmark = STAFFING_RATIOS.nursePerDoctor;
      ratios.clinicalAssistantFteRatio = {
        actual: clinicalFteRatio,
        optimal: benchmark.optimal,
        score: ratios.clinicalAssistantRatio.score, // Use same score logic
        recommendation: `MFA/ZFA-FTE-Verhältnis: ${clinicalFteRatio.toFixed(2)} pro Behandler-VZÄ.`
      };
    }

    // Frontdesk FTE Ratio
    if (frontdeskFte !== undefined) {
      const fdFteRatio = frontdeskFte / providersFte;
      const benchmark = STAFFING_RATIOS.receptionistPerProvider;
      ratios.frontdeskFteRatio = {
        actual: fdFteRatio,
        optimal: benchmark.optimal,
        score: ratios.frontdeskRatio.score, // Use same score logic
        recommendation: `Empfangs-FTE-Verhältnis: ${fdFteRatio.toFixed(2)} pro Behandler-VZÄ.`
      };
    }

    // Support Total FTE Ratio
    if (supportTotalFte !== undefined) {
      const supportFteRatio = supportTotalFte / providersFte;
      const benchmark = practiceType === "dental"
        ? STAFFING_RATIOS.supportStaffPerDentist
        : STAFFING_RATIOS.supportStaffPerPhysician;
      ratios.supportTotalFteRatio = {
        actual: supportFteRatio,
        optimal: benchmark.optimal,
        score: ratios.supportTotalRatio.score, // Use same score logic
        recommendation: `Support-FTE-Verhältnis: ${supportFteRatio.toFixed(2)} pro Behandler-VZÄ.`
      };
    }
  }

  // --- Exam Room Ratio ---
  if (providersCount > 0 && examRooms > 0) {
    const roomRatio = examRooms / providersCount;
    const benchmark = STAFFING_RATIOS.examRoomsPerProvider;

    let score: number;
    let recommendation: string;

    if (roomRatio < benchmark.min) {
      score = Math.max(35, 70 - ((benchmark.min - roomRatio) / benchmark.min * 35));
      recommendation = `Zu wenig Behandlungsräume (${roomRatio.toFixed(1)} pro Behandler). Empfehlung: ${benchmark.optimal} für optimalen Patientenfluss.`;
    } else if (roomRatio > benchmark.max) {
      score = Math.max(65, 90 - ((roomRatio - benchmark.max) / benchmark.max * 25));
      recommendation = `Überschuss an Behandlungsräumen (${roomRatio.toFixed(1)} pro Behandler). ${benchmark.optimal} wäre effizienter.`;
    } else {
      score = 88 + ((1 - Math.abs(roomRatio - benchmark.optimal) / (benchmark.max - benchmark.min)) * 12);
      recommendation = `Gutes Verhältnis von ${roomRatio.toFixed(1)} Behandlungsräumen pro Behandler.`;
    }

    ratios.examRoomRatio = { actual: roomRatio, optimal: benchmark.optimal, score: Math.round(score), recommendation };
  } else if (providersCount > 0 && examRooms === 0) {
    ratios.examRoomRatio = {
      actual: 0,
      optimal: STAFFING_RATIOS.examRoomsPerProvider.optimal,
      score: 0,
      recommendation: "Keine Behandlungsräume vorhanden. Fügen Sie Behandlungsräume hinzu."
    };
  } else {
    ratios.examRoomRatio = {
      actual: 0,
      optimal: STAFFING_RATIOS.examRoomsPerProvider.optimal,
      score: 0,
      recommendation: noProviderMessage
    };
  }

  // --- Backward Compatibility Aliases (DEPRECATED) ---
  // These are kept for API compatibility but should not be used in new code
  ratios.nurseRatio = ratios.clinicalAssistantRatio;      // @deprecated - use clinicalAssistantRatio
  ratios.supportStaffRatio = ratios.supportTotalRatio;    // @deprecated - use supportTotalRatio

  // --- Calculate Overall Score ---
  // Only use scoreKeys to prevent unintended score changes from new ratios
  const scores = scoreKeys
    .filter(key => ratios[key] !== undefined)
    .map(key => ratios[key].score);

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
