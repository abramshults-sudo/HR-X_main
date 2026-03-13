import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/SectionCard";
import { useAuth } from "@/context/auth-context";
import { useHrxState } from "@/context/hrx-state";
import { useToast } from "@/hooks/use-toast";
import { Archive, Save, Trash2, Loader2, FolderOpen } from "lucide-react";
import type { JobItem } from "@/types/hrx";

interface SavedResultItem {
  id: number;
  name: string;
  roleKeywords: string | null;
  jobCount: number;
  jobs: JobItem[];
  resumeText: string | null;
  createdAt: string;
}

export const ResultsArchive = () => {
  const { user } = useAuth();
  const { state, dispatch } = useHrxState();
  const { toast } = useToast();
  const [results, setResults] = useState<SavedResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    if (user) loadResults();
  }, [user]);

  const loadResults = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/results", { credentials: "include" });
      if (res.ok) {
        setResults(await res.json());
      } else if (res.status === 401) {
        setResults([]);
      } else {
        toast({ title: "Ошибка", description: "Не удалось загрузить архив", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Ошибка сети при загрузке архива", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: saveName.trim(),
          roleKeywords: state.quizState.targetRoles.join(", "),
          jobCount: state.jobsState.jobs.length,
          jobs: state.jobsState.jobs,
          resumeText: null,
          quizSnapshot: state.quizState,
        }),
      });
      if (res.ok) {
        toast({ title: "Результаты сохранены", description: `"${saveName.trim()}" — ${state.jobsState.jobs.length} вакансий` });
        setSaveName("");
        setShowSave(false);
        loadResults();
      } else {
        const data = await res.json();
        toast({ title: "Ошибка", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const handleLoad = (item: SavedResultItem) => {
    dispatch({ type: "SET_JOBS", payload: item.jobs });
    toast({ title: "Результаты загружены", description: `"${item.name}" — ${item.jobCount} вакансий` });
  };

  const handleDelete = async (item: SavedResultItem) => {
    try {
      const res = await fetch(`/api/results/${item.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: "Удалено", description: `Архив "${item.name}" удалён` });
        loadResults();
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось удалить", variant: "destructive" });
    }
  };

  if (!user) return null;

  return (
    <SectionCard title="Мои сохранённые поиски">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Сохраняйте результаты поиска, чтобы вернуться к ним позже.
          </p>
          {state.jobsState.jobs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSave(!showSave)}
              data-testid="button-toggle-save-results"
            >
              <Save className="mr-1 h-4 w-4" />
              Сохранить
            </Button>
          )}
        </div>

        {showSave && (
          <div className="flex gap-2">
            <Input
              placeholder="Название (напр. «Бухгалтер март 2026»)"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              data-testid="input-result-name"
            />
            <Button onClick={handleSave} disabled={isSaving || !saveName.trim()} data-testid="button-save-results">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Archive className="h-4 w-4" />
            Пока нет сохранённых результатов.
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                data-testid={`result-item-${item.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString("ru-RU")} · {item.jobCount} вакансий
                    {item.roleKeywords ? ` · ${item.roleKeywords.slice(0, 40)}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLoad(item)}
                    data-testid={`button-load-result-${item.id}`}
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item)}
                    data-testid={`button-delete-result-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
};
