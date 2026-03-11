import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/SectionCard";
import { useHrxState } from "@/context/hrx-state";
import { useAuth } from "@/context/auth-context";
import { Loader2, CheckCircle, AlertTriangle, XCircle, Copy, Check } from "lucide-react";
import { buildResumeText } from "@/data/mockResumeHelpers";

interface AdaptResponse {
  adaptedResume: string;
  changes: string[];
  matchScore: number;
  matchDetails: {
    matched: string[];
    partial: string[];
    missing: string[];
  };
  hallucinationCheck: {
    score: number;
    verdict: string;
    hallucinations: string[];
  };
}

const AdaptResult = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useHrxState();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdaptResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const job = state.jobs.find((j) => j.id === id);

  const handleAdapt = useCallback(async () => {
    if (!job) return;

    setLoading(true);
    setError(null);

    try {
      const resumeText = buildResumeText(state, "regular");

      const vacancyParts = [
        job.description || "",
        job.requirements ? `\nТребования:\n${job.requirements}` : "",
      ].join("");

      const res = await fetch("/api/ai/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          resumeText,
          vacancyText: vacancyParts,
          vacancyTitle: job.title,
          companyName: job.company,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка при адаптации");
        return;
      }

      setResult(data);
    } catch {
      setError("Ошибка сети. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  }, [job, state]);

  const handleCopy = useCallback(async () => {
    if (!result?.adaptedResume) return;
    try {
      await navigator.clipboard.writeText(result.adaptedResume);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [result]);

  if (!job) {
    return (
      <AppLayout>
        <SectionCard title="Вакансия не найдена">
          <Button variant="hero" onClick={() => navigate("/results")}>
            Вернуться к результатам
          </Button>
        </SectionCard>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <SectionCard title="Необходима авторизация">
          <p className="text-muted-foreground mb-4">
            Войдите или зарегистрируйтесь, чтобы адаптировать резюме.
          </p>
          <Button variant="hero" onClick={() => navigate("/auth")}>
            Войти
          </Button>
        </SectionCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6 md:space-y-8">
        <div>
          <h1 className="text-[28px] font-bold md:text-[32px]">
            Адаптация резюме
          </h1>
          <p className="mt-1 text-muted-foreground">
            {job.title} — {job.company}
          </p>
        </div>

        {!result && !loading && (
          <SectionCard title="Как это работает">
            <ul className="list-disc space-y-1 pl-6 text-foreground text-sm">
              <li>ИИ проанализирует требования вакансии</li>
              <li>Адаптирует ваше резюме под конкретную позицию</li>
              <li>Интегрирует ключевые слова для прохождения ATS</li>
              <li>Приоритизирует релевантный опыт</li>
              <li>Проверит результат на выдуманные данные</li>
            </ul>
            <Button
              variant="hero"
              className="mt-4"
              onClick={handleAdapt}
              disabled={loading}
            >
              Адаптировать резюме
            </Button>
          </SectionCard>
        )}

        {loading && (
          <SectionCard title="Адаптация...">
            <div className="flex items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-muted-foreground">
                ИИ адаптирует резюме и проверяет на точность. Это может занять
                15-30 секунд...
              </p>
            </div>
          </SectionCard>
        )}

        {error && (
          <SectionCard title="Ошибка">
            <div className="flex items-start gap-2 text-destructive">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
            <Button variant="hero" className="mt-4" onClick={handleAdapt}>
              Попробовать снова
            </Button>
          </SectionCard>
        )}

        {result && (
          <>
            <SectionCard title="Шкала совпадения">
              <div className="space-y-2">
                <div className="h-3 rounded-full bg-secondary">
                  <div
                    className="h-3 rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(result.matchScore, 100)}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Совпадение с вакансией: {result.matchScore}%
                </p>
              </div>

              {result.matchDetails && (
                <div className="mt-4 space-y-3 text-sm">
                  {result.matchDetails.matched.length > 0 && (
                    <div>
                      <p className="font-semibold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle className="h-4 w-4" />
                        Совпадает
                      </p>
                      <ul className="mt-1 list-disc pl-6 text-muted-foreground">
                        {result.matchDetails.matched.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.matchDetails.partial.length > 0 && (
                    <div>
                      <p className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        Частично
                      </p>
                      <ul className="mt-1 list-disc pl-6 text-muted-foreground">
                        {result.matchDetails.partial.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.matchDetails.missing.length > 0 && (
                    <div>
                      <p className="font-semibold flex items-center gap-1.5 text-red-700 dark:text-red-400">
                        <XCircle className="h-4 w-4" />
                        Не хватает
                      </p>
                      <ul className="mt-1 list-disc pl-6 text-muted-foreground">
                        {result.matchDetails.missing.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Что изменилось">
              <ul className="list-disc space-y-1 pl-6 text-foreground text-sm">
                {result.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Проверка на достоверность">
              <div className="flex items-center gap-2">
                {result.hallucinationCheck.verdict === "PASSED" ||
                result.hallucinationCheck.verdict === "FIXED" ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                <span className="font-medium">
                  {result.hallucinationCheck.verdict === "PASSED"
                    ? "Проверка пройдена"
                    : result.hallucinationCheck.verdict === "FIXED"
                      ? "Галлюцинации обнаружены и исправлены"
                      : "Требует ручной проверки"}
                </span>
                <span className="text-sm text-muted-foreground">
                  — достоверность {result.hallucinationCheck.score}%
                </span>
              </div>
              {result.hallucinationCheck.hallucinations.length > 0 && (
                <ul className="mt-2 list-disc pl-6 text-sm text-amber-700 dark:text-amber-400">
                  {result.hallucinationCheck.hallucinations.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Адаптированное резюме">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-0 top-0"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="mr-1 h-4 w-4" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-4 w-4" />
                      Копировать
                    </>
                  )}
                </Button>
                <pre className="whitespace-pre-wrap text-sm pt-8">
                  {result.adaptedResume}
                </pre>
              </div>
            </SectionCard>

            <div className="flex gap-2">
              <Button variant="hero" onClick={handleAdapt} disabled={loading}>
                Переадаптировать
              </Button>
              <Button variant="soft" onClick={() => navigate("/results")}>
                К результатам
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AdaptResult;
