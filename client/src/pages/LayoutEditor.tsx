import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Undo, Info, Trash2, RotateCw, X, Settings2, Pencil } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { usePractice } from "@/contexts/PracticeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Room } from "@shared/schema";

const GRID_SIZE = 40;

const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

export default function LayoutEditor() {
  const { t } = useTranslation();
  const { practiceId } = usePractice();
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  const [roomNameDraft, setRoomNameDraft] = useState("");
  const [widthDraft, setWidthDraft] = useState<number>(100);
  const [heightDraft, setHeightDraft] = useState<number>(100);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const aiInvalidateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nameDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const widthDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heightDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRoomIdRef = useRef<string | null>(null);
  
  const ROOM_TYPES = [
    { id: "reception", label: t("rooms.reception"), color: "bg-blue-100 border-blue-300", w: 150, h: 100 },
    { id: "waiting", label: t("rooms.waiting"), color: "bg-green-100 border-green-300", w: 200, h: 150 },
    { id: "exam", label: t("rooms.exam"), color: "bg-white border-gray-300", w: 120, h: 120 },
    { id: "lab", label: t("rooms.lab"), color: "bg-purple-100 border-purple-300", w: 100, h: 100 },
    { id: "office", label: t("rooms.office"), color: "bg-orange-100 border-orange-300", w: 120, h: 120 },
  ];

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", practiceId],
    queryFn: () => api.rooms.list(practiceId!),
    enabled: !!practiceId,
  });

  const getCanvasBounds = useCallback(() => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }
    return { width: 1200, height: 800 };
  }, []);

  const scheduleAIInvalidation = useCallback(() => {
    clearTimeout(aiInvalidateTimer.current);
    aiInvalidateTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["ai-analysis", practiceId] });
    }, 2000);
  }, [queryClient, practiceId]);

  const createRoomMutation = useMutation({
    mutationFn: (data: { type: string; name: string; x: number; y: number; width: number; height: number }) =>
      api.rooms.create(practiceId!, { ...data, practiceId: practiceId! }),
    onSuccess: (newRoom) => {
      queryClient.invalidateQueries({ queryKey: ["rooms", practiceId] });
      scheduleAIInvalidation();
      setSelectedRoomId(newRoom.id);
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Room> }) =>
      api.rooms.update(id, updates),
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

  const handleWidthChange = (val: number) => {
    const targetRoomId = selectedRoomId;
    if (!targetRoomId) return;
    
    setWidthDraft(val);
    clearTimeout(widthDebounceTimer.current);
    widthDebounceTimer.current = setTimeout(() => {
      const room = rooms.find(r => r.id === targetRoomId);
      if (room) {
        const bounds = getCanvasBounds();
        const clampedX = clamp(room.x, 0, bounds.width - val);
        const updates: Partial<Room> = { width: val };
        if (clampedX !== room.x) {
          updates.x = clampedX;
        }
        updateRoomMutation.mutate({ id: targetRoomId, updates });
      }
    }, 300);
  };

  const handleHeightChange = (val: number) => {
    const targetRoomId = selectedRoomId;
    if (!targetRoomId) return;
    
    setHeightDraft(val);
    clearTimeout(heightDebounceTimer.current);
    heightDebounceTimer.current = setTimeout(() => {
      const room = rooms.find(r => r.id === targetRoomId);
      if (room) {
        const bounds = getCanvasBounds();
        const clampedY = clamp(room.y, 0, bounds.height - val);
        const updates: Partial<Room> = { height: val };
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
      x: 100, 
      y: 100,
      width: typeDef.w,
      height: typeDef.h
    });
  };

  const updateRoom = (id: string, updates: Partial<Room>) => {
    updateRoomMutation.mutate({ id, updates });
  };

  const handleRotate = () => {
    if (!selectedRoom) return;
    const bounds = getCanvasBounds();
    const newWidth = selectedRoom.height;
    const newHeight = selectedRoom.width;
    const clampedX = clamp(selectedRoom.x, 0, bounds.width - newWidth);
    const clampedY = clamp(selectedRoom.y, 0, bounds.height - newHeight);
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
    const bounds = getCanvasBounds();
    let newX = room.x + info.offset.x;
    let newY = room.y + info.offset.y;
    
    if (!shiftPressed) {
      newX = snapToGrid(newX);
      newY = snapToGrid(newY);
    }
    
    newX = clamp(newX, 0, bounds.width - room.width);
    newY = clamp(newY, 0, bounds.height - room.height);
    
    updateRoom(room.id, { x: newX, y: newY });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 border-b flex items-center justify-between px-8 bg-card z-10 shrink-0 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-primary">{t("layout.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("layout.subtitle")}</p>
        </div>
        
        <div className="flex items-center gap-2">
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
        <div className="w-64 border-r bg-card flex flex-col z-10 shadow-lg">
          <div className="p-4 border-b bg-muted/10">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t("layout.roomTypes")}
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {ROOM_TYPES.map((room) => (
              <button
                key={room.id}
                onClick={() => addRoom(room.id)}
                className="w-full group flex items-center gap-3 p-3 rounded-xl border-2 border-transparent transition-all duration-200 text-left relative overflow-hidden hover:border-primary/20 hover:bg-accent hover:shadow-md active:scale-95"
                data-testid={`button-add-room-${room.id}`}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110", room.color)}>
                  <Plus className="w-5 h-5 opacity-50 group-hover:opacity-100 mix-blend-multiply" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold leading-none truncate text-foreground/90">{room.label}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-muted-foreground font-medium">{room.w}x{room.h}px</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 border-t bg-blue-50/50">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-1.5 rounded-full shrink-0">
                <Info className="h-4 w-4 text-blue-600" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-xs text-blue-900">{t("layout.tipTitle")}</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  {t("layout.tipText")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div 
          ref={canvasRef}
          className="flex-1 bg-[#F0F4F8] relative overflow-hidden cursor-grab active:cursor-grabbing"
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
          
          <AnimatePresence>
            {rooms.map((room) => {
              const typeDef = ROOM_TYPES.find(t => t.id === room.type);
              const isSelected = selectedRoomId === room.id;
              
              return (
                <motion.div
                  key={room.id}
                  drag
                  dragMomentum={false}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    x: room.x, 
                    y: room.y, 
                    scale: 1, 
                    opacity: 1,
                    width: room.width,
                    height: room.height,
                    zIndex: isSelected ? 50 : 1
                  }}
                  onDragEnd={(e, info) => {
                    const shiftPressed = (e as MouseEvent).shiftKey;
                    handleDragEnd(room, info, shiftPressed);
                  }}
                  className={cn(
                    "absolute rounded-lg border-2 flex flex-col items-center justify-center cursor-move select-none transition-all duration-200 group",
                    typeDef?.color,
                    isSelected ? "ring-4 ring-primary/20 border-primary shadow-2xl z-50 scale-[1.02]" : "hover:shadow-lg hover:border-primary/50"
                  )}
                  data-testid={`room-${room.id}`}
                >
                  <div className="absolute inset-2 border border-black/5 rounded-sm pointer-events-none" />
                  
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
                  
                  <div className="text-center pointer-events-none p-2 w-full overflow-hidden relative z-10">
                    <div className="font-bold text-xs text-slate-800 truncate px-1">
                      {room.name || typeDef?.label}
                    </div>
                    {room.name && (
                      <div className="text-[9px] text-slate-500 uppercase tracking-widest scale-75 origin-center opacity-70">
                        {typeDef?.label}
                      </div>
                    )}
                    {isSelected && (
                       <div className="text-[9px] text-slate-500 font-mono mt-1 bg-white/50 inline-block px-1.5 rounded">
                         {Math.round(room.width)} x {Math.round(room.height)}
                       </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
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
                        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">{widthDraft}px</span>
                      </div>
                      <Slider 
                        value={[widthDraft]} 
                        min={50} 
                        max={400} 
                        step={10} 
                        onValueChange={([val]) => handleWidthChange(val)}
                        data-testid="slider-width"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                         <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.height")}</Label>
                        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">{heightDraft}px</span>
                      </div>
                      <Slider 
                        value={[heightDraft]} 
                        min={50} 
                        max={400} 
                        step={10} 
                        onValueChange={([val]) => handleHeightChange(val)}
                        data-testid="slider-height"
                      />
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
