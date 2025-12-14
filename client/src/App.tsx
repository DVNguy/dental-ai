import { Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PracticeProvider } from "@/contexts/PracticeContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import LayoutEditor from "@/pages/LayoutEditor";
import Staff from "@/pages/Staff";
import Simulation from "@/pages/Simulation";
import Knowledge from "@/pages/Knowledge";
import Playbooks from "@/pages/Playbooks";
import NotFound from "@/pages/not-found";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/editor" component={LayoutEditor} />
        <Route path="/staff" component={Staff} />
        <Route path="/simulation" component={Simulation} />
        <Route path="/knowledge" component={Knowledge} />
        <Route path="/playbooks" component={Playbooks} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PracticeProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </PracticeProvider>
    </QueryClientProvider>
  );
}

export default App;
