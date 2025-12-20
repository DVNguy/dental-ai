import { useState } from "react";
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
import { Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsertStaff, ContractType } from "@shared/schema";

interface AddStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function AddStaffDialog({ open, onOpenChange }: AddStaffDialogProps) {
  const { t } = useTranslation();
  const { practiceId } = usePractice();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    role: "assistant",
    experienceLevel: 3,
    specializations: "",
    fte: 1.0,
    weeklyHours: 40,
    hourlyCost: 25,
    contractType: "fulltime" as ContractType,
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: Omit<InsertStaff, "practiceId">) => {
      return api.staff.create(practiceId!, data as InsertStaff);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["hr-kpis", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["ai-analysis", practiceId] });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      role: "assistant",
      experienceLevel: 3,
      specializations: "",
      fte: 1.0,
      weeklyHours: 40,
      hourlyCost: 25,
      contractType: "fulltime",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const specializationsArray = formData.specializations
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    createStaffMutation.mutate({
      name: formData.name,
      role: formData.role,
      avatar: formData.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2),
      experienceLevel: formData.experienceLevel,
      specializations: specializationsArray,
      fte: formData.fte,
      weeklyHours: formData.weeklyHours,
      hourlyCost: formData.hourlyCost,
      contractType: formData.contractType,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("staff.addDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("staff.addDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">{t("staff.addDialog.name")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("staff.addDialog.namePlaceholder")}
                required
              />
            </div>

            {/* Role */}
            <div className="grid gap-2">
              <Label htmlFor="role">{t("staff.addDialog.role")}</Label>
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
              <Label htmlFor="contractType">{t("staff.addDialog.contractType")}</Label>
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

            {/* FTE & Weekly Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fte">{t("staff.addDialog.fte")}</Label>
                <Input
                  id="fte"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="1"
                  value={formData.fte}
                  onChange={(e) => setFormData({ ...formData, fte: parseFloat(e.target.value) || 1 })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="weeklyHours">{t("staff.addDialog.weeklyHours")}</Label>
                <Input
                  id="weeklyHours"
                  type="number"
                  min="1"
                  max="60"
                  value={formData.weeklyHours}
                  onChange={(e) => setFormData({ ...formData, weeklyHours: parseFloat(e.target.value) || 40 })}
                />
              </div>
            </div>

            {/* Hourly Cost */}
            <div className="grid gap-2">
              <Label htmlFor="hourlyCost">{t("staff.addDialog.hourlyCost")}</Label>
              <div className="relative">
                <Input
                  id="hourlyCost"
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
              <Label htmlFor="specializations">{t("staff.addDialog.specializations")}</Label>
              <Input
                id="specializations"
                value={formData.specializations}
                onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
                placeholder={t("staff.addDialog.specializationsPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("staff.addDialog.specializationsHint")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createStaffMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createStaffMutation.isPending || !formData.name.trim()}>
              {createStaffMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("staff.addDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
