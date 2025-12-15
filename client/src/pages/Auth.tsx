import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function Auth() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    api.auth.me().then(() => {
      setLocation("/");
    }).catch(() => {
    });
  }, [setLocation]);

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" data-testid="auth-page">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">PraxisFlow AI</CardTitle>
          <CardDescription>
            Melden Sie sich mit Ihrem Replit-Konto an
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleLogin} 
            className="w-full" 
            size="lg"
            data-testid="button-login-replit"
          >
            Mit Replit anmelden
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Sie werden zu Replit weitergeleitet, um sich anzumelden oder ein Konto zu erstellen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
