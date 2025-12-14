import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, PenTool, Users, PlayCircle, Brain, Menu, X, Activity, Settings, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "./LanguageToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav() {
  const [open, setOpen] = useState(false);
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
    <div className="md:hidden flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <span className="font-bold text-sm">{t("app.title")}</span>
      </div>
      
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-14 items-center border-b px-4">
            <Activity className="mr-2 h-5 w-5 text-primary" />
            <span className="font-bold">{t("app.title")}</span>
          </div>
          <nav className="flex-1 py-4 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t p-4 space-y-2">
            <LanguageToggle />
            <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground">
              <Settings className="h-4 w-4" />
              {t("nav.settings")}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
