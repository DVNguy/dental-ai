import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { time: "08:00", efficiency: 65, harmony: 80 },
  { time: "09:00", efficiency: 75, harmony: 78 },
  { time: "10:00", efficiency: 85, harmony: 75 },
  { time: "11:00", efficiency: 90, harmony: 70 },
  { time: "12:00", efficiency: 80, harmony: 85 },
  { time: "13:00", efficiency: 70, harmony: 88 },
  { time: "14:00", efficiency: 85, harmony: 80 },
  { time: "15:00", efficiency: 92, harmony: 75 },
  { time: "16:00", efficiency: 88, harmony: 72 },
  { time: "17:00", efficiency: 70, harmony: 65 },
];

export function EfficiencyChart() {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Daily Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorEfficiency" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorHarmony" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            <Area type="monotone" dataKey="efficiency" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorEfficiency)" name="Efficiency Index" strokeWidth={2} />
            <Area type="monotone" dataKey="harmony" stroke="hsl(var(--secondary))" fillOpacity={1} fill="url(#colorHarmony)" name="Harmony Score" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
