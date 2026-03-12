import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { FileText, Search, Shield, Clock, Users, ClipboardCheck, BookOpen } from "lucide-react";

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
    icon: Shield,
    title: "Конфиденциальность",
    description: "Никакой регистрации и персональных данных не требуется",
  },
  {
    icon: Clock,
    title: "Быстро и просто",
    description: "Весь процесс занимает не более 10 минут",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <AppLayout centered>
      <section className="my-auto space-y-4 md:space-y-6 text-center">
        <div data-testid="text-hero-title">
          <h1 className="text-[32px] font-extrabold uppercase tracking-tight leading-none md:text-[44px]">
            Удалённая работа
          </h1>
          <p className="mt-2 text-base font-semibold text-primary md:text-xl" data-testid="text-hero-subtitle">
            Найдём все вакансии на удалёнке за 10 минут
          </p>
        </div>
        <p className="text-sm text-muted-foreground md:text-base">
          Пройдите короткий опрос — получите готовое резюме и подборку подходящих вакансий
        </p>

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
          Без регистрации. Без ввода личных данных. Первый этап бесплатно.
        </p>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground" data-testid="text-social-proof">
          <Users className="h-3.5 w-3.5" />
          <span>Более 2 000 человек уже составили резюме с HR-X</span>
        </div>

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
