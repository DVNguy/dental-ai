import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ResetPassword() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" data-testid="reset-password-page">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Passwort zurücksetzen</CardTitle>
          <CardDescription>
            Diese Funktion ist nicht mehr verfügbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            PraxisFlow AI verwendet jetzt Replit Auth. Um Ihr Passwort zurückzusetzen, 
            besuchen Sie bitte{" "}
            <a 
              href="https://replit.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              replit.com
            </a>{" "}
            und setzen Sie dort Ihr Passwort zurück.
          </p>
          <Button 
            className="w-full" 
            onClick={() => setLocation("/auth")}
            data-testid="button-back-to-auth"
          >
            Zurück zur Anmeldung
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
