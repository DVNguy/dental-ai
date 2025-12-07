import { Switch, Route } from "wouter";
import Dashboard from "@/pages/Dashboard";
import LayoutEditor from "@/pages/LayoutEditor";
import Staff from "@/pages/Staff";
import Simulation from "@/pages/Simulation";
import NotFound from "@/pages/not-found";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/editor" component={LayoutEditor} />
      <Route path="/staff" component={Staff} />
      <Route path="/simulation" component={Simulation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Router />
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
