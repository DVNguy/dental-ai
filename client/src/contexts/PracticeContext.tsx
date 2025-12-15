import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, type AuthUser } from "@/lib/api";
import type { Practice, Room, Staff } from "@shared/schema";

interface PracticeContextType {
  practiceId: string | null;
  practice: (Practice & { rooms: Room[]; staff: Staff[] }) | undefined;
  isLoading: boolean;
  error: Error | null;
  user: AuthUser | null;
  isAuthChecking: boolean;
  logout: () => void;
}

const PracticeContext = createContext<PracticeContextType | undefined>(undefined);

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [, setLocation] = useLocation();
  const authCheckedRef = useRef(false);

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
    enabled: !!practiceId && !!user,
  });

  useEffect(() => {
    if (authCheckedRef.current) return;
    authCheckedRef.current = true;
    
    const checkAuth = async () => {
      try {
        const authUser = await api.auth.me();
        setUser(authUser);
        
        if (authUser.practiceId) {
          setPracticeId(authUser.practiceId);
          localStorage.setItem("practiceId", authUser.practiceId);
        }
        setIsAuthChecking(false);
      } catch {
        setLocation("/auth");
      }
    };

    checkAuth();
  }, []);

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
    } finally {
      setUser(null);
      setPracticeId(null);
      localStorage.removeItem("practiceId");
      setLocation("/auth");
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <PracticeContext.Provider value={{ practiceId, practice, isLoading, error: error as Error | null, user, isAuthChecking, logout }}>
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
