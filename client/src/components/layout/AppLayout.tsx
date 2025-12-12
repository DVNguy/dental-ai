import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { GlobalAIPanel } from "./GlobalAIPanel";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-background flex-col md:flex-row">
      <MobileNav />
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <div className="hidden lg:block">
        <GlobalAIPanel />
      </div>
    </div>
  );
}
