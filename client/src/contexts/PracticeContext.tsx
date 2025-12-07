import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Practice, Room, Staff } from "@shared/schema";

interface PracticeContextType {
  practiceId: string | null;
  practice: (Practice & { rooms: Room[]; staff: Staff[] }) | undefined;
  isLoading: boolean;
  error: Error | null;
}

const PracticeContext = createContext<PracticeContextType | undefined>(undefined);

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createDefaultPractice = useMutation({
    mutationFn: () => api.practices.create({
      name: "My Medical Practice",
      budget: 50000,
    }),
    onSuccess: (practice) => {
      setPracticeId(practice.id);
      localStorage.setItem("practiceId", practice.id);
    },
  });

  const { data: practice, isLoading, error } = useQuery({
    queryKey: ["practice", practiceId],
    queryFn: () => api.practices.get(practiceId!),
    enabled: !!practiceId,
  });

  useEffect(() => {
    const storedId = localStorage.getItem("practiceId");
    if (storedId) {
      setPracticeId(storedId);
    } else {
      createDefaultPractice.mutate();
    }
  }, []);

  return (
    <PracticeContext.Provider value={{ practiceId, practice, isLoading, error: error as Error | null }}>
      {children}
    </PracticeContext.Provider>
  );
}

export function usePractice() {
  const context = useContext(PracticeContext);
  if (!context) {
    throw new Error("usePractice must be used within PracticeProvider");
  }
  return context;
}
