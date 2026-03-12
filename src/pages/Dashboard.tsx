import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useHrxState } from "@/context/hrx-state";
import { usePresets, type PresetItem } from "@/hooks/use-presets";
import { useToast } from "@/hooks/use-toast";
import { buildResumeText } from "@/data/mockResumeHelpers";
import {
  Bookmark,
  Heart,
  FileText,
  FolderOpen,
  Trash2,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Archive,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";
import type { JobItem } from "@/types/hrx";

interface SavedResultItem {
  id: number;
  name: string;
  roleKeywords: string | null;
  jobCount: number;
  jobs: JobItem[];
  resumeText: string | null;
  quizSnapshot: any;
  createdAt: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, hasPaid, isLoading: authLoading } = useAuth();
  const { state, dispatch } = useHrxState();
  const { toast } = useToast();
  const { presets, isLoading: presetsLoading, applyPreset, deletePreset } = usePresets();

  const [savedResults, setSavedResults] = useState<SavedResultItem[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [expandedResume, setExpandedResume] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const res = await fetch("/api/results", { credentials: "include" });
      if (res.ok) {
        setSavedResults(await res.json());
      } else if (res.status !== 401) {
        toast({ title: "Ошибка", description: "Не удалось загрузить архив результатов", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Ошибка сети при загрузке архива", variant: "destructive" });
    }
    setResultsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (user) loadResults();
  }, [user, loadResults]);

  const handleDeleteResult = async (item: SavedResultItem) => {
    try {
      const res = await fetch(`/api/results/${item.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: "Удалено", description: `Архив «${item.name}» удалён` });
        loadResults();
      }
    } catch {
      toast({ title: "Ошибка", description: "Не удалось удалить", variant: "destructive" });
    }
  };

  const handleLoadResult = (item: SavedResultItem) => {
    dispatch({ type: "SET_JOBS", payload: item.jobs });
    if (item.quizSnapshot) {
      dispatch({ type: "LOAD_QUIZ_STATE", payload: item.quizSnapshot, targetStep: 6 });
    }
    toast({ title: "Результаты загружены", description: `«${item.name}» — ${item.jobCount} вакансий` });
    navigate("/results");
  };

  const handleLoadPreset = (preset: PresetItem) => {
    applyPreset(preset, 6);
    navigate("/quiz");
  };

  const savedJobs = state.jobsState.jobs.filter(
    (j) => state.jobsState.decisions[j.id] === "saved"
  );

  const currentResumeText = state.quizState.targetRoles.length > 0
    ? buildResumeText(state.quizState, state.resumeState.resumeMode)
    : null;

  const handleCopyResume = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: "Скопировано" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="space-y-5 pb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold md:text-2xl">Личный кабинет</h1>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium">{user.email}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasPaid ? "Полный доступ активен" : "Бесплатный аккаунт"}
          </p>
        </div>

        <SectionCard title="Избранные вакансии" icon={<Heart className="h-4 w-4 text-primary" />}>
          {savedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Вы ещё не сохраняли вакансии. Отмечайте понравившиеся на странице результатов.
            </p>
          ) : (
            <div className="space-y-2">
              {savedJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.company}</p>
                    {job.salary && (
                      <p className="text-xs font-medium text-primary mt-0.5">{job.salary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {job.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => window.open(job.url, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {hasPaid && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => navigate(`/results/adapt/${job.id}`)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {hasPaid && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-1"
                  onClick={() => navigate("/results")}
                >
                  Перейти к результатам
                </Button>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Мои пресеты" icon={<Bookmark className="h-4 w-4 text-primary" />}>
          {presetsLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : presets.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground py-2">
                Пока нет сохранённых пресетов. Пройдите квиз и сохраните настройки на шаге 6.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/quiz")}>
                Пройти квиз
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{preset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(preset.createdAt).toLocaleDateString("ru-RU")}
                      {preset.quizState.targetRoles?.length > 0 && (
                        <span className="ml-1">
                          — {preset.quizState.targetRoles.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleLoadPreset(preset)}>
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deletePreset(preset)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Сохранённые результаты" icon={<Archive className="h-4 w-4 text-primary" />}>
          {resultsLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : savedResults.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Нет сохранённых результатов поиска. Сохраняйте их на странице результатов.
            </p>
          ) : (
            <div className="space-y-2">
              {savedResults.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-background"
                >
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("ru-RU")} · {item.jobCount} вакансий
                        {item.roleKeywords ? ` · ${item.roleKeywords.slice(0, 40)}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {item.resumeText && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedResume(expandedResume === item.id ? null : item.id)}
                        >
                          {expandedResume === item.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleLoadResult(item)}>
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteResult(item)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {expandedResume === item.id && item.resumeText && (
                    <div className="border-t border-border px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-muted-foreground">Резюме</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleCopyResume(item.resumeText!, item.id)}
                        >
                          {copiedId === item.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {copiedId === item.id ? "Скопировано" : "Копировать"}
                        </Button>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-60 overflow-y-auto">
                        {item.resumeText}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {currentResumeText && (
          <SectionCard title="Текущее резюме" icon={<FileText className="h-4 w-4 text-primary" />}>
            <div className="space-y-2">
              <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-3">
                {currentResumeText.slice(0, 500)}
                {currentResumeText.length > 500 && "..."}
              </pre>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(currentResumeText);
                    toast({ title: "Резюме скопировано" });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Копировать
                </Button>
                {hasPaid && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/results")}
                  >
                    К полной версии
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
