import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Clock, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";

export function StatsCards() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("stats.efficiency")}</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">92%</div>
          <p className="text-xs text-muted-foreground">{t("stats.efficiencyDesc")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("stats.harmony")}</CardTitle>
          <Heart className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">88/100</div>
          <p className="text-xs text-muted-foreground">{t("stats.harmonyDesc")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("stats.waitTime")}</CardTitle>
          <Clock className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">12 min</div>
          <p className="text-xs text-muted-foreground">{t("stats.waitTimeDesc")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("stats.capacity")}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">45/day</div>
          <p className="text-xs text-muted-foreground">{t("stats.capacityDesc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
