import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Save, Undo, Info, Trash2, RotateCw, Move, X, Settings2 } from "lucide-react";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export default function LayoutEditor() {
  const { t } = useTranslation();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  
  const ROOM_TYPES = [
    { id: "reception", label: t("rooms.reception"), color: "bg-blue-100 border-blue-300", w: 150, h: 100 },
    { id: "waiting", label: t("rooms.waiting"), color: "bg-green-100 border-green-300", w: 200, h: 150 },
    { id: "exam", label: t("rooms.exam"), color: "bg-white border-gray-300", w: 120, h: 120 },
    { id: "lab", label: t("rooms.lab"), color: "bg-purple-100 border-purple-300", w: 100, h: 100 },
    { id: "office", label: t("rooms.office"), color: "bg-orange-100 border-orange-300", w: 120, h: 120 },
  ];

  const [rooms, setRooms] = useState([
    { id: 1, type: "reception", x: 50, y: 50, w: 150, h: 100 },
    { id: 2, type: "waiting", x: 250, y: 50, w: 200, h: 150 },
    { id: 3, type: "exam", x: 50, y: 250, w: 120, h: 120 },
  ]);

  const addRoom = (typeId: string) => {
    const typeDef = ROOM_TYPES.find(t => t.id === typeId);
    const newId = Date.now();
    setRooms([...rooms, { 
      id: newId, 
      type: typeId, 
      x: 100, 
      y: 100,
      w: typeDef?.w || 100,
      h: typeDef?.h || 100
    }]);
    setSelectedRoomId(newId);
  };

  const updateRoom = (id: number, updates: any) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteRoom = (id: number) => {
    setRooms(rooms.filter(r => r.id !== id));
    setSelectedRoomId(null);
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedRoomType = selectedRoom ? ROOM_TYPES.find(t => t.id === selectedRoom.type) : null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b flex items-center justify-between px-8 bg-card z-10 shrink-0">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-primary">{t("layout.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("layout.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRooms([])}>
              <Undo className="mr-2 h-4 w-4" /> {t("layout.reset")}
            </Button>
            <Button size="sm" className="bg-primary text-white">
              <Save className="mr-2 h-4 w-4" /> {t("layout.save")}
            </Button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          {/* Modern Palette Sidebar */}
          <div className="w-64 border-r bg-card flex flex-col z-10">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {t("layout.roomTypes")}
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {ROOM_TYPES.map((room) => (
                <button
                  key={room.id}
                  onClick={() => addRoom(room.id)}
                  className="w-full group flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-border hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-left"
                >
                  <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0 shadow-sm", room.color)}>
                    <Plus className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium leading-none">{room.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{room.w}x{room.h}px</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 border-t bg-muted/20">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-xs text-blue-900">{t("layout.tipTitle")}</p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    {t("layout.tipText")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div 
            className="flex-1 bg-slate-50/50 relative overflow-hidden cursor-crosshair"
            onClick={(e) => {
              // Deselect if clicking background
              if (e.target === e.currentTarget) setSelectedRoomId(null);
            }}
          >
            <div 
              className="absolute inset-0 pointer-events-none opacity-15"
              style={{
                backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                backgroundSize: '24px 24px'
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
                    initial={{ scale: 0.8, opacity: 0 }}
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
                      "absolute rounded-lg border shadow-sm flex items-center justify-center cursor-move select-none transition-shadow",
                      typeDef?.color,
                      isSelected ? "ring-2 ring-primary ring-offset-2 shadow-xl" : "hover:shadow-md"
                    )}
                  >
                    <div className="text-center pointer-events-none p-2 overflow-hidden">
                      <div className="font-medium text-xs text-slate-700 truncate">{typeDef?.label}</div>
                      {isSelected && (
                         <div className="text-[10px] text-slate-500 font-mono mt-0.5">{Math.round(room.w)}x{Math.round(room.h)}</div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Floating Inspector Panel */}
          <AnimatePresence>
            {selectedRoom && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.2 }}
                className="absolute top-4 right-4 w-72 bg-card/95 backdrop-blur shadow-2xl rounded-xl border z-50 overflow-hidden"
              >
                <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    {t("editor.properties")}
                  </h3>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => setSelectedRoomId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="p-4 space-y-6">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-md shadow-sm border", ROOM_TYPES.find(t => t.id === selectedRoom.type)?.color)}></div>
                    <div>
                      <h4 className="font-semibold tracking-tight">{selectedRoomType?.label}</h4>
                      <p className="text-xs text-muted-foreground font-mono">ID: {selectedRoom.id}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Dimensions */}
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-medium uppercase text-muted-foreground">{t("editor.width")}</Label>
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{selectedRoom.w}px</span>
                      </div>
                      <Slider 
                        value={[selectedRoom.w]} 
                        min={50} 
                        max={400} 
                        step={10} 
                        onValueChange={([val]) => updateRoom(selectedRoom.id, { w: val })}
                        className="py-1"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                         <Label className="text-xs font-medium uppercase text-muted-foreground">{t("editor.height")}</Label>
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{selectedRoom.h}px</span>
                      </div>
                      <Slider 
                        value={[selectedRoom.h]} 
                        min={50} 
                        max={400} 
                        step={10} 
                        onValueChange={([val]) => updateRoom(selectedRoom.id, { h: val })}
                        className="py-1"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3">
                     <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateRoom(selectedRoom.id, { w: selectedRoom.h, h: selectedRoom.w })}
                    >
                      <RotateCw className="mr-2 h-3.5 w-3.5" />
                      {t("editor.rotate")}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => deleteRoom(selectedRoom.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      {t("editor.delete")}
                    </Button>
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
