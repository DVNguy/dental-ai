import { Sidebar } from "@/components/layout/Sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Plus, Star, Zap } from "lucide-react";

const STAFF = [
  { 
    id: 1, 
    name: "Dr. Sarah Weber", 
    role: "General Practitioner", 
    stress: 25, 
    efficiency: 95, 
    avatar: "SW",
    traits: ["Empathetic", "Fast"]
  },
  { 
    id: 2, 
    name: "Dr. James Chen", 
    role: "Specialist", 
    stress: 65, 
    efficiency: 88, 
    avatar: "JC",
    traits: ["Detail-oriented"]
  },
  { 
    id: 3, 
    name: "Maria Rodriguez", 
    role: "Nurse", 
    stress: 40, 
    efficiency: 92, 
    avatar: "MR",
    traits: ["Multitasker", "Friendly"]
  },
  { 
    id: 4, 
    name: "David Kim", 
    role: "Receptionist", 
    stress: 80, 
    efficiency: 75, 
    avatar: "DK",
    traits: ["Organized"]
  },
];

export default function Staff() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-primary">Staff Management</h2>
            <p className="text-muted-foreground">Monitor stress levels and assign roles to optimize harmony.</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add Staff Member
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {STAFF.map((member) => (
            <Card key={member.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 border-t-4 border-t-transparent hover:border-t-primary">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{member.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-lg">{member.name}</CardTitle>
                  <CardDescription>{member.role}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  {member.traits.map(trait => (
                    <Badge key={trait} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none font-normal">
                      {trait}
                    </Badge>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Zap className="w-3 h-3" /> Efficiency
                      </span>
                      <span className="font-medium">{member.efficiency}%</span>
                    </div>
                    <Progress value={member.efficiency} className="h-2 bg-slate-100" indicatorClassName="bg-primary" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Star className="w-3 h-3" /> Stress Level
                      </span>
                      <span className={member.stress > 70 ? "text-destructive font-bold" : "font-medium"}>
                        {member.stress}%
                      </span>
                    </div>
                    <Progress 
                      value={member.stress} 
                      className="h-2 bg-slate-100" 
                      indicatorClassName={member.stress > 70 ? "bg-destructive" : "bg-secondary"} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
