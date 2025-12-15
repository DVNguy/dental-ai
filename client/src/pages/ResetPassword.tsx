import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [form, setForm] = useState({ password: "", confirmPassword: "" });

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
      verifyToken(tokenParam);
    } else {
      setIsValidating(false);
      setIsValidToken(false);
    }
  }, [search]);

  const verifyToken = async (tokenValue: string) => {
    try {
      const response = await fetch(`/api/auth/verify-reset-token?token=${tokenValue}`);
      const data = await response.json();
      setIsValidToken(data.valid);
    } catch (error) {
      setIsValidToken(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (form.password !== form.confirmPassword) {
      toast({
        title: "Passwörter stimmen nicht überein",
        description: "Bitte geben Sie das gleiche Passwort zweimal ein",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          token, 
          password: form.password, 
          confirmPassword: form.confirmPassword 
        }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Zurücksetzen fehlgeschlagen");
      }
      
      toast({ 
        title: "Passwort zurückgesetzt", 
        description: "Sie können sich jetzt mit Ihrem neuen Passwort anmelden" 
      });
      setLocation("/auth");
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" data-testid="reset-password-page">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Token wird überprüft...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" data-testid="reset-password-page">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Ungültiger Link</CardTitle>
            <CardDescription>
              Der Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen.
            </CardDescription>
          </CardHeader>
          <CardContent>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" data-testid="reset-password-page">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Neues Passwort festlegen</CardTitle>
          <CardDescription>Geben Sie Ihr neues Passwort ein</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Neues Passwort</Label>
              <Input
                id="new-password"
                type="password"
                data-testid="input-new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Passwort bestätigen</Label>
              <Input
                id="confirm-new-password"
                type="password"
                data-testid="input-confirm-new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-reset-password">
              {isLoading ? "Wird zurückgesetzt..." : "Passwort zurücksetzen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
