import { Sidebar } from "@/components/layout/Sidebar";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { EfficiencyChart } from "@/components/dashboard/EfficiencyChart";
import medicalHero from "@assets/generated_images/isometric_medical_practice_floor_plan_vector_art.png";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between space-y-2 mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-primary">Practice Overview</h2>
            <p className="text-muted-foreground">Current simulation status and performance metrics.</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              <Play className="mr-2 h-4 w-4" /> Run New Simulation
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          <StatsCards />
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <EfficiencyChart />
            
            <div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 flex flex-col space-y-1.5">
                <h3 className="font-semibold leading-none tracking-tight">Live Floor View</h3>
                <p className="text-sm text-muted-foreground">Real-time simulation preview.</p>
              </div>
              <div className="flex-1 relative bg-muted/20">
                <img 
                  src={medicalHero} 
                  alt="Simulation View" 
                  className="absolute inset-0 h-full w-full object-cover opacity-90 hover:opacity-100 transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-linear-to-t from-background/50 to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
