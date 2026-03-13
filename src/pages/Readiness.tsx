import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  readinessQuestions,
  calculateScore,
  getResultLevel,
  type Answer,
} from "@/data/readinessData";
import { guides } from "@/data/guidesData";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Lightbulb,
  ClipboardCheck,
} from "lucide-react";

type Phase = "intro" | "questions" | "result";

const Readiness = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(
    Array(readinessQuestions.length).fill(null)
  );

  const handleAnswer = (value: Answer) => {
    const next = [...answers];
    next[current] = value;
    setAnswers(next);
    if (current < readinessQuestions.length - 1) {
      setCurrent(current + 1);
    } else {
      setPhase("result");
    }
  };

  const score = calculateScore(answers);
  const result = getResultLevel(score);

  const weakIndexes = answers
    .map((a, i) => (a === "partial" || a === "no" ? i : -1))
    .filter((i) => i >= 0);

  const restart = () => {
    setPhase("intro");
    setCurrent(0);
    setAnswers(Array(readinessQuestions.length).fill(null));
  };

  const answerBtnClass = (value: Answer, active: boolean) => {
    const base =
      "flex-1 min-w-[90px] min-h-[44px] py-3 px-4 rounded-xl text-base font-medium border-2 transition-all duration-200 ";
    if (!active)
      return (
        base +
        "border-border bg-card hover:border-primary/40 hover:bg-primary/5 text-foreground"
      );
    if (value === "yes") return base + "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
    if (value === "partial") return base + "border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    return base + "border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300";
  };

  if (phase === "intro") {
    return (
      <AppLayout centered>
        <section className="my-auto space-y-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <ClipboardCheck className="h-10 w-10 text-primary" />
          </div>

          <h1
            className="text-[28px] font-bold leading-tight md:text-[36px]"
            data-testid="text-readiness-title"
          >
            Проверим, насколько вы готовы к удалённой работе
          </h1>

          <p
            className="text-muted-foreground md:text-lg"
            data-testid="text-readiness-subtitle"
          >
            Короткая проверка из {readinessQuestions.length} вопросов. В конце вы
            получите результат и рекомендации — что уже хорошо, а что стоит
            немного подтянуть.
          </p>

          <Button
            variant="hero"
            className="w-full shadow-lg shadow-primary/20"
            onClick={() => setPhase("questions")}
            data-testid="button-start-readiness"
          >
            Проверить готовность
          </Button>

          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            data-testid="link-back-home"
          >
            <ArrowLeft className="h-4 w-4" />
            На главную
          </button>
        </section>
      </AppLayout>
    );
  }

  if (phase === "questions") {
    const q = readinessQuestions[current];
    const progress = ((current + (answers[current] ? 1 : 0)) / readinessQuestions.length) * 100;

    return (
      <AppLayout centered>
        <section className="my-auto space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Вопрос {current + 1} из {readinessQuestions.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6 md:p-8">
              <p
                className="text-lg font-medium leading-relaxed md:text-xl"
                data-testid={`text-question-${q.id}`}
              >
                {q.text}
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <button
              className={answerBtnClass("yes", answers[current] === "yes")}
              onClick={() => handleAnswer("yes")}
              data-testid="button-answer-yes"
            >
              Да
            </button>
            <button
              className={answerBtnClass("partial", answers[current] === "partial")}
              onClick={() => handleAnswer("partial")}
              data-testid="button-answer-partial"
            >
              Частично
            </button>
            <button
              className={answerBtnClass("no", answers[current] === "no")}
              onClick={() => handleAnswer("no")}
              data-testid="button-answer-no"
            >
              Нет
            </button>
          </div>

          {current > 0 && (
            <button
              onClick={() => setCurrent(current - 1)}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="button-prev-question"
            >
              <ArrowLeft className="h-4 w-4" />
              Предыдущий вопрос
            </button>
          )}
        </section>
      </AppLayout>
    );
  }

  const scoreColor =
    score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 50
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  const ScoreIcon =
    score >= 80 ? CheckCircle2 : score >= 50 ? AlertCircle : XCircle;

  return (
    <AppLayout>
      <button
        onClick={() => navigate("/")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        data-testid="link-back-home-result"
      >
        <ArrowLeft className="h-4 w-4" />
        На главную
      </button>

      <h1
        className="mb-6 text-[28px] font-bold md:text-[36px]"
        data-testid="text-result-heading"
      >
        Ваш результат
      </h1>

      <Card className="mb-6 border-0 shadow-md">
        <CardContent className="p-6 text-center md:p-8">
          <div className="mb-4 flex justify-center">
            <ScoreIcon className={`h-14 w-14 ${scoreColor}`} />
          </div>
          <p className={`mb-1 text-4xl font-bold ${scoreColor}`} data-testid="text-score">
            {score}%
          </p>
          <h2 className="mb-3 text-xl font-bold" data-testid="text-result-title">
            {result.title}
          </h2>
          <p className="text-muted-foreground" data-testid="text-result-desc">
            {result.text}
          </p>
        </CardContent>
      </Card>

      {weakIndexes.length > 0 && (
        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Рекомендации</h3>
          </div>
          {weakIndexes.map((idx) => {
            const q = readinessQuestions[idx];
            const isNo = answers[idx] === "no";
            const linkedGuide = q.guideId ? guides.find(g => g.id === q.guideId) : null;
            return (
              <Card
                key={idx}
                className={`border-l-4 ${isNo ? "border-l-red-400" : "border-l-amber-400"}`}
              >
                <CardContent className="p-4">
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    {q.text}
                  </p>
                  <p className="text-sm leading-relaxed">{q.recommendation}</p>
                  {linkedGuide && (
                    <button
                      onClick={() => navigate(`/guides/${linkedGuide.id}`)}
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      {linkedGuide.title}
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <Button
          variant="hero"
          className="w-full shadow-lg shadow-primary/20"
          onClick={() => navigate("/quiz")}
          data-testid="button-go-quiz"
        >
          <ArrowRight className="mr-2 h-4 w-4" />
          Пройти основной квиз HR-X
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/guides")}
          data-testid="button-go-guides"
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Посмотреть полезные гайды
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={restart}
          data-testid="button-restart-readiness"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Пройти проверку заново
        </Button>
      </div>
    </AppLayout>
  );
};

export default Readiness;
