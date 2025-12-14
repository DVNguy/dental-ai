import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, PenTool, Users, PlayCircle, Settings, Activity, Brain, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "./LanguageToggle";

export function Sidebar() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), href: "/" },
    { icon: PenTool, label: t("nav.layout"), href: "/editor" },
    { icon: Users, label: t("nav.staff"), href: "/staff" },
    { icon: PlayCircle, label: t("nav.simulation"), href: "/simulation" },
    { icon: Brain, label: t("nav.knowledge", "Coach-Wissen"), href: "/knowledge" },
    { icon: BookOpen, label: t("nav.playbooks", "Playbooks"), href: "/playbooks" },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b px-6">
        <Activity className="mr-2 h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">{t("app.title")}</span>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t p-4 space-y-2">
        <LanguageToggle />
        <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer">
          <Settings className="h-4 w-4" />
          {t("nav.settings")}
        </div>
      </div>
    </div>
  );
}
