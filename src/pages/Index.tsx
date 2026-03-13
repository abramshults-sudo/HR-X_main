import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { FileText, Search, Sparkles, Clock, ClipboardCheck, BookOpen, Users } from "lucide-react";

const benefits = [
  {
    icon: FileText,
    title: "Готовое резюме",
    description: "Профессионально оформленное резюме на основе ваших ответов",
  },
  {
    icon: Search,
    title: "Подбор вакансий",
    description: "Список подходящих вакансий с учётом вашего опыта и навыков",
  },
  {
    icon: Sparkles,
    title: "Резюме под каждую вакансию",
    description: "ИИ подстраивает резюме специально под конкретного работодателя",
  },
  {
    icon: Clock,
    title: "Быстро и просто",
    description: "Весь процесс занимает не более 10 минут",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/user-count-public")
      .then((r) => r.json())
      .then((d) => { if (d.count > 0) setUserCount(d.count); })
      .catch(() => {});
  }, []);

  return (
    <AppLayout centered>
      <section className="my-auto space-y-4 md:space-y-6 text-center">
        <div data-testid="text-hero-title">
          <h1 className="text-[32px] font-extrabold uppercase tracking-tight leading-none md:text-[44px]">
            Удалённая работа
          </h1>
          <p className="mt-1 text-base text-muted-foreground">— с опытом и без</p>
          <p className="mt-2 text-base font-semibold text-primary md:text-xl" data-testid="text-hero-subtitle">
            Пройдите 10-минутный опрос — получите готовое резюме и список вакансий, подобранных под ваш опыт
          </p>
        </div>

        <div className="grid grid-cols-1 gap-1.5 text-left sm:grid-cols-2">
          {benefits.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-2.5 rounded-md p-2"
              data-testid={`card-benefit-${item.title}`}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="hero"
          className="w-full shadow-lg shadow-primary/20"
          onClick={() => navigate("/quiz")}
          data-testid="button-start-quiz"
        >
          Начать
        </Button>

        <p className="text-xs text-muted-foreground" data-testid="text-trust-note">
          Начать можно без регистрации. Для сохранения результатов — создайте аккаунт (бесплатно)
        </p>

        {userCount !== null && userCount > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground" data-testid="text-user-counter">
            <Users className="h-4 w-4" />
            <span>Уже воспользовались: <span className="font-semibold text-foreground">{userCount.toLocaleString("ru-RU")}</span> человек</span>
          </div>
        )}

        <div className="mx-auto h-px w-16 rounded-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={() => navigate("/readiness")}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
            data-testid="link-readiness"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Чек-лист готовности</p>
              <p className="text-xs text-muted-foreground leading-snug">Проверьте готовность к удалёнке</p>
            </div>
          </button>
          <button
            onClick={() => navigate("/guides")}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
            data-testid="link-guides"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Полезные гайды</p>
              <p className="text-xs text-muted-foreground leading-snug">Советы по резюме и собеседованиям</p>
            </div>
          </button>
        </div>
      </section>
    </AppLayout>
  );
};

export default Index;
