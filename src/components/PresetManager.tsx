import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { useHrxState } from "@/context/hrx-state";
import { useToast } from "@/hooks/use-toast";
import { Save, FolderOpen, Trash2, Loader2 } from "lucide-react";
import type { QuizState } from "@/types/hrx";

interface PresetFilters {
  hideNotRecommended?: boolean;
  showScoring?: boolean;
  dateFilter?: "all" | "3" | "7" | "30";
  resumeMode?: "regular" | "ats";
}

interface PresetItem {
  id: number;
  name: string;
  quizState: QuizState;
  filters?: PresetFilters;
  createdAt: string;
}

export const PresetManager = () => {
  const { user } = useAuth();
  const { state, dispatch } = useHrxState();
  const { toast } = useToast();
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [presetName, setPresetName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    if (user) loadPresets();
  }, [user]);

  const loadPresets = async () => {
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
      } else {
        toast({ title: "Ошибка", description: "Не удалось загрузить пресеты", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Ошибка сети при загрузке пресетов", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!presetName.trim()) return;
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
        body: JSON.stringify({ name: presetName.trim(), quizState: state.quizState, filters }),
      });
      if (res.ok) {
        toast({ title: "Пресет сохранён", description: `"${presetName.trim()}" сохранён в вашем аккаунте` });
        setPresetName("");
        setShowSave(false);
        loadPresets();
      } else {
        const data = await res.json();
        toast({ title: "Ошибка", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const handleLoad = (preset: PresetItem) => {
    dispatch({ type: "LOAD_QUIZ_STATE", payload: preset.quizState as QuizState });
    if (preset.filters) {
      if (preset.filters.hideNotRecommended !== undefined) {
        if (preset.filters.hideNotRecommended !== state.jobsState.hideNotRecommended) {
          dispatch({ type: "TOGGLE_HIDE_NOT_RECOMMENDED" });
        }
      }
      if (preset.filters.showScoring !== undefined) {
        if (preset.filters.showScoring !== state.jobsState.showScoring) {
          dispatch({ type: "TOGGLE_SHOW_SCORING" });
        }
      }
      if (preset.filters.dateFilter) {
        dispatch({ type: "SET_DATE_FILTER", payload: preset.filters.dateFilter });
      }
      if (preset.filters.resumeMode) {
        dispatch({ type: "SET_RESUME_MODE", payload: preset.filters.resumeMode });
      }
    }
    toast({ title: "Пресет загружен", description: `"${preset.name}" — данные квиза и фильтры восстановлены` });
  };

  const handleDelete = async (preset: PresetItem) => {
    try {
      const res = await fetch(`/api/presets/${preset.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Удалено", description: `Пресет "${preset.name}" удалён` });
        loadPresets();
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось удалить", variant: "destructive" });
    }
  };

  if (!user) return null;

  return (
    <div className="rounded-card border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-bold">Мои пресеты</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSave(!showSave)}
          data-testid="button-toggle-save-preset"
        >
          <Save className="mr-1 h-4 w-4" />
          Сохранить текущий
        </Button>
      </div>

      {showSave && (
        <div className="flex gap-2">
          <Input
            placeholder="Название пресета"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            data-testid="input-preset-name"
          />
          <Button onClick={handleSave} disabled={isSaving || !presetName.trim()} data-testid="button-save-preset">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : presets.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Пока нет сохранённых пресетов. Заполните квиз и нажмите «Сохранить текущий».
        </p>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
              data-testid={`preset-item-${preset.id}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{preset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(preset.createdAt).toLocaleDateString("ru-RU")}
                  {preset.filters && (
                    <span className="ml-1 text-muted-foreground/70">
                      {[
                        preset.filters.resumeMode === "ats" ? "ATS" : null,
                        preset.filters.showScoring ? "скоринг" : null,
                        preset.filters.dateFilter && preset.filters.dateFilter !== "all" ? `${preset.filters.dateFilter}д` : null,
                      ].filter(Boolean).join(", ") || null}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLoad(preset)}
                  data-testid={`button-load-preset-${preset.id}`}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(preset)}
                  data-testid={`button-delete-preset-${preset.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
