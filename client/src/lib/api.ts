import type { InsertPractice, Practice, InsertRoom, Room, InsertStaff, Staff, InsertSimulation, Simulation, KnowledgeSource, KnowledgeChunk } from "@shared/schema";

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
  },

  knowledge: {
    list: () => fetchAPI<KnowledgeSource[]>("/api/knowledge"),
    get: (id: string) => fetchAPI<{ source: KnowledgeSource; chunks: KnowledgeChunk[] }>(`/api/knowledge/${id}`),
    search: (query: string, limit?: number) => fetchAPI<Array<KnowledgeChunk & { source: KnowledgeSource; similarity: number }>>("/api/knowledge/search", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    }),
  },
};

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
