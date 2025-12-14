import type { InsertPractice, Practice, InsertRoom, Room, InsertStaff, Staff, InsertSimulation, Simulation, KnowledgeSource, KnowledgeChunk, Workflow, WorkflowConnection, WorkflowActorType, WorkflowStep } from "@shared/schema";

const API_BASE = "";

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API Error: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  practices: {
    get: (id: string) => fetchAPI<Practice & { rooms: Room[]; staff: Staff[] }>(`/api/practices/${id}`),
    create: (data: InsertPractice) => fetchAPI<Practice>("/api/practices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    updateBudget: (id: string, budget: number) => fetchAPI<Practice>(`/api/practices/${id}/budget`, {
      method: "PUT",
      body: JSON.stringify({ budget }),
    }),
  },
  
  rooms: {
    list: (practiceId: string) => fetchAPI<Room[]>(`/api/practices/${practiceId}/rooms`),
    create: (practiceId: string, data: InsertRoom) => fetchAPI<Room>(`/api/practices/${practiceId}/rooms`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    update: (id: string, data: Partial<InsertRoom>) => fetchAPI<Room>(`/api/rooms/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    delete: (id: string) => fetchAPI<void>(`/api/rooms/${id}`, {
      method: "DELETE",
    }),
  },

  staff: {
    list: (practiceId: string) => fetchAPI<Staff[]>(`/api/practices/${practiceId}/staff`),
    create: (practiceId: string, data: InsertStaff) => fetchAPI<Staff>(`/api/practices/${practiceId}/staff`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    update: (id: string, data: Partial<InsertStaff>) => fetchAPI<Staff>(`/api/staff/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    delete: (id: string) => fetchAPI<void>(`/api/staff/${id}`, {
      method: "DELETE",
    }),
  },

  simulations: {
    run: (data: { practiceId: string; patientVolume: number; operatingHours: number }) =>
      fetchAPI<{
        efficiencyScore: number;
        harmonyScore: number;
        waitTime: number;
        patientCapacity: number;
      }>("/api/simulations/run", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    save: (data: InsertSimulation) => fetchAPI<Simulation>("/api/simulations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    list: (practiceId: string) => fetchAPI<Simulation[]>(`/api/practices/${practiceId}/simulations`),
  },

  ai: {
    analyzeLayout: (data: { practiceId: string; operatingHours?: number }) =>
      fetchAPI<LayoutAnalysis>("/api/ai/analyze-layout", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getRecommendation: (data: { practiceId: string; question?: string }) =>
      fetchAPI<{ recommendation: string }>("/api/ai/recommend", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    analyzeWorkflows: (data: { practiceId: string; includeRAG?: boolean }) =>
      fetchAPI<WorkflowEfficiencyResult>("/api/ai/analyze-workflows", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  layout: {
    efficiency: (practiceId: string) =>
      fetchAPI<LayoutEfficiencyResult>("/api/layout/efficiency", {
        method: "POST",
        body: JSON.stringify({ practiceId }),
      }),
  },

  knowledge: {
    list: () => fetchAPI<KnowledgeSource[]>("/api/knowledge"),
    get: (id: string) => fetchAPI<{ source: KnowledgeSource; chunks: KnowledgeChunk[] }>(`/api/knowledge/${id}`),
    search: (query: string, limit?: number) => fetchAPI<Array<KnowledgeChunk & { source: KnowledgeSource; similarity: number }>>("/api/knowledge/search", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    }),
  },

  workflows: {
    list: (practiceId: string) => fetchAPI<Workflow[]>(`/api/practices/${practiceId}/workflows`),
    create: (practiceId: string, data: { name: string; actorType: WorkflowActorType }) =>
      fetchAPI<Workflow>(`/api/practices/${practiceId}/workflows`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) => fetchAPI<void>(`/api/workflows/${id}`, {
      method: "DELETE",
    }),
  },

  connections: {
    listByPractice: (practiceId: string) => fetchAPI<WorkflowConnection[]>(`/api/practices/${practiceId}/workflow-connections`),
    create: (practiceId: string, data: { fromRoomId: string; toRoomId: string; kind?: "patient" | "staff"; weight?: number; distanceClass?: "auto" | "short" | "medium" | "long" }) =>
      fetchAPI<WorkflowConnection>(`/api/practices/${practiceId}/workflow-connections`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<{ kind: "patient" | "staff"; weight: number; distanceClass: "auto" | "short" | "medium" | "long" }>) =>
      fetchAPI<WorkflowConnection>(`/api/workflow-connections/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) => fetchAPI<void>(`/api/workflow-connections/${id}`, {
      method: "DELETE",
    }),
  },

  workflowSteps: {
    list: (workflowId: string) => fetchAPI<WorkflowStep[]>(`/api/workflows/${workflowId}/steps`),
    create: (workflowId: string, data: { fromRoomId: string; toRoomId: string; weight?: number }) =>
      fetchAPI<WorkflowStep>(`/api/workflows/${workflowId}/steps`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) => fetchAPI<void>(`/api/workflow-steps/${id}`, {
      method: "DELETE",
    }),
  },
};

export interface WorkflowAnalysis {
  workflowCostTotal: number;
  workflowScore: number;
  topConnections: Array<{
    fromName: string;
    toName: string;
    distance: number;
    distanceClass: "short" | "medium" | "long";
    weight: number;
    cost: number;
  }>;
  recommendations: string[];
}

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
  workflowAnalysis?: WorkflowAnalysis;
}

export interface RoomAnalysis {
  roomId: string;
  roomName: string;
  roomType: string;
  sizeScore: number;
  sizeAssessment: "undersized" | "optimal" | "oversized";
  actualSqM: number;
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

export interface WorkflowMetrics {
  totalDistanceMeters: number;
  avgStepDistanceMeters: number;
  backtrackingCount: number;
  longestConnections: Array<{ fromName: string; toName: string; distanceMeters: number }>;
  motionWasteScore: number;
}

export interface LayoutEfficiencyResult {
  score: number;
  breakdown: {
    patientFlowMeters: number;
    staffMotionMeters: number;
    steriLoopMeters: number;
    labLoopMeters: number;
    crossFloorPenaltyMeters: number;
    privacyRisk: boolean;
  };
  issues: Array<{
    severity: "critical" | "high" | "medium" | "low";
    code: string;
    title: string;
    detail: string;
    current: number;
    target?: number;
    unit: string;
  }>;
  tips: string[];
  workflowMetrics?: WorkflowMetrics;
  workflowAnalysis?: WorkflowAnalysis;
}

export interface StepAnalysis {
  stepIndex: number;
  stepId: string;
  fromRoomId: string;
  toRoomId: string;
  fromRoomName: string;
  toRoomName: string;
  distanceM: number;
  distanceBand: "short" | "medium" | "long";
  isFloorChange: boolean;
  frictionScore: number;
}

export interface WorkflowAnalysisDetail {
  workflowId: string;
  workflowName: string;
  actorType: string;
  totalDistanceM: number;
  distanceBandCounts: {
    short: number;
    medium: number;
    long: number;
  };
  floorChangeCount: number;
  frictionIndex: number;
  score: number;
  top3ExpensiveSteps: StepAnalysis[];
  allSteps: StepAnalysis[];
}

export interface WorkflowRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  category: "backtracking" | "distance" | "floor" | "process" | "digital";
}

export interface WorkflowEfficiencyResult {
  practiceId: string;
  workflows: WorkflowAnalysisDetail[];
  overallScore: number;
  overallFrictionIndex: number;
  recommendations: WorkflowRecommendation[];
  knowledgeInsight?: {
    answer: string;
    sources: Array<{ docName: string; headingPath: string }>;
  };
}
