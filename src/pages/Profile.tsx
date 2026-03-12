import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Search, Eye, Lock, Briefcase, ShieldCheck, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ResumePreviewCard } from "@/components/ResumePreviewCard";
import { SectionCard } from "@/components/SectionCard";
import { JobCard } from "@/components/JobCard";
import { PaywallUpgradeCard } from "@/components/Paywall";
import { useHrxState } from "@/context/hrx-state";
import { useAuth } from "@/context/auth-context";
import { buildProfileSummary, mockResumePreview } from "@/data/mockResumeHelpers";
import { searchAllVacancies } from "@/services/jobApi";

const FREE_PREVIEW_JOBS = 3;

const Profile = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useHrxState();
  const { hasPaid } = useAuth();
  const summary = buildProfileSummary(state.quizState);

  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [previewJobs, setPreviewJobs] = useState<typeof state.jobsState.jobs>([]);
  const [totalJobs, setTotalJobs] = useState(0);

  const loadJobs = useCallback(async () => {
    if (state.quizState.targetRoles.length === 0) return;
    setJobsLoading(true);
    setJobsError(null);
    try {
      const result = await searchAllVacancies(state.quizState);
      setPreviewJobs(result.jobs);
      setTotalJobs(result.jobs.length);
      dispatch({ type: "SET_JOBS", payload: result.jobs });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось загрузить вакансии";
      setJobsError(msg);
    } finally {
      setJobsLoading(false);
    }
  }, [state.quizState, dispatch]);

  useEffect(() => {
    if (state.jobsState.searchCompleted && state.jobsState.jobs.length > 0) {
      setPreviewJobs(state.jobsState.jobs);
      setTotalJobs(state.jobsState.jobs.length);
    } else {
      loadJobs();
    }
  }, []);

  useEffect(() => {
    if (hasPaid) {
      navigate("/results", { replace: true });
    }
  }, [hasPaid, navigate]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6 md:space-y-8">
        <button type="button" onClick={() => navigate("/quiz")} className="flex items-center gap-1.5 text-sm font-semibold text-primary" data-testid="button-back-to-quiz">
          <ArrowLeft className="h-4 w-4" />
          Вернуться к квизу
        </button>
        <h1 className="text-[28px] font-bold md:text-[32px]">Ваш профессиональный профиль</h1>

        <SectionCard title="Краткое описание">
          {summary.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </SectionCard>

        <SectionCard title="Сильные стороны">
          <p>{state.quizState.professionalSkills.join(", ") || "Структурный подход, внимательность к деталям, спокойная коммуникация"}</p>
        </SectionCard>

        <SectionCard title="Целевые роли">
          <p>{state.quizState.targetRoles.join(", ") || "Роли пока не выбраны"}</p>
        </SectionCard>

        <SectionCard title="Ограничения">
          <p>{state.quizState.restrictions.join(", ") || "Ограничения пока не заданы"}</p>
        </SectionCard>

        <ResumePreviewCard preview={mockResumePreview} />

        {jobsLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8" data-testid="status-jobs-loading">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Ищем вакансии на hh.ru и trudvsem.ru...</p>
            <p className="text-sm text-muted-foreground">Это может занять 10–15 секунд</p>
          </div>
        ) : jobsError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">{jobsError}</p>
            <Button variant="outline" size="sm" onClick={loadJobs}>Попробовать снова</Button>
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
                  <p className="text-xs text-muted-foreground">{FREE_PREVIEW_JOBS} из них — бесплатно</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                Бесплатный предпросмотр — {FREE_PREVIEW_JOBS} вакансии:
              </span>
            </div>

            {previewJobs.slice(0, FREE_PREVIEW_JOBS).map((job) => (
              <JobCard key={job.id} job={job} showScoring={false} />
            ))}

            {totalJobs > FREE_PREVIEW_JOBS && (
              <div className="rounded-card border-2 border-dashed border-primary/20 bg-gradient-to-b from-muted/50 to-primary/5 p-6 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-lg font-bold">
                    Ещё {totalJobs - FREE_PREVIEW_JOBS} вакансий
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Подходящие удалённые вакансии подобраны специально под ваш опыт и навыки
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 rounded-full border bg-background px-2.5 py-1">
                    <Briefcase className="h-3 w-3" /> Свайпер вакансий
                  </span>
                  <span className="flex items-center gap-1 rounded-full border bg-background px-2.5 py-1">
                    <ShieldCheck className="h-3 w-3" /> Проверка компаний
                  </span>
                  <span className="flex items-center gap-1 rounded-full border bg-background px-2.5 py-1">
                    <Sparkles className="h-3 w-3" /> ИИ-адаптация резюме
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <PaywallUpgradeCard feature="Полное резюме, все вакансии и скачивание" />
      </div>
    </AppLayout>
  );
};

export default Profile;
