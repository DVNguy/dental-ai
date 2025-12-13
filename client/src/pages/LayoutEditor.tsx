import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Undo, Info, Trash2, RotateCw, X, Settings2, Pencil, Building2, ShieldAlert, Gauge, Lightbulb, ArrowRight, Link2, Footprints } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { usePractice } from "@/contexts/PracticeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Room, Workflow, WorkflowConnection } from "@shared/schema";
import type { LayoutEfficiencyResult } from "@/lib/api";
import { PX_PER_METER, pxToM, mToPx, GRID_M, snapToGridM, clampM, normalizeToMeters, sqM } from "@shared/units";

function computeBezierPath(fromRoom: Room, toRoom: Room): { path: string; startX: number; startY: number; endX: number; endY: number } {
  const fromCenterX = mToPx(fromRoom.x + fromRoom.width / 2);
  const fromCenterY = mToPx(fromRoom.y + fromRoom.height / 2);
  const toCenterX = mToPx(toRoom.x + toRoom.width / 2);
  const toCenterY = mToPx(toRoom.y + toRoom.height / 2);
  
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;
  
  let startX: number, startY: number, endX: number, endY: number;
  let c1x: number, c1y: number, c2x: number, c2y: number;
  
  if (Math.abs(dx) >= Math.abs(dy)) {
    startX = mToPx(fromRoom.x + (dx > 0 ? fromRoom.width : 0));
    startY = mToPx(fromRoom.y + fromRoom.height / 2);
    endX = mToPx(toRoom.x + (dx > 0 ? 0 : toRoom.width));
    endY = mToPx(toRoom.y + toRoom.height / 2);
    c1x = startX + (endX - startX) * 0.5;
    c1y = startY;
    c2x = endX - (endX - startX) * 0.5;
    c2y = endY;
  } else {
    startX = mToPx(fromRoom.x + fromRoom.width / 2);
    startY = mToPx(fromRoom.y + (dy > 0 ? fromRoom.height : 0));
    endX = mToPx(toRoom.x + toRoom.width / 2);
    endY = mToPx(toRoom.y + (dy > 0 ? 0 : toRoom.height));
    c1x = startX;
    c1y = startY + (endY - startY) * 0.5;
    c2x = endX;
    c2y = endY - (endY - startY) * 0.5;
  }
  
  const path = `M ${startX} ${startY} C ${c1x} ${c1y} ${c2x} ${c2y} ${endX} ${endY}`;
  return { path, startX, startY, endX, endY };
}

function computePreviewPath(fromRoom: Room, mouseX: number, mouseY: number): string {
  const fromCenterX = mToPx(fromRoom.x + fromRoom.width / 2);
  const fromCenterY = mToPx(fromRoom.y + fromRoom.height / 2);
  
  const dx = mouseX - fromCenterX;
  const dy = mouseY - fromCenterY;
  
  let startX: number, startY: number;
  let c1x: number, c1y: number, c2x: number, c2y: number;
  
  if (Math.abs(dx) >= Math.abs(dy)) {
    startX = mToPx(fromRoom.x + (dx > 0 ? fromRoom.width : 0));
    startY = mToPx(fromRoom.y + fromRoom.height / 2);
    c1x = startX + dx * 0.5;
    c1y = startY;
    c2x = mouseX - dx * 0.5;
    c2y = mouseY;
  } else {
    startX = mToPx(fromRoom.x + fromRoom.width / 2);
    startY = mToPx(fromRoom.y + (dy > 0 ? fromRoom.height : 0));
    c1x = startX;
    c1y = startY + dy * 0.5;
    c2x = mouseX;
    c2y = mouseY - dy * 0.5;
  }
  
  return `M ${startX} ${startY} C ${c1x} ${c1y} ${c2x} ${c2y} ${mouseX} ${mouseY}`;
}

