import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Ticket, CheckCircle2, Loader2, Gift, Star, Lock } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface PaywallProps {
  children: React.ReactNode;
  previewLabel?: string;
}

export function Paywall({ children, previewLabel }: PaywallProps) {
  const { hasPaid } = useAuth();

  if (hasPaid) return <>{children}</>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="pointer-events-none select-none">
          <div
            className="max-h-[200px] overflow-hidden"
            style={{
              maskImage: "linear-gradient(to bottom, black 30%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 30%, transparent 100%)",
            }}
          >
            {children}
          </div>
        </div>
        {previewLabel && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Gift className="h-4 w-4 shrink-0 text-primary" />
            <span>{previewLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PaywallBlock({ feature }: { feature?: string }) {
  const { hasPaid } = useAuth();
  if (hasPaid) return null;
  return <PaywallUpgradeCard feature={feature} />;
}

export function PaywallUpgradeCard({ feature }: { feature?: string }) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoSuccess, setPromoSuccess] = useState(false);

  const handlePromo = async () => {
    if (!promoCode.trim()) return;

    if (!user) {
      toast({
        title: "Нужна регистрация",
        description: "Чтобы применить промокод, войдите или зарегистрируйтесь.",
        variant: "destructive",
      });
      return;
    }

    setPromoLoading(true);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: promoCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.type === "free_access") {
          setPromoSuccess(true);
          trackEvent("promo_applied");
          await refreshUser();
          navigate("/access-granted");
        } else if (data.type === "discount") {
          toast({
            title: `Скидка ${data.value}%`,
            description: "Промокод принят. Скидка будет применена при оплате.",
          });
        } else {
          toast({
            title: "Промокод применён",
            description: `Бонус: ${data.value}`,
          });
        }
      } else {
        toast({
          title: "Ошибка",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Ошибка сети", variant: "destructive" });
    } finally {
      setPromoLoading(false);
    }
  };

  if (promoSuccess) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-b from-card to-primary/5">
      <CardContent className="space-y-5 p-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Полная версия — 300 ₽</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {feature
              ? `«${feature}» доступно в полной версии. Вот что вы получите:`
              : "Разблокируйте все возможности:"}
          </p>
        </div>

        <div className="space-y-2 rounded-xl bg-background/60 p-4">
          <div className="flex items-start gap-2.5 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <span className="font-medium">ИИ-адаптация резюме</span> — под каждую
              вакансию отдельно, чтобы повысить шансы
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <span className="font-medium">Все вакансии</span> — полный список
              с фильтрами и сортировкой
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <span className="font-medium">Полное резюме</span> — скачивание
              в PDF и DOCX
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <span className="font-medium">Проверка компаний</span> — оценка
              надёжности каждого работодателя
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            variant="hero"
            className="w-full text-base"
            data-testid="button-paywall-pay"
          >
            Получить за 300 ₽
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Одноразовый платёж. Не подписка.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Есть промокод?</p>
          </div>
          <div className="flex items-stretch gap-2">
            <Input
              placeholder="Введите промокод"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePromo()}
              className="h-11"
              data-testid="input-paywall-promo"
            />
            <Button
              variant="outline"
              onClick={handlePromo}
              disabled={promoLoading || !promoCode.trim()}
              className="h-11 shrink-0"
              data-testid="button-paywall-promo"
            >
              {promoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Применить"
              )}
            </Button>
          </div>
          {!user && (
            <p className="text-xs text-muted-foreground">
              Для промокода нужна{" "}
              <button
                onClick={() => navigate("/auth")}
                className="text-primary underline"
                data-testid="link-auth-promo"
              >
                регистрация
              </button>{" "}
              (бесплатно)
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FreeContentBanner({ totalJobs = 0 }: { totalJobs?: number }) {
  return (
    <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Gift className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Вы получили бесплатно:
            </p>
            <ul className="space-y-0.5 text-sm text-emerald-700 dark:text-emerald-400">
              <li>• Предпросмотр резюме (начало текста)</li>
              <li>• 8 подходящих вакансий{totalJobs > 8 ? ` из ${totalJobs} найденных` : " из найденных"}</li>
              <li>• Чек-лист готовности и полезные гайды</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
