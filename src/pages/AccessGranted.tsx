import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { CheckCircle2, Sparkles, FileText, Search, ShieldCheck, ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export default function AccessGranted() {
  const navigate = useNavigate();
  const { hasPaid, isLoading } = useAuth();

  useEffect(() => {
    trackEvent("access_granted_view");
  }, []);

  useEffect(() => {
    if (!isLoading && !hasPaid) {
      navigate("/results", { replace: true });
    }
  }, [isLoading, hasPaid, navigate]);

  if (isLoading) return null;

  const features = [
    {
      icon: <Sparkles className="h-5 w-5 text-primary" />,
      title: "ИИ-адаптация резюме",
      desc: "Автоматическая подстройка резюме под каждую вакансию — повышает шансы на отклик",
    },
    {
      icon: <Search className="h-5 w-5 text-primary" />,
      title: "Все вакансии с фильтрами",
      desc: "Полный список подходящих вакансий с сортировкой по совпадению",
    },
    {
      icon: <FileText className="h-5 w-5 text-primary" />,
      title: "Скачивание резюме",
      desc: "Готовое резюме в PDF, DOCX или TXT — сразу отправляйте работодателям",
    },
    {
      icon: <ShieldCheck className="h-5 w-5 text-primary" />,
      title: "Проверка компаний",
      desc: "Оценка надёжности каждого работодателя перед откликом",
    },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-[28px] font-bold md:text-[32px]">Доступ открыт!</h1>
          <p className="text-muted-foreground">
            Все возможности HR-X теперь доступны вам без ограничений
          </p>
        </div>

        <Card className="text-left">
          <CardContent className="space-y-4 p-5">
            <p className="text-sm font-semibold text-primary">Что вам доступно:</p>
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{f.icon}</div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button
            variant="hero"
            className="w-full gap-2 text-base"
            onClick={() => navigate("/results")}
            data-testid="button-go-to-results"
          >
            Перейти к результатам
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Вы также можете вернуться к опросу и обновить данные в любое время
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
