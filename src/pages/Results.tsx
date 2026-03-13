import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/SectionCard";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHrxState } from "@/context/hrx-state";
import { useAuth } from "@/context/auth-context";
import { buildResumeText } from "@/data/mockResumeHelpers";
import { searchAllVacancies } from "@/services/jobApi";
import { downloadPdf, downloadDocx, downloadTxt, exportJobsCsv } from "@/services/exportResume";
import { ResultsArchive } from "@/components/ResultsArchive";
import { JobCard } from "@/components/JobCard";
import { PaywallUpgradeCard } from "@/components/Paywall";
import { Loader2, RefreshCw, AlertCircle, FileText, FileDown, FileSpreadsheet, Info, ShieldCheck, ArrowLeft, Clock, Sparkles, Copy, Check, Lightbulb, Search, UserPlus, Briefcase } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { JobStructuredData } from "@/components/JobStructuredData";

const FREE_PREVIEW_JOBS = 8;

function formatCacheAge(cachedAt: string): string {
  const diff = Date.now() - new Date(cachedAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ч. назад`;
}

function computeMatchScore(job: import("@/types/hrx").JobItem, quizState: import("@/types/hrx").QuizState): number {
  let score = 0;
  let total = 0;

  total += 40;
  const titleLower = (job.title || "").toLowerCase();
  const descLower = ((job.description || "") + " " + (job.requirements || "")).toLowerCase();
  let roleHits = 0;
  for (const role of quizState.targetRoles) {
    const keywords = role.toLowerCase().split(/[\s\/,]+/).filter(w => w.length > 2);
    if (keywords.some(kw => titleLower.includes(kw) || descLower.includes(kw))) {
      roleHits++;
    }
  }
  if (quizState.targetRoles.length > 0) {
    score += Math.min(40, (roleHits / Math.max(quizState.targetRoles.length, 1)) * 40);
  }

  total += 30;
  let skillHits = 0;
  const allSkills = [
    ...quizState.professionalSkills,
    ...Object.keys(quizState.programLevels).filter(k => quizState.programLevels[k] && quizState.programLevels[k] !== "none"),
  ];
  for (const skill of allSkills) {
    const kws = skill.toLowerCase().split(/[\s\/,]+/).filter(w => w.length > 2);
    if (kws.some(kw => descLower.includes(kw))) {
      skillHits++;
    }
  }
  if (allSkills.length > 0) {
    score += Math.min(30, (skillHits / Math.max(allSkills.length, 1)) * 30);
  }

  total += 20;
  if (quizState.salaryMin) {
    const minSalary = parseInt(quizState.salaryMin.replace(/\D/g, ""), 10);
    if (!minSalary || minSalary === 0) {
      score += 20;
    } else {
      const salaryText = (job.salary || "").replace(/\s/g, "");
      const nums = salaryText.match(/\d+/g);
      if (nums) {
        const maxJobSalary = Math.max(...nums.map(Number));
        if (maxJobSalary >= minSalary) score += 20;
        else if (maxJobSalary >= minSalary * 0.8) score += 10;
      } else {
        score += 10;
      }
    }
  } else {
    score += 20;
  }

  total += 10;
  score += 10;

  return Math.round((score / total) * 100);
}

const Results = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useHrxState();
  const { hasPaid, user } = useAuth();

  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [aiResume, setAiResume] = useState<string | null>(null);
  const [aiTips, setAiTips] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCopied, setAiCopied] = useState(false);
  const [showAiResume, setShowAiResume] = useState(false);

  const loadJobs = useCallback(async (forceRefresh = false) => {
    if (state.quizState.targetRoles.length === 0) {
      dispatch({ type: "SET_JOBS_ERROR", payload: "Для поиска вакансий выберите целевые должности в квизе." });
      return;
    }
    dispatch({ type: "SET_JOBS_LOADING", payload: true });
    try {
      const result = await searchAllVacancies(state.quizState, forceRefresh);
      dispatch({ type: "SET_JOBS", payload: result.jobs });
      setCachedAt(result.cachedAt);
      setFromCache(result.fromCache);
      trackEvent("job_search", { count: result.jobs.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось загрузить вакансии. Попробуйте ещё раз.";
      dispatch({ type: "SET_JOBS_ERROR", payload: msg });
    }
  }, [state.quizState, dispatch]);

  useEffect(() => {
    if (!state.jobsState.searchCompleted && !state.jobsState.isLoading) {
      loadJobs();
    }
  }, []);

  const resumeText = buildResumeText(state.quizState, "regular");
  const activeResumeText = showAiResume && aiResume ? aiResume : resumeText;

  const handleExportPdf = () => { trackEvent("resume_download", { format: "pdf" }); downloadPdf(activeResumeText, "resume.pdf"); };
  const handleExportDocx = () => { trackEvent("resume_download", { format: "docx" }); downloadDocx(activeResumeText, "resume.docx"); };
  const handleExportTxt = () => { trackEvent("resume_download", { format: "txt" }); downloadTxt(activeResumeText, "resume.txt"); };

  const handleAiGenerate = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          quizData: state.quizState,
          mode: "regular",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || "Ошибка генерации");
        return;
      }
      setAiResume(data.resumeText);
      setAiTips(data.tips || []);
      setShowAiResume(true);
      trackEvent("resume_generate");
    } catch {
      setAiError("Ошибка сети. Попробуйте позже.");
    } finally {
      setAiLoading(false);
    }
  }, [state.quizState]);

  const handleAiCopy = useCallback(async () => {
    if (!aiResume) return;
    try {
      await navigator.clipboard.writeText(aiResume);
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 2000);
    } catch {}
  }, [aiResume]);

  const handleExportProfile = () => {
    const { quizState } = state;
    const lines = [
      "ПРОФЕССИОНАЛЬНЫЙ ПРОФИЛЬ",
      "",
      `Регион: ${quizState.region?.name ?? "не указан"}`,
      `Рабочие часы (МСК): ${quizState.moscowHours.from}–${quizState.moscowHours.to}`,
      `Целевые роли: ${quizState.targetRoles.join(", ") || "не выбраны"}`,
      `Опыт: ${quizState.totalExperience || "не указан"}`,
      `Навыки: ${quizState.professionalSkills.join(", ") || "не указаны"}`,
      `График: ${quizState.schedules.join(", ") || "не указан"}`,
      `Зарплата: ${quizState.salaryMin || "не указана"}`,
      `Ограничения: ${quizState.restrictions.join(", ") || "нет"}`,
    ];
    downloadTxt(lines.join("\n"), "profile.txt");
  };

  const savedJobs = state.jobsState.jobs.filter((j) => state.jobsState.decisions[j.id] === "saved");
  const hasJobs = state.jobsState.jobs.length > 0;

  const handleExportVacancies = () => {
    const jobsToExport = savedJobs.length > 0 ? savedJobs : state.jobsState.jobs;
    if (jobsToExport.length === 0) return;
    exportJobsCsv(
      jobsToExport.map(j => ({
        ...j,
        scoringTotal: j.companyScore?.total,
        scoringLevel: j.companyScore?.level,
      })),
      "vacancies.csv"
    );
  };

  const [showLowMatch, setShowLowMatch] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "hh" | "tv">("all");

  const visibleJobs = useMemo(() => {
    let filtered = state.jobsState.hideNotRecommended
      ? state.jobsState.jobs.filter((j) => j.status !== "not_recommended")
      : state.jobsState.jobs;

    const { dateFilter } = state.jobsState;
    if (dateFilter !== "all") {
      const days = parseInt(dateFilter, 10);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((j) => {
        if (!j.publishedAt) return true;
        return new Date(j.publishedAt).getTime() >= cutoff;
      });
    }

    if (sourceFilter !== "all") {
      const sourceMatch = sourceFilter === "hh" ? "hh.ru" : "trudvsem.ru";
      filtered = filtered.filter((j) => j.source === sourceMatch);
    }

    return filtered;
  }, [state.jobsState.jobs, state.jobsState.hideNotRecommended, state.jobsState.dateFilter, sourceFilter]);

  const scoredJobs = useMemo(() => {
    return visibleJobs
      .map(job => ({
        job,
        matchScore: computeMatchScore(job, state.quizState),
      }))
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [visibleJobs, state.quizState]);
  const highMatchJobs = useMemo(() => scoredJobs.filter(j => j.matchScore >= 20), [scoredJobs]);
  const lowMatchJobs = useMemo(() => scoredJobs.filter(j => j.matchScore < 20), [scoredJobs]);
  const displayedScoredJobs = showLowMatch ? scoredJobs : highMatchJobs;

  if (state.quizState.targetRoles.length === 0 && !state.jobsState.isLoading && state.jobsState.jobs.length === 0) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-lg py-16 text-center space-y-4">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Нет данных</h1>
          <p className="text-muted-foreground">Пройдите опрос, чтобы увидеть резюме и подобранные вакансии.</p>
          <Button onClick={() => navigate("/quiz")} className="mt-4">Пройти опрос</Button>
        </div>
      </AppLayout>
    );
  }

  if (!hasPaid) {
    const totalJobs = state.jobsState.jobs.length;
    const freeJobs = scoredJobs.slice(0, FREE_PREVIEW_JOBS);
    const remainingCount = totalJobs - FREE_PREVIEW_JOBS;

    return (
      <AppLayout>
        <JobStructuredData jobs={state.jobsState.jobs} />
        <div className="mx-auto max-w-3xl space-y-6 md:space-y-8">
          <button type="button" onClick={() => navigate("/quiz")} className="flex items-center gap-1.5 text-sm font-semibold text-primary" data-testid="button-back-to-quiz">
            <ArrowLeft className="h-4 w-4" />
            Вернуться к опросу
          </button>
          <h1 className="text-[28px] font-bold md:text-[32px]">Результаты</h1>

          <SectionCard title="Ваше резюме">
            <div className="whitespace-pre-wrap text-sm">{resumeText}</div>
          </SectionCard>

          {!user && (
            <div className="flex items-start gap-3 rounded-card border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
              <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Зарегистрируйтесь, чтобы сохранить результаты</p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">Ваши данные не потеряются, и вы сможете вернуться к ним в любое время.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate("/auth")}>Создать аккаунт</Button>
              </div>
            </div>
          )}

          {state.jobsState.isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8" data-testid="status-jobs-loading">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Ищем вакансии по вашим параметрам...</p>
              <p className="text-sm text-muted-foreground">Это может занять 10–15 секунд</p>
            </div>
          ) : state.jobsState.error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">{state.jobsState.error}</p>
              <Button variant="outline" size="sm" onClick={() => loadJobs()}>Попробовать снова</Button>
            </div>
          ) : totalJobs > 0 ? (
            <div className="space-y-4">
              <div className="rounded-card border border-primary/20 bg-gradient-to-r from-primary/5 to-emerald-50 dark:from-primary/10 dark:to-emerald-950/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Search className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Найдено вакансий</p>
                      <p className="text-xs text-muted-foreground">по вашему профилю</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">{totalJobs}</p>
                  </div>
                </div>
              </div>

              {freeJobs.map(({ job, matchScore }) => (
                <JobCard key={job.id} job={job} showScoring={false} matchScore={matchScore} />
              ))}

              {remainingCount > 0 && (
                <div className="rounded-card border border-primary/20 bg-gradient-to-b from-muted/50 to-primary/5 p-6 text-center space-y-3">
                  <p className="text-lg font-bold">
                    Найдено ещё {remainingCount} вакансий по вашим параметрам
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Откройте полный список, скачайте резюме и адаптируйте его под каждую вакансию с помощью ИИ
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <PaywallUpgradeCard />
          <div className="h-20 md:hidden" />
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-sm md:hidden">
          <Button variant="hero" className="w-full text-base" data-testid="button-paywall-pay-mobile">
            Получить за 300 ₽ — разовый платёж
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <JobStructuredData jobs={state.jobsState.jobs} />
      <div className="mx-auto max-w-4xl space-y-6 md:space-y-8">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-primary" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>
        <h1 className="text-[28px] font-bold md:text-[32px]" data-testid="text-results-title">Результаты</h1>

        <Tabs defaultValue="resume" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-card bg-secondary p-2">
            <TabsTrigger value="resume" className="min-h-[56px] rounded-button text-base" data-testid="tab-resume">Резюме</TabsTrigger>
            <TabsTrigger value="jobs" className="min-h-[56px] rounded-button text-base" data-testid="tab-jobs">Вакансии</TabsTrigger>
            <TabsTrigger value="more" className="min-h-[56px] rounded-button text-base" data-testid="tab-more">Экспорт</TabsTrigger>
          </TabsList>

          <TabsContent value="resume" className="space-y-4">
            <div className="rounded-card border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-semibold">ИИ-генерация резюме</span>
                </div>
                {aiResume && (
                  <div className="flex gap-2">
                    <Button variant={showAiResume ? "hero" : "outline"} size="sm" onClick={() => setShowAiResume(true)}>ИИ-версия</Button>
                    <Button variant={!showAiResume ? "hero" : "outline"} size="sm" onClick={() => setShowAiResume(false)}>Шаблон</Button>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                ИИ составит профессиональное резюме на основе ваших данных — живым деловым языком, с правильной структурой и акцентами.
              </p>
              <Button variant="hero" onClick={handleAiGenerate} disabled={aiLoading} className="gap-2">
                {aiLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Генерация... 15-20 сек.</>
                ) : aiResume ? (
                  <><Sparkles className="h-4 w-4" />Сгенерировать заново</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Сгенерировать резюме с ИИ</>
                )}
              </Button>
              {aiError && <p className="text-sm text-destructive">{aiError}</p>}
            </div>

            {aiTips.length > 0 && showAiResume && (
              <div className="rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Рекомендации по улучшению</span>
                </div>
                <ul className="list-disc pl-6 space-y-1 text-sm text-amber-700 dark:text-amber-400">
                  {aiTips.map((tip, i) => <li key={i}>{tip}</li>)}
                </ul>
              </div>
            )}

            <SectionCard title={showAiResume && aiResume ? "Резюме (ИИ-версия)" : "Текст резюме"}>
              <div className="relative">
                {showAiResume && aiResume && (
                  <Button variant="outline" size="sm" className="absolute right-0 top-0" onClick={handleAiCopy}>
                    {aiCopied ? <><Check className="mr-1 h-4 w-4" />Скопировано</> : <><Copy className="mr-1 h-4 w-4" />Копировать</>}
                  </Button>
                )}
                <div className={`whitespace-pre-wrap text-sm ${showAiResume && aiResume ? "pt-8" : ""}`} data-testid="text-resume-content">
                  {activeResumeText}
                </div>
              </div>
            </SectionCard>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Скачать {showAiResume && aiResume ? "ИИ-резюме" : "резюме"}:</p>
              <p className="text-xs text-muted-foreground">Выберите удобный формат. Файл сохранится на ваше устройство.</p>
              <div className="grid gap-2 md:grid-cols-3">
                <Button variant="soft" onClick={handleExportPdf} className="gap-2" data-testid="button-export-pdf">
                  <FileText className="h-4 w-4" />Скачать PDF
                </Button>
                <Button variant="soft" onClick={handleExportDocx} className="gap-2" data-testid="button-export-docx">
                  <FileDown className="h-4 w-4" />Скачать DOCX
                </Button>
                <Button variant="soft" onClick={handleExportTxt} className="gap-2" data-testid="button-export-txt">
                  <FileDown className="h-4 w-4" />Скачать TXT
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <div className="flex items-start gap-2 rounded-card border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Нажмите «ИИ адаптация» у любой вакансии — ИИ подготовит резюме специально под неё
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="flex min-h-[56px] flex-1 items-center justify-between rounded-card border border-border bg-card px-4">
                  <span className="font-semibold">Скрыть не рекомендованные</span>
                  <Switch
                    checked={state.jobsState.hideNotRecommended}
                    onCheckedChange={() => dispatch({ type: "TOGGLE_HIDE_NOT_RECOMMENDED" })}
                    data-testid="switch-hide-not-recommended"
                  />
                </label>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-[56px] w-[56px] shrink-0"
                  onClick={() => loadJobs(true)}
                  disabled={state.jobsState.isLoading}
                  title="Обновить вакансии"
                  data-testid="button-refresh-jobs"
                >
                  <RefreshCw className={`h-5 w-5 ${state.jobsState.isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {cachedAt && !state.jobsState.isLoading && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground" data-testid="text-cache-info">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Вакансии обновлены {formatCacheAge(cachedAt)}</span>
                  {fromCache && (
                    <button
                      className="ml-auto text-primary hover:underline font-medium"
                      onClick={() => loadJobs(true)}
                      data-testid="button-force-refresh"
                    >
                      Обновить
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex min-h-[56px] items-center justify-between rounded-card border border-border bg-card px-4">
                  <span className="font-semibold">Дата</span>
                  <select
                    value={state.jobsState.dateFilter}
                    onChange={(e) => dispatch({ type: "SET_DATE_FILTER", payload: e.target.value as "all" | "3" | "7" | "30" })}
                    className="min-h-[44px] rounded-lg border border-border bg-background pl-3 pr-8 py-2 text-sm appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
                    data-testid="select-date-filter"
                  >
                    <option value="all">Все</option>
                    <option value="3">3 дня</option>
                    <option value="7">7 дней</option>
                    <option value="30">30 дней</option>
                  </select>
                </label>
                <label className="flex min-h-[56px] items-center justify-between rounded-card border border-border bg-card px-4">
                  <span className="font-semibold">Источник</span>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value as "all" | "hh" | "tv")}
                    className="min-h-[44px] rounded-lg border border-border bg-background pl-3 pr-8 py-2 text-sm appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
                    data-testid="select-source-filter"
                  >
                    <option value="all">Все</option>
                    <option value="hh">hh.ru</option>
                    <option value="tv">trudvsem.ru</option>
                  </select>
                </label>
              </div>

              <div className="rounded-card border border-border bg-card p-4 space-y-3">
                <label className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Проверка надёжности компаний</span>
                  </div>
                  <Switch
                    checked={state.jobsState.showScoring}
                    onCheckedChange={() => dispatch({ type: "TOGGLE_SHOW_SCORING" })}
                    data-testid="switch-show-scoring"
                  />
                </label>

                {state.jobsState.showScoring ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Каждая компания получает оценку от 0 до 100 баллов.</p>
                    <p className="rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Проверка автоматическая и не гарантирует 100% точности. Всегда изучайте вакансию перед откликом.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Включите, чтобы видеть оценку надёжности каждой компании.
                  </p>
                )}
              </div>
            </div>

            {state.jobsState.isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12" data-testid="status-jobs-loading">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Ищем новые вакансии по вашим параметрам...</p>
                <p className="text-sm text-muted-foreground">Это может занять 10–15 секунд</p>
              </div>
            ) : state.jobsState.error ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12" data-testid="status-jobs-error">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-center text-muted-foreground">{state.jobsState.error}</p>
                <Button variant="outline" onClick={loadJobs} data-testid="button-retry-jobs">Попробовать снова</Button>
              </div>
            ) : state.jobsState.jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-border bg-card p-6" data-testid="status-jobs-empty">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <div className="space-y-2 text-center">
                  {state.quizState.targetRoles.length === 0 ? (
                    <>
                      <p className="font-semibold">Для поиска вакансий нужно пройти опрос</p>
                      <p className="text-sm text-muted-foreground">Вернитесь и выберите целевые должности. После этого вакансии загрузятся автоматически.</p>
                      <Button variant="hero" onClick={() => navigate("/quiz")} className="mt-2" data-testid="button-go-quiz">
                        Перейти к опросу
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Вакансий не найдено</p>
                      <p className="text-sm text-muted-foreground">Попробуйте обновить или измените параметры поиска.</p>
                      <Button variant="outline" onClick={loadJobs} data-testid="button-search-again">Искать снова</Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground" data-testid="text-jobs-count">
                  Найдено: {displayedScoredJobs.length}{lowMatchJobs.length > 0 && !showLowMatch ? ` (ещё ${lowMatchJobs.length} с низким совпадением)` : ""}
                </p>
                {displayedScoredJobs.map(({ job, matchScore }) => (
                  <JobCard key={job.id} job={job} showScoring={state.jobsState.showScoring} matchScore={matchScore} />
                ))}
                {lowMatchJobs.length > 0 && !showLowMatch && (
                  <Button variant="outline" className="w-full" onClick={() => setShowLowMatch(true)}>
                    Показать все вакансии (включая с низким совпадением)
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="more" className="space-y-4">
            <ResultsArchive />

            <SectionCard title="Экспорт данных">
              <p className="text-sm text-muted-foreground mb-3">Скачайте ваш профиль или список вакансий на устройство.</p>
              <div className="grid gap-2 md:grid-cols-2">
                <Button variant="soft" onClick={handleExportProfile} className="gap-2" data-testid="button-export-profile">
                  <FileText className="h-4 w-4" />
                  Скачать профиль
                </Button>
                <Button
                  variant="soft"
                  onClick={handleExportVacancies}
                  disabled={!hasJobs}
                  className="gap-2"
                  data-testid="button-export-vacancies"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {hasJobs
                    ? savedJobs.length > 0
                      ? `Скачать сохранённые (${savedJobs.length})`
                      : `Скачать все вакансии (${state.jobsState.jobs.length})`
                    : "Сначала найдите вакансии"}
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Источники вакансий">
              <p className="text-sm text-muted-foreground">
                Вакансии загружаются в реальном времени из двух проверенных источников: <span className="font-semibold text-foreground">hh.ru</span> (HeadHunter) и <span className="font-semibold text-foreground">trudvsem.ru</span> (Работа России — государственный портал). Мы показываем только удалённые вакансии и проверяем надёжность каждой компании.
              </p>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Results;
