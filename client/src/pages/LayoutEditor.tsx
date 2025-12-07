import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Save, Undo, Info, Trash2, RotateCw, Move, X, Settings2, GripHorizontal, DollarSign } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export default function LayoutEditor() {
  const { t } = useTranslation();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [budget, setBudget] = useState(50000); // Game-like element
  
  const ROOM_TYPES = [
    { id: "reception", label: t("rooms.reception"), color: "bg-blue-100 border-blue-300", w: 150, h: 100, cost: 2500 },
    { id: "waiting", label: t("rooms.waiting"), color: "bg-green-100 border-green-300", w: 200, h: 150, cost: 1500 },
    { id: "exam", label: t("rooms.exam"), color: "bg-white border-gray-300", w: 120, h: 120, cost: 5000 },
    { id: "lab", label: t("rooms.lab"), color: "bg-purple-100 border-purple-300", w: 100, h: 100, cost: 8000 },
    { id: "office", label: t("rooms.office"), color: "bg-orange-100 border-orange-300", w: 120, h: 120, cost: 3000 },
  ];

  const [rooms, setRooms] = useState([
    { id: 1, type: "reception", name: "", x: 50, y: 50, w: 150, h: 100 },
    { id: 2, type: "waiting", name: "", x: 250, y: 50, w: 200, h: 150 },
    { id: 3, type: "exam", name: "Dental Chair 1", x: 50, y: 250, w: 120, h: 120 },
  ]);

  const addRoom = (typeId: string) => {
    const typeDef = ROOM_TYPES.find(t => t.id === typeId);
    if (!typeDef) return;
    
    // Game mechanic: Check budget
    if (budget < typeDef.cost) {
      // In a real app we'd show a toast here
      return; 
    }

    setBudget(prev => prev - typeDef.cost);

    const newId = Date.now();
    setRooms([...rooms, { 
      id: newId, 
      type: typeId,
      name: "", 
      x: 100, 
      y: 100,
      w: typeDef.w,
      h: typeDef.h
    }]);
    setSelectedRoomId(newId);
  };

  const updateRoom = (id: number, updates: any) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteRoom = (id: number) => {
    const room = rooms.find(r => r.id === id);
    if (room) {
      const typeDef = ROOM_TYPES.find(t => t.id === room.type);
      if (typeDef) setBudget(prev => prev + (typeDef.cost * 0.8)); // Refund 80%
    }
    setRooms(rooms.filter(r => r.id !== id));
    setSelectedRoomId(null);
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedRoomType = selectedRoom ? ROOM_TYPES.find(t => t.id === selectedRoom.type) : null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b flex items-center justify-between px-8 bg-card z-10 shrink-0 shadow-sm">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-primary">{t("layout.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("layout.subtitle")}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRooms([]); setBudget(50000); }}>
              <Undo className="mr-2 h-4 w-4" /> {t("layout.reset")}
            </Button>
            <Button size="sm" className="bg-primary text-white shadow-md hover:shadow-lg transition-all">
              <Save className="mr-2 h-4 w-4" /> {t("layout.save")}
            </Button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          {/* Modern Palette Sidebar */}
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
                  disabled={budget < room.cost}
                  className={cn(
                    "w-full group flex items-center gap-3 p-3 rounded-xl border-2 border-transparent transition-all duration-200 text-left relative overflow-hidden",
                    budget < room.cost ? "opacity-50 cursor-not-allowed grayscale" : "hover:border-primary/20 hover:bg-accent hover:shadow-md active:scale-95"
                  )}
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

          {/* Canvas */}
          <div 
            className="flex-1 bg-[#F0F4F8] relative overflow-hidden cursor-grab active:cursor-grabbing"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedRoomId(null);
            }}
          >
            {/* Grid Pattern */}
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
                      width: room.w,
                      height: room.h,
                      zIndex: isSelected ? 50 : 1
                    }}
                    onDragEnd={(_, info) => {
                      updateRoom(room.id, { 
                        x: room.x + info.offset.x, 
                        y: room.y + info.offset.y 
                      });
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRoomId(room.id);
                    }}
                    className={cn(
                      "absolute rounded-lg border-2 flex flex-col items-center justify-center cursor-move select-none transition-all duration-200",
                      typeDef?.color,
                      isSelected ? "ring-4 ring-primary/20 border-primary shadow-2xl z-50 scale-[1.02]" : "hover:shadow-lg hover:border-primary/50"
                    )}
                  >
                    {/* Room Interior "Texture" */}
                    <div className="absolute inset-2 border border-black/5 rounded-sm pointer-events-none" />
                    
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
                           {Math.round(room.w)} x {Math.round(room.h)}
                         </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Draggable Inspector Panel */}
          <AnimatePresence>
            {selectedRoom && (
              <motion.div
                drag
                dragMomentum={false}
                dragElastic={0.1}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute top-8 right-8 w-80 bg-background/90 backdrop-blur-md shadow-2xl rounded-2xl border border-border/50 z-50 overflow-hidden"
              >
                {/* Drag Handle */}
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
                        <h4 className="font-bold text-lg leading-none">{selectedRoom.name || selectedRoomType?.label}</h4>
                        <p className="text-xs text-muted-foreground font-mono mt-1 uppercase tracking-wide">{selectedRoomType?.label}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => setSelectedRoomId(null)}>
                        <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-5">
                    {/* Rename Input */}
                    <div className="space-y-2">
                        <Label htmlFor="roomName" className="text-xs font-bold uppercase text-muted-foreground">{t("editor.roomName")}</Label>
                        <Input 
                            id="roomName"
                            value={selectedRoom.name} 
                            onChange={(e) => updateRoom(selectedRoom.id, { name: e.target.value })}
                            placeholder={selectedRoomType?.label}
                            className="bg-white/50 border-slate-200 focus:bg-white transition-all"
                        />
                    </div>

                    <Separator className="bg-border/50" />

                    {/* Dimensions */}
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.width")}</Label>
                          <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">{selectedRoom.w}px</span>
                        </div>
                        <Slider 
                          value={[selectedRoom.w]} 
                          min={50} 
                          max={400} 
                          step={10} 
                          onValueChange={([val]) => updateRoom(selectedRoom.id, { w: val })}
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                           <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.height")}</Label>
                          <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">{selectedRoom.h}px</span>
                        </div>
                        <Slider 
                          value={[selectedRoom.h]} 
                          min={50} 
                          max={400} 
                          step={10} 
                          onValueChange={([val]) => updateRoom(selectedRoom.id, { h: val })}
                        />
                      </div>
                    </div>

                    <Separator className="bg-border/50" />

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3">
                       <Button 
                        variant="outline" 
                        className="hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
                        onClick={() => updateRoom(selectedRoom.id, { w: selectedRoom.h, h: selectedRoom.w })}
                      >
                        <RotateCw className="mr-2 h-4 w-4" />
                        {t("editor.rotate")}
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="shadow-sm hover:shadow-md transition-all"
                        onClick={() => deleteRoom(selectedRoom.id)}
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
      </main>
    </div>
  );
}
