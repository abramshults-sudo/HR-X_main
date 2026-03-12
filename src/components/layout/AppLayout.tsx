import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, UserCheck, LayoutDashboard } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  centered?: boolean;
}

export const AppLayout = ({ children, centered = false }: AppLayoutProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pb-2 pt-3 md:pb-4 md:pt-6 md:px-6">
        <Link to="/" className="text-2xl font-extrabold text-primary">
          HR-X
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
                data-testid="button-dashboard"
                className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-1"
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline text-sm">Кабинет</span>
              </Button>
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary sm:h-auto sm:w-auto sm:px-2.5 sm:py-1 sm:gap-1.5 sm:rounded-full"
                data-testid="text-user-email"
              >
                <UserCheck className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline text-sm font-medium max-w-[140px] truncate">{user.email}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-1"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline text-sm">Выйти</span>
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/auth")}
              data-testid="button-login"
              className="h-8 px-2 gap-1 sm:h-9 sm:px-3 sm:gap-1.5"
            >
              <LogIn className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Войти</span>
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>
      <main className={centered ? "mx-auto flex min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-88px)] w-full max-w-[540px] flex-col px-4 pb-6 md:pb-10" : "mx-auto w-full max-w-5xl px-4 pb-6 md:pb-10 md:px-6"}>
        {children}
      </main>
    </div>
  );
};
