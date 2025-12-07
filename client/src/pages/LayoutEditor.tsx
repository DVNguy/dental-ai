import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Plus, Save, Undo, Info } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ROOM_TYPES = [
  { id: "reception", label: "Reception", color: "bg-blue-100 border-blue-300", w: 150, h: 100 },
  { id: "waiting", label: "Waiting Room", color: "bg-green-100 border-green-300", w: 200, h: 150 },
  { id: "exam", label: "Exam Room", color: "bg-white border-gray-300", w: 120, h: 120 },
  { id: "lab", label: "Laboratory", color: "bg-purple-100 border-purple-300", w: 100, h: 100 },
  { id: "office", label: "Doctor Office", color: "bg-orange-100 border-orange-300", w: 120, h: 120 },
];

export default function LayoutEditor() {
  const [rooms, setRooms] = useState([
    { id: 1, type: "reception", x: 50, y: 50 },
    { id: 2, type: "waiting", x: 250, y: 50 },
    { id: 3, type: "exam", x: 50, y: 250 },
  ]);

  const addRoom = (typeId: string) => {
    setRooms([...rooms, { id: Date.now(), type: typeId, x: 100, y: 100 }]);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b flex items-center justify-between px-8 bg-card z-10">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-primary">Practice Layout Editor</h2>
            <p className="text-sm text-muted-foreground">Drag and drop to optimize patient flow.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Undo className="mr-2 h-4 w-4" /> Reset
            </Button>
            <Button size="sm" className="bg-primary text-white">
              <Save className="mr-2 h-4 w-4" /> Save Layout
            </Button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Palette Sidebar */}
          <div className="w-64 border-r bg-muted/30 p-4 overflow-y-auto">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Room Types</h3>
            <div className="space-y-3">
              {ROOM_TYPES.map((room) => (
                <Card 
                  key={room.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow active:scale-95 border-l-4 border-l-primary"
                  onClick={() => addRoom(room.id)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm font-medium">{room.label}</span>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <Info className="h-4 w-4" />
                <span className="font-medium text-xs">Optimization Tip</span>
              </div>
              <p className="text-xs text-blue-600 leading-relaxed">
                Placing the Waiting Room closer to Exam Rooms increases Efficiency Score by reducing patient travel time.
              </p>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 bg-slate-50 relative overflow-hidden">
            <div 
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            />
            
            {rooms.map((room) => {
              const typeDef = ROOM_TYPES.find(t => t.id === room.type);
              return (
                <motion.div
                  key={room.id}
                  drag
                  dragMomentum={false}
                  initial={{ x: room.x, y: room.y, scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileHover={{ scale: 1.02, boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                  whileDrag={{ scale: 1.05, cursor: "grabbing", zIndex: 50, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                  className={`absolute rounded-lg border shadow-sm flex items-center justify-center cursor-grab select-none ${typeDef?.color}`}
                  style={{ width: typeDef?.w, height: typeDef?.h }}
                >
                  <div className="text-center">
                    <div className="font-medium text-xs text-slate-700">{typeDef?.label}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{typeDef?.w}x{typeDef?.h}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
