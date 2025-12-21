import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePractice } from "@/contexts/PracticeContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Staff, ContractType } from "@shared/schema";

interface EditStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
}

const ROLES = [
  { value: "doctor", labelKey: "roles.generalPractitioner" },
  { value: "dentist", labelKey: "roles.dentist" },
  { value: "nurse", labelKey: "roles.nurse" },
  { value: "receptionist", labelKey: "roles.receptionist" },
  { value: "assistant", labelKey: "roles.assistant" },
];

const CONTRACT_TYPES: { value: ContractType; labelKey: string }[] = [
  { value: "fulltime", labelKey: "staff.contractTypes.fulltime" },
  { value: "parttime", labelKey: "staff.contractTypes.parttime" },
  { value: "minijob", labelKey: "staff.contractTypes.minijob" },
  { value: "freelance", labelKey: "staff.contractTypes.freelance" },
];

// Standard full-time hours for VZÄ calculation
const FULLTIME_HOURS = 40;

// Calculate VZÄ from weekly hours
function calculateFte(weeklyHours: number): number {
  return Math.round((weeklyHours / FULLTIME_HOURS) * 100) / 100;
}

export function EditStaffDialog({ open, onOpenChange, staff }: EditStaffDialogProps) {
  const { t } = useTranslation();
  const { practiceId } = usePractice();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    role: "assistant",
    experienceLevel: 3,
    specializations: "",
    weeklyHours: 40,
    hourlyCost: 25,
    contractType: "fulltime" as ContractType,
  });

  // VZÄ is calculated automatically from weekly hours
  const calculatedFte = calculateFte(formData.weeklyHours);

  // Update form when staff changes
  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name,
        role: staff.role,
        experienceLevel: staff.experienceLevel,
        specializations: staff.specializations.join(", "),
        weeklyHours: staff.weeklyHours ?? 40,
        hourlyCost: staff.hourlyCost ?? 25,
        contractType: (staff.contractType as ContractType) ?? "fulltime",
      });
    }
  }, [staff]);

  const updateStaffMutation = useMutation({
    mutationFn: async (data: Partial<Staff>) => {
      if (!staff) throw new Error("No staff member selected");
      return api.staff.update(staff.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["hr-kpis", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["ai-analysis", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["staffing-demand", practiceId] });
      onOpenChange(false);
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async () => {
      if (!staff) throw new Error("No staff member selected");
      return api.staff.delete(staff.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["hr-kpis", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["ai-analysis", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["staffing-demand", practiceId] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const specializationsArray = formData.specializations
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    updateStaffMutation.mutate({
      name: formData.name,
      role: formData.role,
      avatar: formData.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2),
      experienceLevel: formData.experienceLevel,
      specializations: specializationsArray,
      fte: calculatedFte,
      weeklyHours: formData.weeklyHours,
      hourlyCost: formData.hourlyCost,
      contractType: formData.contractType,
    });
  };

  const isPending = updateStaffMutation.isPending || deleteStaffMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("staff.editDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("staff.editDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="edit-name">{t("staff.addDialog.name")}</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("staff.addDialog.namePlaceholder")}
                required
              />
            </div>

            {/* Role */}
            <div className="grid gap-2">
              <Label htmlFor="edit-role">{t("staff.addDialog.role")}</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {t(role.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contract Type */}
            <div className="grid gap-2">
              <Label htmlFor="edit-contractType">{t("staff.addDialog.contractType")}</Label>
              <Select
                value={formData.contractType}
                onValueChange={(value) => setFormData({ ...formData, contractType: value as ContractType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {t(ct.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weekly Hours & calculated VZÄ */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-weeklyHours">{t("staff.addDialog.weeklyHours")}</Label>
                <Input
                  id="edit-weeklyHours"
                  type="number"
                  min="1"
                  max="60"
                  value={formData.weeklyHours}
                  onChange={(e) => setFormData({ ...formData, weeklyHours: parseFloat(e.target.value) || 40 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("staff.addDialog.fteCalculated")}</Label>
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                  {calculatedFte} VZÄ
                </div>
              </div>
            </div>

            {/* Hourly Cost */}
            <div className="grid gap-2">
              <Label htmlFor="edit-hourlyCost">{t("staff.addDialog.hourlyCost")}</Label>
              <div className="relative">
                <Input
                  id="edit-hourlyCost"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.hourlyCost}
                  onChange={(e) => setFormData({ ...formData, hourlyCost: parseFloat(e.target.value) || 25 })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              </div>
            </div>

            {/* Experience Level */}
            <div className="grid gap-2">
              <Label>{t("staff.addDialog.experienceLevel")}</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, experienceLevel: level })}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={cn(
                        "h-6 w-6",
                        level <= formData.experienceLevel
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Specializations */}
            <div className="grid gap-2">
              <Label htmlFor="edit-specializations">{t("staff.addDialog.specializations")}</Label>
              <Input
                id="edit-specializations"
                value={formData.specializations}
                onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
                placeholder={t("staff.addDialog.specializationsPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("staff.addDialog.specializationsHint")}
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending}
                  className="sm:mr-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("common.delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("staff.deleteDialog.title")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("staff.deleteDialog.description", { name: staff?.name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteStaffMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteStaffMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("common.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isPending || !formData.name.trim()}>
                {updateStaffMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
