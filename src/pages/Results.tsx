import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { JobSwiper } from "@/components/JobSwiper";
import { SectionCard } from "@/components/SectionCard";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHrxState } from "@/context/hrx-state";
import { useAuth } from "@/context/auth-context";
import { buildAtsKeywordReport, buildResumeText } from "@/data/mockResumeHelpers";
import { searchAllVacancies } from "@/services/jobApi";
import { downloadPdf, downloadDocx, downloadTxt, exportJobsCsv } from "@/services/exportResume";
import { ResultsArchive } from "@/components/ResultsArchive";
import { Paywall, PaywallUpgradeCard, FreeContentBanner } from "@/components/Paywall";
import { JobCard } from "@/components/JobCard";
import { Loader2, RefreshCw, AlertCircle, FileText, FileDown, FileSpreadsheet, Info, ShieldCheck, ArrowLeft, Gift, Clock, Sparkles, Copy, Check, Lightbulb } from "lucide-react";

const FREE_PREVIEW_JOBS = 3;

function formatCacheAge(cachedAt: string): string {
  const diff = Date.now() - new Date(cachedAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ч. назад`;
}

const Results = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useHrxState();
  const { hasPaid } = useAuth();
  const atsReport = buildAtsKeywordReport(state.quizState);
  const resumeText = buildResumeText(state.quizState, state.resumeState.resumeMode);
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

  const activeResumeText = showAiResume && aiResume ? aiResume : resumeText;

  const handleExportPdf = () => downloadPdf(activeResumeText, "resume.pdf");
  const handleExportDocx = () => downloadDocx(activeResumeText, "resume.docx");
  const handleExportTxt = () => downloadTxt(activeResumeText, "resume.txt");

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
          mode: state.resumeState.resumeMode,
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
    } catch {
      setAiError("Ошибка сети. Попробуйте позже.");
    } finally {
      setAiLoading(false);
    }
  }, [state.quizState, state.resumeState.resumeMode]);

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

  const jobsLoaded = !state.jobsState.isLoading && !state.jobsState.error && state.jobsState.jobs.length > 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6 md:space-y-8">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-primary" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>
        <h1 className="text-[28px] font-bold md:text-[32px]" data-testid="text-results-title">Результаты</h1>

        {!hasPaid && <FreeContentBanner />}

        <Tabs defaultValue="resume" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-card bg-secondary p-2">
            <TabsTrigger value="resume" className="min-h-[56px] rounded-button text-base" data-testid="tab-resume">Резюме</TabsTrigger>
            <TabsTrigger value="jobs" className="min-h-[56px] rounded-button text-base" data-testid="tab-jobs">Вакансии</TabsTrigger>
            <TabsTrigger value="more" className="min-h-[56px] rounded-button text-base" data-testid="tab-more">Экспорт</TabsTrigger>
          </TabsList>

          {/* ── RESUME TAB ── */}
          <TabsContent value="resume" className="space-y-4">
            <div className="rounded-card border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold">Выберите формат резюме:</p>
              <div className="grid gap-2 md:grid-cols-2">
                <Button
                  variant={state.resumeState.resumeMode === "regular" ? "hero" : "outline"}
                  onClick={() => dispatch({ type: "SET_RESUME_MODE", payload: "regular" })}
                  className="h-auto min-h-[56px] flex-col items-start gap-1 whitespace-normal px-4 py-3 text-left"
                  data-testid="button-resume-regular"
                >
                  <span className="text-base font-bold">Обычное</span>
                  <span className="text-xs font-normal opacity-80">Готовый текст для отправки работодателю по электронной почте или через сайт</span>
                </Button>
                <Button
                  variant={state.resumeState.resumeMode === "ats" ? "hero" : "outline"}
                  onClick={() => dispatch({ type: "SET_RESUME_MODE", payload: "ats" })}
                  className="h-auto min-h-[56px] flex-col items-start gap-1 whitespace-normal px-4 py-3 text-left"
                  data-testid="button-resume-ats"
                >
                  <span className="text-base font-bold">ATS-версия</span>
                  <span className="text-xs font-normal opacity-80">Для размещения на hh.ru и других сайтах — содержит ключевые слова для автоматического подбора</span>
                </Button>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-secondary p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {state.resumeState.resumeMode === "regular" ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Обычное резюме</span> — это готовый текст, который можно скопировать и отправить работодателю. Подходит для электронной почты, мессенджеров и прямых откликов.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">ATS-версия</span> — специальный формат для сайтов поиска работы (hh.ru, SuperJob). Содержит ключевые слова, которые помогают системе автоматически подобрать ваше резюме для подходящих вакансий.
                  </p>
                )}
              </div>
            </div>

            {hasPaid ? (
              <>
                <div className="rounded-card border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <span className="font-semibold">ИИ-генерация резюме</span>
                    </div>
                    {aiResume && (
                      <div className="flex gap-2">
                        <Button
                          variant={showAiResume ? "hero" : "outline"}
                          size="sm"
                          onClick={() => setShowAiResume(true)}
                        >
                          ИИ-версия
                        </Button>
                        <Button
                          variant={!showAiResume ? "hero" : "outline"}
                          size="sm"
                          onClick={() => setShowAiResume(false)}
                        >
                          Шаблон
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ИИ составит профессиональное резюме на основе ваших данных — живым деловым языком, с правильной структурой и акцентами.
                  </p>
                  <Button
                    variant="hero"
                    onClick={handleAiGenerate}
                    disabled={aiLoading}
                    className="gap-2"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Генерация... 15-20 сек.
                      </>
                    ) : aiResume ? (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Сгенерировать заново
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Сгенерировать резюме с ИИ
                      </>
                    )}
                  </Button>
                  {aiError && (
                    <p className="text-sm text-destructive">{aiError}</p>
                  )}
                </div>

                {aiTips.length > 0 && showAiResume && (
                  <div className="rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Рекомендации по улучшению</span>
                    </div>
                    <ul className="list-disc pl-6 space-y-1 text-sm text-amber-700 dark:text-amber-400">
                      {aiTips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <SectionCard title={showAiResume && aiResume ? "Резюме (ИИ-версия)" : "Текст резюме"}>
                  <div className="relative">
                    {showAiResume && aiResume && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute right-0 top-0"
                        onClick={handleAiCopy}
                      >
                        {aiCopied ? (
                          <><Check className="mr-1 h-4 w-4" />Скопировано</>
                        ) : (
                          <><Copy className="mr-1 h-4 w-4" />Копировать</>
                        )}
                      </Button>
                    )}
                    <div className={`whitespace-pre-wrap text-sm ${showAiResume && aiResume ? "pt-8" : ""}`} data-testid="text-resume-content">
                      {activeResumeText}
                    </div>
                  </div>
                </SectionCard>

                {state.resumeState.resumeMode === "ats" && !showAiResume && (
                  <SectionCard title="Ключевые слова ATS">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
                        <span className="mt-0.5 text-emerald-600">✓</span>
                        <div>
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Включены в резюме:</p>
                          <p className="text-sm text-emerald-600 dark:text-emerald-400">{atsReport.included.join(", ")}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950">
                        <span className="mt-0.5 text-amber-600">!</span>
                        <div>
                          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Рекомендуем добавить:</p>
                          <p className="text-sm text-amber-600 dark:text-amber-400">{atsReport.missing.join(", ")}</p>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Скачать {showAiResume && aiResume ? "ИИ-резюме" : "резюме"}:</p>
                  <p className="text-xs text-muted-foreground">Выберите удобный формат. Файл сохранится на ваше устройство.</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <Button variant="soft" onClick={handleExportPdf} className="gap-2" data-testid="button-export-pdf">
                      <FileText className="h-4 w-4" />
                      Скачать PDF
                    </Button>
                    <Button variant="soft" onClick={handleExportDocx} className="gap-2" data-testid="button-export-docx">
                      <FileDown className="h-4 w-4" />
                      Скачать DOCX
                    </Button>
                    <Button variant="soft" onClick={handleExportTxt} className="gap-2" data-testid="button-export-txt">
                      <FileDown className="h-4 w-4" />
                      Скачать TXT
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <SectionCard title="Предпросмотр резюме">
                  <div className="flex items-center gap-2 mb-3 text-sm text-emerald-700 dark:text-emerald-400">
                    <Gift className="h-4 w-4 shrink-0" />
                    <span className="font-medium">Бесплатно — начало вашего резюме</span>
                  </div>
                  <Paywall previewLabel="Полный текст и скачивание — в полной версии">
                    <div className="whitespace-pre-wrap text-sm" data-testid="text-resume-content">{resumeText}</div>
                  </Paywall>
                </SectionCard>

                <PaywallUpgradeCard feature="Полное резюме и скачивание" />
              </>
            )}
          </TabsContent>

          {/* ── JOBS TAB ── */}
          <TabsContent value="jobs" className="space-y-4">
            {hasPaid && (
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
                    title="Обновить вакансии (загрузить свежие данные)"
                    data-testid="button-refresh-jobs"
                  >
                    <RefreshCw className={`h-5 w-5 ${state.jobsState.isLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                {cachedAt && !state.jobsState.isLoading && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground" data-testid="text-cache-info">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>
                      {fromCache
                        ? `Вакансии из кэша (найдены ${formatCacheAge(cachedAt)})`
                        : `Вакансии загружены ${formatCacheAge(cachedAt)}`
                      }
                    </span>
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

                <label className="flex min-h-[56px] items-center justify-between rounded-card border border-border bg-card px-4">
                  <span className="font-semibold">Дата публикации</span>
                  <select
                    value={state.jobsState.dateFilter}
                    onChange={(e) => dispatch({ type: "SET_DATE_FILTER", payload: e.target.value as "all" | "3" | "7" | "30" })}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    data-testid="select-date-filter"
                  >
                    <option value="all">Все</option>
                    <option value="3">Последние 3 дня</option>
                    <option value="7">Последние 7 дней</option>
                    <option value="30">Последние 30 дней</option>
                  </select>
                </label>

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
                      <p>Каждая компания получает оценку от 0 до 100 баллов. Мы проверяем:</p>
                      <ul className="space-y-1 pl-1">
                        <li className="flex items-start gap-2"><span className="text-emerald-600 shrink-0">+</span> Верификация на hh.ru (компания подтверждена площадкой)</li>
                        <li className="flex items-start gap-2"><span className="text-emerald-600 shrink-0">+</span> Наличие логотипа и полного профиля</li>
                        <li className="flex items-start gap-2"><span className="text-emerald-600 shrink-0">+</span> Адекватный уровень зарплаты для должности</li>
                        <li className="flex items-start gap-2"><span className="text-amber-600 shrink-0">!</span> Подозрительно высокие зарплаты без требований</li>
                        <li className="flex items-start gap-2"><span className="text-amber-600 shrink-0">!</span> Признаки сетевого маркетинга или финансовых пирамид</li>
                        <li className="flex items-start gap-2"><span className="text-amber-600 shrink-0">!</span> Расплывчатые описания без конкретных задач</li>
                      </ul>
                      <p className="rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Проверка автоматическая и не гарантирует 100% точности. Всегда изучайте вакансию самостоятельно перед откликом.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Включите, чтобы видеть оценку надёжности каждой компании и предупреждения о возможных рисках.
                    </p>
                  )}
                </div>
              </div>
            )}

            {state.jobsState.isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12" data-testid="status-jobs-loading">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Ищем вакансии на hh.ru и trudvsem.ru...</p>
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
                      <p className="font-semibold">Для поиска вакансий нужно пройти квиз</p>
                      <p className="text-sm text-muted-foreground">Вернитесь в квиз и выберите целевые должности на шаге 2. После этого вакансии загрузятся автоматически.</p>
                      <Button variant="hero" onClick={() => navigate("/quiz")} className="mt-2" data-testid="button-go-quiz">
                        Перейти к квизу
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Вакансий не найдено</p>
                      <p className="text-sm text-muted-foreground">Попробуйте нажать кнопку обновления или измените параметры поиска в квизе.</p>
                      <Button variant="outline" onClick={loadJobs} data-testid="button-search-again">Искать снова</Button>
                    </>
                  )}
                </div>
              </div>
            ) : hasPaid ? (
              <JobSwiper />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <Gift className="h-4 w-4 shrink-0" />
                  <span className="font-medium">
                    Бесплатно — {FREE_PREVIEW_JOBS} вакансии из {state.jobsState.jobs.length} найденных
                  </span>
                </div>

                {state.jobsState.jobs.slice(0, FREE_PREVIEW_JOBS).map((job) => (
                  <JobCard key={job.id} job={job} showScoring={state.jobsState.showScoring} />
                ))}

                {state.jobsState.jobs.length > FREE_PREVIEW_JOBS && (
                  <div className="rounded-card border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Ещё <span className="font-semibold text-foreground">{state.jobsState.jobs.length - FREE_PREVIEW_JOBS}</span> вакансий доступны в полной версии
                    </p>
                  </div>
                )}

                <PaywallUpgradeCard feature="Все вакансии и фильтры" />
              </div>
            )}
          </TabsContent>

          {/* ── EXPORT TAB ── */}
          <TabsContent value="more" className="space-y-4">
            {hasPaid && <ResultsArchive />}

            {hasPaid ? (
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
            ) : (
              <PaywallUpgradeCard feature="Экспорт и архив" />
            )}

            <SectionCard title="Как пользоваться приложением">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
                  <p><span className="font-semibold text-foreground">Квиз</span> — ответьте на вопросы о вашем опыте и пожеланиях. Это занимает 3–5 минут.</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
                  <p><span className="font-semibold text-foreground">Резюме</span> — на основе ваших ответов мы составим готовое резюме. Скачайте его в PDF или DOCX.</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">3</span>
                  <p><span className="font-semibold text-foreground">Вакансии</span> — мы автоматически найдём удалённые вакансии с hh.ru и Работа России. Листайте карточки: вправо — сохранить, влево — пропустить.</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">4</span>
                  <p><span className="font-semibold text-foreground">Экспорт</span> — скачайте резюме и список вакансий на ваш компьютер или телефон.</p>
                </div>
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
