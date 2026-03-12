import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { useHrxState } from "@/context/hrx-state";
import { useToast } from "@/hooks/use-toast";
import type { QuizState } from "@/types/hrx";

export interface PresetFilters {
  hideNotRecommended?: boolean;
  showScoring?: boolean;
  dateFilter?: "all" | "3" | "7" | "30";
  resumeMode?: "regular" | "ats";
}

export interface PresetItem {
  id: number;
  name: string;
  quizState: QuizState;
  filters?: PresetFilters;
  createdAt: string;
}

export function usePresets() {
  const { user } = useAuth();
  const { state, dispatch } = useHrxState();
  const { toast } = useToast();
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadPresets = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/presets", { credentials: "include" });
      if (res.ok) {
        const raw = await res.json();
        const data = raw.map((p: any) => {
          const filters = p.quizState?._filters || undefined;
          const quizState = { ...p.quizState };
          delete quizState._filters;
          return { ...p, quizState, filters };
        });
        setPresets(data);
      } else if (res.status === 401) {
        setPresets([]);
      }
    } catch {}
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadPresets();
  }, [user, loadPresets]);

  const applyPreset = useCallback(
    (preset: PresetItem, targetStep?: QuizState["currentStep"]) => {
      dispatch({
        type: "LOAD_QUIZ_STATE",
        payload: preset.quizState as QuizState,
        targetStep,
      });
      if (preset.filters) {
        if (
          preset.filters.hideNotRecommended !== undefined &&
          preset.filters.hideNotRecommended !== state.jobsState.hideNotRecommended
        ) {
          dispatch({ type: "TOGGLE_HIDE_NOT_RECOMMENDED" });
        }
        if (
          preset.filters.showScoring !== undefined &&
          preset.filters.showScoring !== state.jobsState.showScoring
        ) {
          dispatch({ type: "TOGGLE_SHOW_SCORING" });
        }
        if (preset.filters.dateFilter) {
          dispatch({ type: "SET_DATE_FILTER", payload: preset.filters.dateFilter });
        }
        if (preset.filters.resumeMode) {
          dispatch({ type: "SET_RESUME_MODE", payload: preset.filters.resumeMode });
        }
      }
      toast({
        title: "Пресет загружен",
        description: `«${preset.name}» — данные квиза и фильтры восстановлены`,
      });
    },
    [dispatch, state.jobsState.hideNotRecommended, state.jobsState.showScoring, toast],
  );

  const savePreset = useCallback(
    async (name: string) => {
      if (!name.trim()) return false;
      setIsSaving(true);
      try {
        const filters: PresetFilters = {
          hideNotRecommended: state.jobsState.hideNotRecommended,
          showScoring: state.jobsState.showScoring,
          dateFilter: state.jobsState.dateFilter,
          resumeMode: state.resumeState.resumeMode,
        };
        const res = await fetch("/api/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: name.trim(),
            quizState: state.quizState,
            filters,
          }),
        });
        if (res.ok) {
          toast({
            title: "Пресет сохранён",
            description: `«${name.trim()}» сохранён в вашем аккаунте`,
          });
          loadPresets();
          setIsSaving(false);
          return true;
        } else {
          const data = await res.json();
          toast({ title: "Ошибка", description: data.error, variant: "destructive" });
        }
      } catch {
        toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
      }
      setIsSaving(false);
      return false;
    },
    [state.quizState, state.jobsState, state.resumeState.resumeMode, toast, loadPresets],
  );

  const deletePreset = useCallback(
    async (preset: PresetItem) => {
      try {
        const res = await fetch(`/api/presets/${preset.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          toast({ title: "Удалено", description: `Пресет «${preset.name}» удалён` });
          loadPresets();
        }
      } catch {
        toast({ title: "Ошибка", description: "Не удалось удалить", variant: "destructive" });
      }
    },
    [toast, loadPresets],
  );

  return {
    presets,
    isLoading,
    isSaving,
    applyPreset,
    savePreset,
    deletePreset,
    loadPresets,
  };
}
