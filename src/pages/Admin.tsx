import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Lock, LogOut, ScrollText, Ticket, Key, Users, RefreshCw, Trash2, Plus, ToggleLeft, ToggleRight, Loader2, ShieldCheck, Copy, Eye, EyeOff, UserCheck, UserX, TrendingUp, CreditCard } from "lucide-react";

interface AdminLog {
  id: number;
  category: string;
  action: string;
  details: any;
  ip: string | null;
  userId: number | null;
  createdAt: string;
}

interface PromoCode {
  id: number;
  code: string;
  type: string;
  value: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  comment: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface TrafficPeriod {
  views: number;
  unique: number;
  auth: number;
  guests: number;
}

interface Stats {
  users: number;
  paidUsers: number;
  activePromos: number;
  totalLogs: number;
  paymentEvents: number;
  traffic: {
    today: TrafficPeriod;
    week: TrafficPeriod;
    month: TrafficPeriod;
    total: { views: number; unique: number };
  };
  newUsers: {
    today: number;
    week: number;
    month: number;
  };
}

const api = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, { credentials: "include", ...options });
  return res;
};

const apiJson = async (url: string, body?: any) => {
  return api(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
};

export default function Admin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    api("/api/admin/check").then(r => r.json()).then(d => setIsAdmin(d.isAdmin)).catch(() => setIsAdmin(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await apiJson("/api/admin/login", { password });
      if (res.ok) {
        setIsAdmin(true);
        toast({ title: "Вход выполнен" });
      } else {
        const data = await res.json();
        toast({ title: "Ошибка", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка сети", description: "Не удалось подключиться к серверу", variant: "destructive" });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await apiJson("/api/admin/logout");
    setIsAdmin(false);
  };

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-bold">Админ-панель</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Пароль администратора"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="pr-10"
                    data-testid="input-admin-password"
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
              <Button type="submit" className="w-full" disabled={loginLoading} data-testid="button-admin-login">
                {loginLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Войти
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminDashboard onLogout={handleLogout} />;
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [logCategory, setLogCategory] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [newPromo, setNewPromo] = useState({ code: "", type: "discount", value: "10", maxUses: "100", expiresAt: "", comment: "" });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const loadStats = useCallback(async () => {
    try {
      const res = await api("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      toast({ title: "Ошибка", description: "Не удалось загрузить статистику", variant: "destructive" });
    }
  }, [toast]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const url = logCategory ? `/api/admin/logs?category=${logCategory}&limit=100` : "/api/admin/logs?limit=100";
      const res = await api(url);
      if (res.ok) setLogs(await res.json());
    } catch {
      toast({ title: "Ошибка", description: "Не удалось загрузить логи", variant: "destructive" });
    } finally {
      setLogsLoading(false);
    }
  }, [logCategory, toast]);

  const loadPromos = useCallback(async () => {
    setPromosLoading(true);
    try {
      const res = await api("/api/admin/promos");
      if (res.ok) setPromos(await res.json());
    } catch {
      toast({ title: "Ошибка", description: "Не удалось загрузить промокоды", variant: "destructive" });
    } finally {
      setPromosLoading(false);
    }
  }, [toast]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await api("/api/admin/settings");
      if (res.ok) setSettings(await res.json());
    } catch {
      toast({ title: "Ошибка", description: "Не удалось загрузить настройки", variant: "destructive" });
    } finally {
      setSettingsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const [activeTab, setActiveTab] = useState("logs");
  useEffect(() => {
    if (activeTab === "logs") loadLogs();
  }, [logCategory, activeTab, loadLogs]);

  const handleCreatePromo = async () => {
    const res = await apiJson("/api/admin/promos", {
      code: newPromo.code || undefined,
      type: newPromo.type,
      value: newPromo.value,
      maxUses: newPromo.maxUses,
      expiresAt: newPromo.expiresAt || undefined,
      comment: newPromo.comment || undefined,
    });
    if (res.ok) {
      toast({ title: "Промокод создан" });
      setNewPromo({ code: "", type: "discount", value: "10", maxUses: "100", expiresAt: "", comment: "" });
      loadPromos();
      loadStats();
    } else {
      const d = await res.json();
      toast({ title: "Ошибка", description: d.error, variant: "destructive" });
    }
  };

  const togglePromo = async (promo: PromoCode) => {
    const res = await api(`/api/admin/promos/${promo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !promo.active }),
    });
    if (res.ok) loadPromos();
  };

  const deletePromo = async (promo: PromoCode) => {
    const res = await api(`/api/admin/promos/${promo.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Удалено" });
      loadPromos();
      loadStats();
    }
  };

  const saveKey = async (key: string) => {
    const res = await api("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: editValue }),
    });
    if (res.ok) {
      toast({ title: "Ключ обновлён" });
      setEditingKey(null);
      setEditValue("");
      loadSettings();
    } else {
      const d = await res.json();
      toast({ title: "Ошибка", description: d.error, variant: "destructive" });
    }
  };

  const categoryLabels: Record<string, string> = {
    "": "Все",
    payment: "Оплата",
    promo: "Промокоды",
    admin: "Администрирование",
    settings: "Настройки",
  };

  const categoryColors: Record<string, string> = {
    payment: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
    promo: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300",
    admin: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    settings: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  };

  const settingLabels: Record<string, string> = {
    OPENAI_API_KEY: "OpenAI API Key",
    YOOKASSA_SHOP_ID: "ЮKassa Shop ID",
    YOOKASSA_SECRET_KEY: "ЮKassa Secret Key",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold">HR-X Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} data-testid="button-admin-logout">
            <LogOut className="mr-1 h-4 w-4" />
            Выйти
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard icon={<Users className="h-5 w-5" />} label="Всего пользователей" value={stats.users} />
              <StatCard icon={<CreditCard className="h-5 w-5" />} label="Оплативших" value={stats.paidUsers} />
              <StatCard icon={<Ticket className="h-5 w-5" />} label="Активных промо" value={stats.activePromos} />
              <StatCard icon={<ScrollText className="h-5 w-5" />} label="Всего логов" value={stats.totalLogs} />
              <StatCard icon={<Key className="h-5 w-5" />} label="Событий оплаты" value={stats.paymentEvents} />
            </div>

            <Card>
              <CardContent className="pt-4 pb-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> Посещения и пользователи</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-1.5 pr-3 font-semibold">Период</th>
                        <th className="text-right py-1.5 px-2 font-semibold"><Eye className="inline h-3.5 w-3.5 mr-0.5" />Просмотры</th>
                        <th className="text-right py-1.5 px-2 font-semibold"><Users className="inline h-3.5 w-3.5 mr-0.5" />Уникальные</th>
                        <th className="text-right py-1.5 px-2 font-semibold"><UserCheck className="inline h-3.5 w-3.5 mr-0.5" />Зарег.</th>
                        <th className="text-right py-1.5 px-2 font-semibold"><UserX className="inline h-3.5 w-3.5 mr-0.5" />Гости</th>
                        <th className="text-right py-1.5 pl-2 font-semibold"><Plus className="inline h-3.5 w-3.5 mr-0.5" />Новых</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-1.5 pr-3 font-medium">Сегодня</td>
                        <td className="text-right py-1.5 px-2">{stats.traffic.today.views}</td>
                        <td className="text-right py-1.5 px-2 font-semibold">{stats.traffic.today.unique}</td>
                        <td className="text-right py-1.5 px-2 text-emerald-600">{stats.traffic.today.auth}</td>
                        <td className="text-right py-1.5 px-2 text-muted-foreground">{stats.traffic.today.guests}</td>
                        <td className="text-right py-1.5 pl-2 text-blue-600">{stats.newUsers.today}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1.5 pr-3 font-medium">7 дней</td>
                        <td className="text-right py-1.5 px-2">{stats.traffic.week.views}</td>
                        <td className="text-right py-1.5 px-2 font-semibold">{stats.traffic.week.unique}</td>
                        <td className="text-right py-1.5 px-2 text-emerald-600">{stats.traffic.week.auth}</td>
                        <td className="text-right py-1.5 px-2 text-muted-foreground">{stats.traffic.week.guests}</td>
                        <td className="text-right py-1.5 pl-2 text-blue-600">{stats.newUsers.week}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1.5 pr-3 font-medium">30 дней</td>
                        <td className="text-right py-1.5 px-2">{stats.traffic.month.views}</td>
                        <td className="text-right py-1.5 px-2 font-semibold">{stats.traffic.month.unique}</td>
                        <td className="text-right py-1.5 px-2 text-emerald-600">{stats.traffic.month.auth}</td>
                        <td className="text-right py-1.5 px-2 text-muted-foreground">{stats.traffic.month.guests}</td>
                        <td className="text-right py-1.5 pl-2 text-blue-600">{stats.newUsers.month}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-3 font-medium">Всего</td>
                        <td className="text-right py-1.5 px-2">{stats.traffic.total.views}</td>
                        <td className="text-right py-1.5 px-2 font-semibold">{stats.traffic.total.unique}</td>
                        <td className="text-right py-1.5 px-2" colSpan={2}></td>
                        <td className="text-right py-1.5 pl-2 text-blue-600">{stats.users}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} className="space-y-4" onValueChange={(v) => {
          setActiveTab(v);
          if (v === "promos") loadPromos();
          if (v === "keys") loadSettings();
        }}>
          <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-lg bg-secondary p-1.5">
            <TabsTrigger value="logs" className="min-h-[44px] rounded-md text-sm font-semibold" data-testid="tab-admin-logs">
              <ScrollText className="mr-1.5 h-4 w-4" /> Логи
            </TabsTrigger>
            <TabsTrigger value="promos" className="min-h-[44px] rounded-md text-sm font-semibold" data-testid="tab-admin-promos">
              <Ticket className="mr-1.5 h-4 w-4" /> Промокоды
            </TabsTrigger>
            <TabsTrigger value="keys" className="min-h-[44px] rounded-md text-sm font-semibold" data-testid="tab-admin-keys">
              <Key className="mr-1.5 h-4 w-4" /> API-ключи
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(categoryLabels).map(([key, label]) => (
                <Button
                  key={key}
                  variant={logCategory === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLogCategory(key)}
                  data-testid={`button-log-filter-${key || "all"}`}
                >
                  {label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={loadLogs} data-testid="button-refresh-logs">
                <RefreshCw className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {logsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : logs.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Логов пока нет</p>
            ) : (
              <div className="space-y-1.5">
                {logs.map(log => (
                  <div key={log.id} className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-3" data-testid={`log-item-${log.id}`}>
                    <span className={`inline-block shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${categoryColors[log.category] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                      {log.category}
                    </span>
                    <span className="flex-1 font-medium">{log.action}</span>
                    {log.details && (
                      <span className="truncate text-xs text-muted-foreground max-w-[200px]" title={JSON.stringify(log.details)}>
                        {JSON.stringify(log.details)}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="promos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4" /> Создать промокод
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Код (пусто = авто)</label>
                    <Input value={newPromo.code} onChange={e => setNewPromo(p => ({ ...p, code: e.target.value }))} placeholder="PROMO2026" data-testid="input-promo-code" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Тип</label>
                    <select
                      value={newPromo.type}
                      onChange={e => setNewPromo(p => ({ ...p, type: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      data-testid="select-promo-type"
                    >
                      <option value="discount">Скидка (%)</option>
                      <option value="free_access">Бесплатный доступ</option>
                      <option value="bonus">Бонус</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Значение</label>
                    <Input type="number" value={newPromo.type === "free_access" ? "0" : newPromo.value} onChange={e => setNewPromo(p => ({ ...p, value: e.target.value }))} disabled={newPromo.type === "free_access"} data-testid="input-promo-value" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Макс. использований (0 = без лимита)</label>
                    <Input type="number" value={newPromo.maxUses} onChange={e => setNewPromo(p => ({ ...p, maxUses: e.target.value }))} data-testid="input-promo-max-uses" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Истекает</label>
                    <Input type="date" value={newPromo.expiresAt} onChange={e => setNewPromo(p => ({ ...p, expiresAt: e.target.value }))} data-testid="input-promo-expires" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Комментарий (кому выдан, назначение)</label>
                  <Input value={newPromo.comment} onChange={e => setNewPromo(p => ({ ...p, comment: e.target.value }))} placeholder="Например: тестовый доступ для Иванова А.А." data-testid="input-promo-comment" />
                </div>
                <Button onClick={handleCreatePromo} data-testid="button-create-promo">
                  <Plus className="mr-1 h-4 w-4" /> Создать
                </Button>
              </CardContent>
            </Card>

            {promosLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : promos.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Промокодов пока нет</p>
            ) : (
              <div className="space-y-2">
                {promos.map(promo => (
                  <div key={promo.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`promo-item-${promo.id}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-secondary px-2 py-0.5 text-sm font-bold">{promo.code}</code>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(promo.code); toast({ title: "Скопировано" }); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${promo.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
                          {promo.active ? "Активен" : "Неактивен"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {promo.type === "discount" ? `Скидка ${promo.value}%` : promo.type === "free_access" ? "Бесплатный доступ" : `Бонус: ${promo.value}`}
                        {" · "}Использований: {promo.usedCount}{promo.maxUses > 0 ? `/${promo.maxUses}` : " (∞)"}
                        {promo.expiresAt ? ` · до ${new Date(promo.expiresAt).toLocaleDateString("ru-RU")}` : ""}
                      </p>
                      {promo.comment && (
                        <p className="text-xs text-muted-foreground italic">{promo.comment}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => togglePromo(promo)} data-testid={`button-toggle-promo-${promo.id}`}>
                        {promo.active ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deletePromo(promo)} data-testid={`button-delete-promo-${promo.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="keys" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">API-ключи и интеграции</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {settingsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  Object.entries(settingLabels).map(([key, label]) => (
                    <div key={key} className="space-y-1.5">
                      <label className="text-sm font-semibold">{label}</label>
                      {editingKey === key ? (
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            placeholder="Введите новый ключ"
                            data-testid={`input-setting-${key}`}
                          />
                          <Button size="sm" onClick={() => saveKey(key)} data-testid={`button-save-setting-${key}`}>Сохранить</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingKey(null); setEditValue(""); }}>Отмена</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="flex-1 rounded bg-secondary px-3 py-2 text-sm">
                            {settings[key] || "Не установлен"}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingKey(key); setEditValue(""); }}
                            data-testid={`button-edit-setting-${key}`}
                          >
                            Изменить
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <p className="text-xs text-muted-foreground">
                  Ключи сохраняются в базе данных и применяются немедленно. При перезапуске сервера ключи из БД имеют приоритет над переменными окружения.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
