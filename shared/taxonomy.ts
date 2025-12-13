export const ARTIFACT_TYPES = [
  "rule",
  "benchmark",
  "formula",
  "template",
  "checklist",
  "playbook"
] as const;

export type ArtifactType = typeof ARTIFACT_TYPES[number];

export const MODULES = [
  "dashboard",
  "layout",
  "staffing",
  "scheduling",
  "hygiene",
  "billing",
  "marketing",
  "qm"
] as const;

export type Module = typeof MODULES[number];

export interface SourceCitation {
  docName: string;
  headingPath: string | null;
  chunkId: string;
}

export interface BenchmarkPayload {
  metric: string;
  unit: string;
  min?: number;
  max?: number;
  optimal?: number;
  description: string;
  source: string;
}

export interface RulePayload {
  condition: string;
  action: string;
  priority: "critical" | "high" | "medium" | "low";
  description: string;
}

export interface FormulaPayload {
  name: string;
  formula: string;
  variables: Record<string, string>;
  description: string;
}

export interface ChecklistPayload {
  name: string;
  items: string[];
  frequency?: string;
  description: string;
}

export interface TemplatePayload {
  name: string;
  template: string;
  variables: string[];
  description: string;
}

export interface PlaybookPayload {
  name: string;
  steps: Array<{
    order: number;
    action: string;
    details: string;
  }>;
  description: string;
}

export type ArtifactPayload = 
  | BenchmarkPayload 
  | RulePayload 
  | FormulaPayload 
  | ChecklistPayload 
  | TemplatePayload 
  | PlaybookPayload;

export const SAFE_DEFAULTS = {
  dashboard: {
    healthScoreWeights: {
      layout: 0.25,
      staffing: 0.25,
      scheduling: 0.25,
      qm: 0.25
    }
  },
  layout: {
    roomSizes: {
      reception: { min: 8, max: 14, optimal: 10 },
      waiting: { min: 15, max: 35, optimal: 22 },
      treatment: { min: 9, max: 12, optimal: 10 },
      exam: { min: 9, max: 12, optimal: 10 },
      lab: { min: 8, max: 15, optimal: 10 },
      office: { min: 10, max: 18, optimal: 14 },
      storage: { min: 4, max: 10, optimal: 6 }
    },
    distanceGuidelines: {
      receptionToWaiting: { maxMeters: 10, optimal: 5, source: "DIN 18040 Barrierefreies Bauen" },
      waitingToExam: { maxMeters: 25, optimal: 12, source: "Praxisbegehung Laufwege" },
      examToLab: { maxMeters: 15, optimal: 8, source: "RKI Probenhandhabung Richtlinien" },
      examToExam: { maxMeters: 10, optimal: 5, source: "Praxiseffizienz Standards" }
    },
    zoningRules: {
      onStage: {
        zones: ["reception", "waiting"],
        description: "Patientenkontaktbereich - gepflegt, einladend, ruhig"
      },
      offStage: {
        zones: ["lab", "storage", "office"],
        description: "Interne Arbeitsbereiche - effizient, funktional"
      },
      clinical: {
        zones: ["exam", "treatment"],
        description: "Klinische Bereiche - steril, professionell"
      }
    }
  },
  staffing: {
    ratios: {
      mfaPerDoctor: { min: 1.0, max: 2.0, optimal: 1.5 },
      supportPerPhysician: { min: 2.5, max: 4.0, optimal: 3.0 }
    }
  },
  scheduling: {
    serviceTimes: {
      checkup: { min: 15, max: 30, optimal: 20 },
      treatment: { min: 30, max: 60, optimal: 45 },
      cleaning: { min: 20, max: 40, optimal: 30 }
    },
    bufferMinutes: 5,
    maxWaitTime: 15
  }
};
