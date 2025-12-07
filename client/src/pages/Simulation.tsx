import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { PlayCircle, PauseCircle, FastForward, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function Simulation() {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState([1]);
  const [patientVolume, setPatientVolume] = useState([50]);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">{t("sim.title")}</h2>
          <p className="text-muted-foreground">{t("sim.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 h-[500px] flex flex-col relative overflow-hidden bg-slate-900 text-white border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 opacity-50" />
          <div className="relative z-10 flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full border-4 border-primary/30 flex items-center justify-center mx-auto animate-pulse">
                      <PlayCircle className="w-12 h-12 text-primary" />
                  </div>
                  <p className="text-slate-400">{t("sim.engineReady")}</p>
              </div>
          </div>
          
          <div className="relative z-10 bg-slate-800/50 p-4 backdrop-blur border-t border-slate-700 flex items-center justify-between">
              <div className="flex gap-2">
                  <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-white hover:bg-white/10"
                      onClick={() => setIsPlaying(!isPlaying)}
                  >
                      {isPlaying ? <PauseCircle className="h-6 w-6" /> : <PlayCircle className="h-6 w-6" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                      <RotateCcw className="h-5 w-5" />
                  </Button>
              </div>
              <div className="font-mono text-xl text-primary">08:00 AM</div>
              <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                      <FastForward className="h-5 w-5" />
                  </Button>
              </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
              <CardHeader>
                  <CardTitle>{t("sim.params")}</CardTitle>
                  <CardDescription>{t("sim.paramsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                          <span className="font-medium">{t("sim.patientVolume")}</span>
                          <span className="text-muted-foreground">{patientVolume}%</span>
                      </div>
                      <Slider 
                          value={patientVolume} 
                          onValueChange={setPatientVolume} 
                          max={200} 
                          step={10}
                          className="py-2"
                      />
                  </div>

                  <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                          <span className="font-medium">{t("sim.speed")}</span>
                          <span className="text-muted-foreground">{speed}x</span>
                      </div>
                      <Slider 
                          value={speed} 
                          onValueChange={setSpeed} 
                          max={5} 
                          step={0.5} 
                          min={0.5}
                          className="py-2"
                      />
                  </div>
                  
                  <div className="pt-4 border-t">
                      <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">{t("sim.randomEvents")}</span>
                          <Switch checked />
                      </div>
                      <p className="text-xs text-muted-foreground">{t("sim.randomEventsDesc")}</p>
                  </div>
              </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-100">
              <CardHeader>
                  <CardTitle className="text-blue-900 text-base">{t("sim.activeScenario")}</CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-sm text-blue-800 mb-2 font-medium">"{t("sim.scenarioName")}"</p>
                  <p className="text-xs text-blue-600">
                      {t("sim.scenarioDesc")}
                  </p>
              </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Switch({ checked }: { checked: boolean }) {
    return (
        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${checked ? 'bg-primary' : 'bg-slate-200'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
        </div>
    )
}