export default function LayoutEditor() {
  const { t } = useTranslation();
  const { practiceId } = usePractice();
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [currentFloor, setCurrentFloor] = useState<number>(0);
  
  const [roomNameDraft, setRoomNameDraft] = useState("");
  const [widthDraft, setWidthDraft] = useState<number>(2);
  const [heightDraft, setHeightDraft] = useState<number>(2);
  
  const [connectMode, setConnectMode] = useState(false);
  const [pendingFromRoomId, setPendingFromRoomId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoverRoomId, setHoverRoomId] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const aiInvalidateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nameDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const widthDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heightDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRoomIdRef = useRef<string | null>(null);
  
  const ROOM_TYPES = [
    { id: "reception", label: t("rooms.reception"), color: "bg-blue-100 border-blue-300", w: 3, h: 2 },
    { id: "waiting", label: t("rooms.waiting"), color: "bg-green-100 border-green-300", w: 4, h: 3 },
    { id: "exam", label: t("rooms.exam"), color: "bg-white border-gray-300", w: 2.4, h: 2.4 },
    { id: "lab", label: t("rooms.lab"), color: "bg-purple-100 border-purple-300", w: 2, h: 2 },
    { id: "office", label: t("rooms.office"), color: "bg-orange-100 border-orange-300", w: 2.4, h: 2.4 },
    { id: "sterilization", label: t("rooms.sterilization"), color: "bg-sky-100 border-sky-300", w: 3.5, h: 3 },
    { id: "storage", label: t("rooms.storage"), color: "bg-amber-100 border-amber-300", w: 3, h: 2 },
    { id: "toilet", label: t("rooms.toilet"), color: "bg-cyan-100 border-cyan-300", w: 2.2, h: 2 },
    { id: "kitchen", label: t("rooms.kitchen"), color: "bg-lime-100 border-lime-300", w: 3, h: 2.5 },
    { id: "changing", label: t("rooms.changing"), color: "bg-rose-100 border-rose-300", w: 3, h: 2.2 },
  ];

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", practiceId],
    queryFn: () => api.rooms.list(practiceId!),
    enabled: !!practiceId,
    select: (data) => data.map((room) => ({
      ...room,
      x: normalizeToMeters(room.x),
      y: normalizeToMeters(room.y),
      width: normalizeToMeters(room.width),
      height: normalizeToMeters(room.height),
    })),
  });

  const { data: efficiencyData } = useQuery<LayoutEfficiencyResult>({
    queryKey: ["layout-efficiency", practiceId],
    queryFn: () => api.layout.efficiency(practiceId!),
    enabled: !!practiceId && rooms.length > 0,
    staleTime: 2000,
    refetchOnWindowFocus: false,
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ["workflows", practiceId],
    queryFn: () => api.workflows.list(practiceId!),
    enabled: !!practiceId,
  });

  const activeWorkflow = workflows[0];

  const { data: connections = [] } = useQuery({
    queryKey: ["connections", activeWorkflow?.id],
    queryFn: () => api.connections.list(activeWorkflow!.id),
    enabled: !!activeWorkflow,
  });

  const createWorkflowMutation = useMutation({
    mutationFn: (data: { name: string; actorType: "patient" | "staff" | "instruments" }) =>
      api.workflows.create(practiceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", practiceId] });
    },
  });

  const createConnectionMutation = useMutation({
    mutationFn: (data: { fromRoomId: string; toRoomId: string }) =>
      api.connections.create(activeWorkflow!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", activeWorkflow?.id] });
      queryClient.invalidateQueries({ queryKey: ["layout-efficiency", practiceId] });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: (id: string) => api.connections.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", activeWorkflow?.id] });
      queryClient.invalidateQueries({ queryKey: ["layout-efficiency", practiceId] });
    },
  });

  useEffect(() => {
    if (practiceId && workflows.length === 0 && !createWorkflowMutation.isPending) {
      createWorkflowMutation.mutate({ name: "Neupatient (Patient Flow)", actorType: "patient" });
    }
  }, [practiceId, workflows.length]);

  const getCanvasBoundsM = useCallback(() => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      return { width: pxToM(rect.width), height: pxToM(rect.height) };
    }
    return { width: pxToM(1200), height: pxToM(800) };
  }, []);

  const scheduleAIInvalidation = useCallback(() => {
    clearTimeout(aiInvalidateTimer.current);
    aiInvalidateTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["ai-analysis", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["layout-efficiency", practiceId] });
    }, 2000);
  }, [queryClient, practiceId]);

  const createRoomMutation = useMutation({
    mutationFn: (data: { type: string; name: string; x: number; y: number; width: number; height: number; floor: number }) =>
      api.rooms.create(practiceId!, { 
        ...data, 
        practiceId: practiceId!,
        x: Math.round(mToPx(data.x)),
        y: Math.round(mToPx(data.y)),
        width: Math.round(mToPx(data.width)),
        height: Math.round(mToPx(data.height)),
      }),
    onSuccess: (newRoom) => {
      queryClient.invalidateQueries({ queryKey: ["rooms", practiceId] });
      scheduleAIInvalidation();
      setSelectedRoomId(newRoom.id);
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Room> }) => {
      const apiUpdates: Partial<Room> = { ...updates };
      if (apiUpdates.x !== undefined) apiUpdates.x = Math.round(mToPx(apiUpdates.x));
      if (apiUpdates.y !== undefined) apiUpdates.y = Math.round(mToPx(apiUpdates.y));
      if (apiUpdates.width !== undefined) apiUpdates.width = Math.round(mToPx(apiUpdates.width));
      if (apiUpdates.height !== undefined) apiUpdates.height = Math.round(mToPx(apiUpdates.height));
      return api.rooms.update(id, apiUpdates);
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["rooms", practiceId] });
      const previous = queryClient.getQueryData<Room[]>(["rooms", practiceId]);
      queryClient.setQueryData<Room[]>(["rooms", practiceId], (old) =>
        old?.map((r) => (r.id === id ? { ...r, ...updates } : r)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["rooms", practiceId], context.previous);
      }
    },
    onSuccess: (serverRoom) => {
      queryClient.setQueryData<Room[]>(["rooms", practiceId], (old) =>
        old?.map((r) => (r.id === serverRoom.id ? serverRoom : r)) ?? []
      );
      scheduleAIInvalidation();
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (id: string) => api.rooms.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["rooms", practiceId] });
      const previous = queryClient.getQueryData<Room[]>(["rooms", practiceId]);
      queryClient.setQueryData<Room[]>(["rooms", practiceId], (old) =>
        old?.filter((r) => r.id !== id) ?? []
      );
      if (selectedRoomId === id) {
        setSelectedRoomId(null);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["rooms", practiceId], context.previous);
      }
    },
    onSuccess: () => {
      scheduleAIInvalidation();
    },
  });

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedRoomType = selectedRoom ? ROOM_TYPES.find(t => t.id === selectedRoom.type) : null;

  useEffect(() => {
    clearTimeout(nameDebounceTimer.current);
    clearTimeout(widthDebounceTimer.current);
    clearTimeout(heightDebounceTimer.current);
    
    if (selectedRoom) {
      setRoomNameDraft(selectedRoom.name);
      setWidthDraft(selectedRoom.width);
      setHeightDraft(selectedRoom.height);
      pendingRoomIdRef.current = selectedRoom.id;
    }
  }, [selectedRoom?.id]);

  useEffect(() => {
    if (selectedRoom) {
      if (roomNameDraft !== selectedRoom.name && pendingRoomIdRef.current === selectedRoom.id) {
        setRoomNameDraft(selectedRoom.name);
      }
      if (widthDraft !== selectedRoom.width && pendingRoomIdRef.current === selectedRoom.id) {
        setWidthDraft(selectedRoom.width);
      }
      if (heightDraft !== selectedRoom.height && pendingRoomIdRef.current === selectedRoom.id) {
        setHeightDraft(selectedRoom.height);
      }
    }
  }, [selectedRoom?.name, selectedRoom?.width, selectedRoom?.height]);

  useEffect(() => {
    return () => {
      clearTimeout(aiInvalidateTimer.current);
      clearTimeout(nameDebounceTimer.current);
      clearTimeout(widthDebounceTimer.current);
      clearTimeout(heightDebounceTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && connectMode) {
        if (pendingFromRoomId) {
          setPendingFromRoomId(null);
          setMousePos(null);
          setHoverRoomId(null);
        } else {
          setConnectMode(false);
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [connectMode, pendingFromRoomId]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!connectMode || !pendingFromRoomId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [connectMode, pendingFromRoomId]);

  const handleNameChange = (value: string) => {
    const targetRoomId = selectedRoomId;
    if (!targetRoomId) return;
    
    setRoomNameDraft(value);
    clearTimeout(nameDebounceTimer.current);
    nameDebounceTimer.current = setTimeout(() => {
      const room = rooms.find(r => r.id === targetRoomId);
      if (room && value !== room.name) {
        updateRoomMutation.mutate({ id: targetRoomId, updates: { name: value } });
      }
    }, 500);
  };

  const handleNameBlur = () => {
    clearTimeout(nameDebounceTimer.current);
    if (selectedRoom && roomNameDraft !== selectedRoom.name) {
      updateRoomMutation.mutate({ id: selectedRoom.id, updates: { name: roomNameDraft } });
    }
  };

  const handleWidthChange = (valM: number) => {
    const targetRoomId = selectedRoomId;
    if (!targetRoomId) return;
    
    setWidthDraft(valM);
    clearTimeout(widthDebounceTimer.current);
    widthDebounceTimer.current = setTimeout(() => {
      const room = rooms.find(r => r.id === targetRoomId);
      if (room) {
        const bounds = getCanvasBoundsM();
        const clampedX = clampM(room.x, 0, bounds.width - valM);
        const updates: Partial<Room> = { width: valM };
        if (clampedX !== room.x) {
          updates.x = clampedX;
        }
        updateRoomMutation.mutate({ id: targetRoomId, updates });
      }
    }, 300);
  };

  const handleHeightChange = (valM: number) => {
    const targetRoomId = selectedRoomId;
    if (!targetRoomId) return;
    
    setHeightDraft(valM);
    clearTimeout(heightDebounceTimer.current);
    heightDebounceTimer.current = setTimeout(() => {
      const room = rooms.find(r => r.id === targetRoomId);
      if (room) {
        const bounds = getCanvasBoundsM();
        const clampedY = clampM(room.y, 0, bounds.height - valM);
        const updates: Partial<Room> = { height: valM };
        if (clampedY !== room.y) {
          updates.y = clampedY;
        }
        updateRoomMutation.mutate({ id: targetRoomId, updates });
      }
    }, 300);
  };

  const addRoom = (typeId: string) => {
    const typeDef = ROOM_TYPES.find(t => t.id === typeId);
    if (!typeDef) return;

    createRoomMutation.mutate({ 
      type: typeId,
      name: "", 
      x: 2,
      y: 2,
      width: typeDef.w,
      height: typeDef.h,
      floor: currentFloor
    });
  };

  const updateRoom = (id: string, updates: Partial<Room>) => {
    updateRoomMutation.mutate({ id, updates });
  };

  const handleRotate = () => {
    if (!selectedRoom) return;
    const bounds = getCanvasBoundsM();
    const newWidth = selectedRoom.height;
    const newHeight = selectedRoom.width;
    const clampedX = clampM(selectedRoom.x, 0, bounds.width - newWidth);
    const clampedY = clampM(selectedRoom.y, 0, bounds.height - newHeight);
    updateRoom(selectedRoom.id, { 
      width: newWidth, 
      height: newHeight,
      x: clampedX,
      y: clampedY
    });
  };

  const deleteRoom = (id: string) => {
    deleteRoomMutation.mutate(id);
  };

  const clearAllRooms = () => {
    rooms.forEach(room => {
      deleteRoomMutation.mutate(room.id);
    });
  };

  const handleDragEnd = (room: Room, info: { offset: { x: number; y: number } }, shiftPressed: boolean) => {
    const bounds = getCanvasBoundsM();
    let newX = room.x + pxToM(info.offset.x);
    let newY = room.y + pxToM(info.offset.y);
    
    if (!shiftPressed) {
      newX = snapToGridM(newX);
      newY = snapToGridM(newY);
    }
    
    newX = clampM(newX, 0, bounds.width - room.width);
    newY = clampM(newY, 0, bounds.height - room.height);
    
    updateRoom(room.id, { x: newX, y: newY });
  };

  const handleRoomClickInConnectMode = (roomId: string) => {
    if (!connectMode || !activeWorkflow) return;
    
    if (!pendingFromRoomId) {
      setPendingFromRoomId(roomId);
    } else if (pendingFromRoomId !== roomId) {
      createConnectionMutation.mutate({ fromRoomId: pendingFromRoomId, toRoomId: roomId });
      setPendingFromRoomId(null);
    }
  };

  const toggleConnectMode = () => {
    setConnectMode(prev => !prev);
    setPendingFromRoomId(null);
    if (connectMode) {
      setSelectedRoomId(null);
    }
  };

  const connectionArrows = useMemo(() => {
    const floorRooms = rooms.filter(r => r.floor === currentFloor);
    const roomMap = new Map(floorRooms.map(r => [r.id, r]));
    
    return connections
      .filter(conn => roomMap.has(conn.fromRoomId) && roomMap.has(conn.toRoomId))
      .map(conn => {
        const fromRoom = roomMap.get(conn.fromRoomId)!;
        const toRoom = roomMap.get(conn.toRoomId)!;
        const { path, startX, startY, endX, endY } = computeBezierPath(fromRoom, toRoom);
        
        return {
          id: conn.id,
          path,
          midX: (startX + endX) / 2,
          midY: (startY + endY) / 2,
          fromRoomId: conn.fromRoomId,
          toRoomId: conn.toRoomId,
        };
      });
  }, [connections, rooms, currentFloor]);

  const previewPath = useMemo(() => {
    if (!connectMode || !pendingFromRoomId || !mousePos) return null;
    const fromRoom = rooms.find(r => r.id === pendingFromRoomId);
    if (!fromRoom) return null;
    
    if (hoverRoomId && hoverRoomId !== pendingFromRoomId) {
      const toRoom = rooms.find(r => r.id === hoverRoomId);
      if (toRoom) {
        return computeBezierPath(fromRoom, toRoom).path;
      }
    }
    
    return computePreviewPath(fromRoom, mousePos.x, mousePos.y);
  }, [connectMode, pendingFromRoomId, mousePos, hoverRoomId, rooms]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="min-h-[4.5rem] py-3 border-b flex items-center justify-between px-8 bg-card z-10 shrink-0 shadow-sm">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-primary">{t("layout.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("layout.subtitle")}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant={connectMode ? "default" : "outline"}
            size="sm"
            onClick={toggleConnectMode}
            className={cn(
              "h-8 px-3",
              connectMode && "bg-primary text-primary-foreground"
            )}
            data-testid="button-connect-mode"
          >
            <Link2 className="mr-1.5 h-4 w-4" />
            {t("editor.connectMode", "Verbinden")}
          </Button>
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            <Button
              variant={currentFloor === -1 ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentFloor(-1)}
              className="h-8 px-3"
              data-testid="button-floor-ug"
            >
              <Building2 className="mr-1.5 h-3 w-3" />
              {t("editor.floorUG")}
            </Button>
            <Button
              variant={currentFloor === 0 ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentFloor(0)}
              className="h-8 px-3"
              data-testid="button-floor-eg"
            >
              <Building2 className="mr-1.5 h-3 w-3" />
              {t("editor.floorEG")}
            </Button>
            <Button
              variant={currentFloor === 1 ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentFloor(1)}
              className="h-8 px-3"
              data-testid="button-floor-og"
            >
              <Building2 className="mr-1.5 h-3 w-3" />
              {t("editor.floorOG")}
            </Button>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearAllRooms}
            data-testid="button-reset"
          >
            <Undo className="mr-2 h-4 w-4" /> {t("layout.reset")}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="w-48 border-r bg-card flex flex-col z-10 shadow-sm">
          <div className="px-3 py-2 border-b bg-muted/10">
            <h3 className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Plus className="w-3 h-3" />
              {t("layout.roomTypes")}
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {ROOM_TYPES.map((room) => (
              <button
                key={room.id}
                onClick={() => addRoom(room.id)}
                className="w-full group flex items-center gap-2 px-2 py-1.5 rounded-lg border border-transparent transition-all duration-150 text-left hover:border-primary/20 hover:bg-accent active:scale-[0.98]"
                data-testid={`button-add-room-${room.id}`}
              >
                <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", room.color)}>
                  <Plus className="w-3 h-3 opacity-40 group-hover:opacity-80 mix-blend-multiply" />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium text-foreground/80 leading-tight">{room.label}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0">{room.w}×{room.h}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="px-2 py-2 border-t bg-blue-50/50">
            <div className="flex items-start gap-2">
              <Info className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-600 leading-tight">
                {t("layout.tipText")}
              </p>
            </div>
          </div>
        </div>

        <div 
          ref={canvasRef}
          className="flex-1 bg-[#F0F4F8] relative overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setMousePos(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRoomId(null);
          }}
        >
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(to right, #000 1px, transparent 1px),
                linear-gradient(to bottom, #000 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px'
            }}
          />
          
          {efficiencyData && (
            <div 
              className="absolute bottom-4 right-4 w-64 bg-background/95 backdrop-blur-sm shadow-xl rounded-xl border p-3 z-40 pointer-events-auto"
              data-testid="card-layout-efficiency"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {t("layout.efficiencyScore", "Layout-Effizienz")}
                  </span>
                </div>
                <div className={cn(
                  "text-lg font-bold",
                  efficiencyData.score >= 70 ? "text-green-600" : efficiencyData.score >= 40 ? "text-amber-600" : "text-red-600"
                )} data-testid="text-efficiency-score">
                  {efficiencyData.score}/100
                </div>
              </div>
              
              {efficiencyData.breakdown.privacyRisk && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg" data-testid="badge-privacy-risk">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-[10px] font-medium text-red-700">
                    {t("layout.privacyRisk", "Datenschutzrisiko: Empfang zu nah am Wartebereich")}
                  </span>
                </div>
              )}
              
              {efficiencyData.tips.length > 0 && (
                <div className="space-y-1.5">
                  {efficiencyData.tips.slice(0, 3).map((tip, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground leading-tight" data-testid={`text-tip-${i}`}>{tip}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {efficiencyData.workflowMetrics && (
                <div className="mt-2 pt-2 border-t" data-testid="section-workflow-metrics">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Footprints className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("layout.workflowMetrics", "Workflow-Laufwege")}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="bg-muted/50 rounded px-1 py-0.5">
                      <div className="text-xs font-bold text-foreground" data-testid="text-total-distance">
                        {efficiencyData.workflowMetrics.totalDistanceMeters}m
                      </div>
                      <div className="text-[8px] text-muted-foreground">Gesamt</div>
                    </div>
                    <div className="bg-muted/50 rounded px-1 py-0.5">
                      <div className="text-xs font-bold text-foreground" data-testid="text-avg-step">
                        {efficiencyData.workflowMetrics.avgStepDistanceMeters}m
                      </div>
                      <div className="text-[8px] text-muted-foreground">Ø/Schritt</div>
                    </div>
                    <div className="bg-muted/50 rounded px-1 py-0.5">
                      <div className={cn(
                        "text-xs font-bold",
                        efficiencyData.workflowMetrics.motionWasteScore > 50 ? "text-red-600" : 
                        efficiencyData.workflowMetrics.motionWasteScore > 25 ? "text-amber-600" : "text-green-600"
                      )} data-testid="text-motion-waste">
                        {efficiencyData.workflowMetrics.motionWasteScore}
                      </div>
                      <div className="text-[8px] text-muted-foreground">Verlust</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <AnimatePresence>
            {rooms.filter(r => r.floor === currentFloor).map((room) => {
              const typeDef = ROOM_TYPES.find(t => t.id === room.type);
              const isSelected = selectedRoomId === room.id;
              
              const isPendingFrom = pendingFromRoomId === room.id;
              
              return (
                <motion.div
                  key={room.id}
                  drag={!connectMode}
                  dragMomentum={false}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    x: mToPx(room.x), 
                    y: mToPx(room.y), 
                    scale: isSelected ? 1.02 : 1, 
                    opacity: 1,
                    width: mToPx(room.width),
                    height: mToPx(room.height),
                    zIndex: isSelected ? 50 : 1
                  }}
                  onDragEnd={(e, info) => {
                    if (connectMode) return;
                    const shiftPressed = (e as MouseEvent).shiftKey;
                    handleDragEnd(room, info, shiftPressed);
                  }}
                  onClick={(e) => {
                    if (connectMode) {
                      e.stopPropagation();
                      handleRoomClickInConnectMode(room.id);
                    }
                  }}
                  onMouseEnter={() => connectMode && setHoverRoomId(room.id)}
                  onMouseLeave={() => connectMode && setHoverRoomId(null)}
                  className={cn(
                    "absolute rounded-lg border-2 flex flex-col items-center justify-center select-none transition-colors transition-shadow duration-200 will-change-transform group",
                    connectMode ? "cursor-pointer" : "cursor-move",
                    typeDef?.color,
                    isSelected ? "ring-4 ring-primary/20 border-primary shadow-2xl z-50" : "hover:shadow-lg hover:border-primary/50",
                    connectMode && isPendingFrom && "ring-4 ring-green-400 border-green-500",
                    connectMode && !isPendingFrom && pendingFromRoomId && "ring-2 ring-blue-300 border-blue-400"
                  )}
                  data-testid={`room-${room.id}`}
                >
                  <div className="absolute inset-2 border border-black/5 rounded-sm pointer-events-none" />
                  
                  {!connectMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoomId(room.id);
                      }}
                      className="absolute top-1 right-1 p-1.5 rounded-md bg-white/80 hover:bg-white shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20"
                      data-testid={`button-edit-room-${room.id}`}
                    >
                      <Pencil className="w-3 h-3 text-slate-600" />
                    </button>
                  )}
                  
                  <div className="text-center pointer-events-none p-2 w-full overflow-hidden relative z-10">
                    <div className="font-bold text-xs text-slate-800 truncate px-1">
                      {room.name || typeDef?.label}
                    </div>
                    {room.name && (
                      <div className="text-[9px] text-slate-500 uppercase tracking-widest scale-75 origin-center opacity-70">
                        {typeDef?.label}
                      </div>
                    )}
                    {isSelected && !connectMode && (
                       <div className="text-[9px] text-slate-500 font-mono mt-1 bg-white/50 inline-block px-1.5 rounded">
                         {room.width.toFixed(1)} x {room.height.toFixed(1)} m
                       </div>
                    )}
                    {connectMode && isPendingFrom && (
                      <div className="text-[9px] text-green-700 font-bold mt-1 bg-green-100 inline-block px-1.5 rounded">
                        {t("editor.connectFrom", "Start →")}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none z-30"
            data-testid="svg-connections"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
              </marker>
              <marker
                id="arrowhead-preview"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
              </marker>
            </defs>
            {connectionArrows.map(arrow => (
              <g key={arrow.id} data-testid={`connection-${arrow.id}`}>
                <path
                  d={arrow.path}
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className="transition-all duration-200"
                />
                {connectMode && (
                  <circle
                    cx={arrow.midX}
                    cy={arrow.midY}
                    r="12"
                    fill="#ef4444"
                    className="pointer-events-auto cursor-pointer hover:fill-red-600 transition-colors"
                    onClick={() => deleteConnectionMutation.mutate(arrow.id)}
                    data-testid={`button-delete-connection-${arrow.id}`}
                  />
                )}
                {connectMode && (
                  <text
                    x={arrow.midX}
                    y={arrow.midY + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize="14"
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    ×
                  </text>
                )}
              </g>
            ))}
            {previewPath && (
              <path
                d={previewPath}
                stroke="#22c55e"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="8 4"
                fill="none"
                markerEnd="url(#arrowhead-preview)"
                className="animate-pulse"
                data-testid="preview-connection"
              />
            )}
          </svg>
        </div>

        <AnimatePresence>
          {selectedRoom && (
            <motion.div
              drag
              dragMomentum={false}
              dragElastic={0.1}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute top-8 left-1/2 -translate-x-1/2 w-80 bg-background/90 backdrop-blur-md shadow-2xl rounded-2xl border border-border/50 z-50 overflow-hidden"
            >
              <div className="h-8 bg-muted/40 w-full cursor-grab active:cursor-grabbing flex items-center justify-center border-b">
                  <div className="w-12 h-1 rounded-full bg-foreground/10" />
              </div>

              <div className="p-4 pt-2">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <div className={cn("w-12 h-12 rounded-xl shadow-sm border-2 flex items-center justify-center", ROOM_TYPES.find(t => t.id === selectedRoom.type)?.color)}>
                           <Settings2 className="w-6 h-6 opacity-50 mix-blend-multiply" />
                      </div>
                      <div>
                      <h4 className="font-bold text-lg leading-none">{roomNameDraft || selectedRoomType?.label}</h4>
                      <p className="text-xs text-muted-foreground font-mono mt-1 uppercase tracking-wide">{selectedRoomType?.label}</p>
                      </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => setSelectedRoomId(null)}>
                      <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                      <Label htmlFor="roomName" className="text-xs font-bold uppercase text-muted-foreground">{t("editor.roomName")}</Label>
                      <Input 
                          id="roomName"
                          value={roomNameDraft} 
                          onChange={(e) => handleNameChange(e.target.value)}
                          onBlur={handleNameBlur}
                          placeholder={selectedRoomType?.label}
                          className="bg-white/50 border-slate-200 focus:bg-white transition-all"
                          data-testid="input-room-name"
                      />
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.width")}</Label>
                        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">{widthDraft.toFixed(1)} m</span>
                      </div>
                      <Slider 
                        value={[widthDraft]} 
                        min={1} 
                        max={8} 
                        step={0.1} 
                        onValueChange={([val]) => handleWidthChange(val)}
                        data-testid="slider-width"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                         <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.height")}</Label>
                        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">{heightDraft.toFixed(1)} m</span>
                      </div>
                      <Slider 
                        value={[heightDraft]} 
                        min={1} 
                        max={8} 
                        step={0.1} 
                        onValueChange={([val]) => handleHeightChange(val)}
                        data-testid="slider-height"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-border/30">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.area")}</Label>
                      <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded-md font-bold" data-testid="text-room-area">
                        {sqM(widthDraft, heightDraft)} m²
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.floor")}</Label>
                      <Select
                        value={String(selectedRoom.floor)}
                        onValueChange={(val) => updateRoom(selectedRoom.id, { floor: parseInt(val, 10) })}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-floor">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-1">{t("editor.floorUG")}</SelectItem>
                          <SelectItem value="0">{t("editor.floorEG")}</SelectItem>
                          <SelectItem value="1">{t("editor.floorOG")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="grid grid-cols-2 gap-3">
                     <Button 
                      variant="outline" 
                      className="hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
                      onClick={handleRotate}
                      data-testid="button-rotate"
                    >
                      <RotateCw className="mr-2 h-4 w-4" />
                      {t("editor.rotate")}
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="shadow-sm hover:shadow-md transition-all"
                      onClick={() => deleteRoom(selectedRoom.id)}
                      data-testid="button-delete"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("editor.delete")}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
