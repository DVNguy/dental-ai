import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, Brain, Search, BookOpen, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const CATEGORIES = [
  { value: "scheduling", label: "Terminplanung" },
  { value: "patient-flow", label: "Patientenfluss" },
  { value: "staff-management", label: "Personalführung" },
  { value: "room-layout", label: "Raumplanung" },
  { value: "efficiency", label: "Effizienz" },
  { value: "profitability", label: "Wirtschaftlichkeit" },
  { value: "communication", label: "Kommunikation" },
  { value: "marketing", label: "Praxismarketing" },
  { value: "hygiene", label: "Hygiene" },
  { value: "quality", label: "Qualitätsmanagement" },
  { value: "general", label: "Allgemein" },
];

export default function Knowledge() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  useMemo(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    tags: "",
    description: "",
    file: null as File | null,
  });

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["knowledge-sources"],
    queryFn: api.knowledge.list,
  });

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["knowledge-search", debouncedQuery],
    queryFn: () => api.knowledge.search(debouncedQuery, 5),
    enabled: debouncedQuery.length > 2,
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!formData.file) throw new Error("Keine Datei ausgewählt");
      return api.knowledge.upload(formData.file, {
        title: formData.title,
        category: formData.category,
        tags: formData.tags,
        description: formData.description,
      });
    },
    onSuccess: (result) => {
      toast({
        title: "Wissen hochgeladen",
        description: `${result.chunksProcessed} Abschnitte verarbeitet`,
      });
      queryClient.invalidateQueries({ queryKey: ["knowledge-sources"] });
      setUploadDialogOpen(false);
      setFormData({ title: "", category: "", tags: "", description: "", file: null });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Hochladen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.knowledge.delete(id),
    onSuccess: () => {
      toast({ title: "Quelle gelöscht" });
      queryClient.invalidateQueries({ queryKey: ["knowledge-sources"] });
    },
    onError: () => {
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ 
        ...prev, 
        file,
        title: prev.title || file.name.replace(/\.[^/.]+$/, "")
      }));
    }
  };

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-knowledge">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-knowledge">
            <Brain className="h-7 w-7 text-primary" />
            Coach-Wissensbasis
          </h1>
          <p className="text-muted-foreground mt-1">
            Ihr Fachwissen als Grundlage für alle KI-Empfehlungen
          </p>
        </div>
        
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-knowledge">
              <Upload className="h-4 w-4 mr-2" />
              Wissen hochladen
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Coaching-Dokument hochladen</DialogTitle>
              <DialogDescription>
                Laden Sie ein Word-Dokument mit Ihrem Fachwissen hoch. Es wird automatisch verarbeitet und in die Wissensbasis integriert.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="file">Word-Dokument (.docx)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".docx,.doc"
                  onChange={handleFileChange}
                  data-testid="input-file"
                />
              </div>
              
              <div>
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="z.B. Optimale Terminplanung für Zahnarztpraxen"
                  data-testid="input-title"
                />
              </div>
              
              <div>
                <Label htmlFor="category">Kategorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={value => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="tags">Tags (kommagetrennt)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="z.B. Effizienz, Wartezeit, Patientenzufriedenheit"
                  data-testid="input-tags"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Beschreibung (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Kurze Beschreibung des Inhalts..."
                  data-testid="input-description"
                />
              </div>
              
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={!formData.file || !formData.title || !formData.category || uploadMutation.isPending}
                className="w-full"
                data-testid="button-submit-upload"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird verarbeitet...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Hochladen & Verarbeiten
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Wissen durchsuchen
          </CardTitle>
          <CardDescription>
            Testen Sie die semantische Suche in Ihrer Wissensbasis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="z.B. Wie optimiere ich die Wartezeiten?"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          
          {isSearching && (
            <div className="flex items-center gap-2 mt-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Suche...
            </div>
          )}
          
          {searchResults && searchResults.length > 0 && (
            <div className="mt-4 space-y-3">
              {searchResults.map((result, i) => (
                <div key={i} className="p-3 border rounded-lg bg-muted/30" data-testid={`search-result-${i}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{getCategoryLabel(result.source.category)}</Badge>
                    <span className="text-sm font-medium">{result.source.title}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {Math.round(result.similarity * 100)}% relevant
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {result.content}
                  </p>
                </div>
              ))}
            </div>
          )}
          
          {searchQuery.length > 2 && searchResults?.length === 0 && !isSearching && (
            <p className="mt-4 text-muted-foreground text-sm">
              Keine passenden Ergebnisse gefunden. Laden Sie mehr Wissen hoch.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Wissensbasis ({sources.length} Quellen)
          </CardTitle>
          <CardDescription>
            Alle hochgeladenen Coaching-Dokumente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Quellen...
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Noch keine Wissensquellen hochgeladen.</p>
              <p className="text-sm mt-1">
                Laden Sie Ihre Coaching-Dokumente hoch, um die KI mit Ihrem Fachwissen zu bereichern.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map(source => (
                <div
                  key={source.id}
                  className="flex items-start gap-3 p-4 border rounded-lg"
                  data-testid={`knowledge-source-${source.id}`}
                >
                  <FileText className="h-8 w-8 text-primary shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium">{source.title}</h3>
                    <p className="text-sm text-muted-foreground">{source.fileName}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge>{getCategoryLabel(source.category)}</Badge>
                      {source.tags.map((tag, i) => (
                        <Badge key={i} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                    {source.description && (
                      <p className="text-sm text-muted-foreground mt-2">{source.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(source.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${source.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
