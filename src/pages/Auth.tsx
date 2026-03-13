import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = mode === "login" ? await login(email, password) : await register(email, password);

    setIsSubmitting(false);

    if (result.ok) {
      toast({
        title: mode === "login" ? "Вход выполнен" : "Регистрация завершена",
        description: mode === "login" ? "Добро пожаловать!" : "Аккаунт создан. Добро пожаловать!",
      });
      navigate("/quiz");
    } else {
      toast({
        title: "Ошибка",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout centered>
      <div className="flex flex-1 items-center justify-center py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle data-testid="text-auth-title" className="text-[22px] font-bold md:text-2xl">
              {mode === "login" ? "Вход в аккаунт" : "Регистрация"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login"
                ? "Войдите, чтобы сохранять настройки и результаты"
                : "Создайте аккаунт для сохранения данных"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Пароль
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "register" ? "Минимум 6 символов" : "Ваш пароль"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === "register" ? 6 : undefined}
                    className="pr-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                data-testid="button-auth-submit"
              >
                {isSubmitting ? (
                  "Загрузка..."
                ) : mode === "login" ? (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Войти
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Зарегистрироваться
                  </>
                )}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm text-primary underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                data-testid="button-toggle-auth-mode"
              >
                {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
