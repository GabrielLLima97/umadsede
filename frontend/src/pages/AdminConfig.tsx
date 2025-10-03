import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { ADMIN_ROUTES } from "../constants/adminRoutes";
import { useAuth } from "../store/auth";
import { useToast } from "../store/toast";

type DashboardUser = {
  id: number;
  username: string;
  name?: string;
  allowed_routes: string[];
  is_active: boolean;
};

type UsersResponse = {
  results?: DashboardUser[];
  [key: string]: any;
};

type EditingState = {
  name: string;
  routes: string[];
  is_active: boolean;
  password: string;
};

type NewUserState = {
  username: string;
  name: string;
  password: string;
  routes: string[];
};

type AdminMetricsResponse = {
  timestamp: string;
  systems: { name: string; status: string; detail?: string }[];
  connections: {
    active_tokens: number;
    active_users: number;
    active_clients?: number;
    active_total?: number;
  };
  instance: {
    cpu_percent?: number;
    memory_percent?: number;
    memory_total?: number;
    memory_used?: number;
    disk_percent?: number;
    disk_total?: number;
    disk_used?: number;
    load_avg?: number[];
    uptime_seconds?: number;
  };
};

type MetricsHistoryPoint = {
  timestamp: string;
  active_users: number;
  active_tokens: number;
  active_total?: number;
};

type MetricsHistoryResponse = {
  start: string;
  end: string;
  interval_minutes: number;
  points: MetricsHistoryPoint[];
  summary?: {
    active_admins?: number;
    active_clients?: number;
    active_total?: number;
  };
};

type MetricsAlert = {
  severity: "warning" | "critical";
  title: string;
  message: string;
  hint?: string;
};

type SeverityLevel = "ok" | "warning" | "critical";

const CONFIG_TABS: { key: string; label: string; description: string; to: string; end?: boolean }[] = [
  {
    key: "users",
    label: "Usuários e acessos",
    description: "Gerencie perfis, permissões e acessos ao painel administrativo.",
    to: ".",
    end: true,
  },
  {
    key: "monitoramento",
    label: "Monitoramento (BI)",
    description: "Acompanhe métricas da VM, alertas de saúde e o movimento minuto a minuto de usuários.",
    to: "monitoramento",
  },
  {
    key: "reset-vendas",
    label: "Reset de vendas",
    description: "Limpe pedidos e vendas com segurança para reiniciar sua operação sem perder itens.",
    to: "reset-vendas",
  },
];

function resolveActiveTab(pathname: string): string {
  const base = "/admin/config";
  if (!pathname.startsWith(base)) return "users";
  const rest = pathname.slice(base.length).replace(/^\//, "");
  if (!rest) return "users";
  if (rest.startsWith("monitoramento")) return "monitoramento";
  if (rest.startsWith("reset-vendas")) return "reset-vendas";
  return "users";
}

export default function AdminConfig() {
  const location = useLocation();
  const activeKey = useMemo(() => resolveActiveTab(location.pathname), [location.pathname]);
  const activeTab = useMemo(() => CONFIG_TABS.find((tab) => tab.key === activeKey) ?? CONFIG_TABS[0], [activeKey]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-black">Configurações do painel</div>
          <p className="text-sm text-slate-600">{activeTab.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {CONFIG_TABS.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-brand-primary bg-brand-primary text-white shadow shadow-brand-primary/40"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-primary/40 hover:text-brand-primary"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <div className="space-y-6">
        <Outlet />
      </div>
    </div>
  );
}

export function ConfigUsersPage() {
  const { user } = useAuth();
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const response = await api.get<UsersResponse>("/admin/users/");
      const data = response.data;
      if (Array.isArray(data)) return data as DashboardUser[];
      return (data.results || []) as DashboardUser[];
    },
  });

  const routesQuery = useQuery({
    queryKey: ["admin", "routes"],
    queryFn: async () => {
      const response = await api.get("/admin/routes");
      return response.data as { key: string; label: string }[];
    },
  });

  const availableRoutes = useMemo(() => {
    if (routesQuery.data && Array.isArray(routesQuery.data)) {
      return routesQuery.data;
    }
    return ADMIN_ROUTES;
  }, [routesQuery.data]);

  const [newUser, setNewUser] = useState<NewUserState>(() => ({
    username: "",
    name: "",
    password: "",
    routes: availableRoutes.map((r) => r.key),
  }));
  const [savingNew, setSavingNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingState, setEditingState] = useState<Record<number, EditingState>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (usersQuery.data) {
      const map: Record<number, EditingState> = {};
      usersQuery.data.forEach((u) => {
        map[u.id] = {
          name: u.name || "",
          routes: [...(u.allowed_routes || [])],
          is_active: u.is_active,
          password: "",
        };
      });
      setEditingState(map);
    }
  }, [usersQuery.data]);

  useEffect(() => {
    setNewUser((prev) => {
      const availableKeys = new Set(availableRoutes.map((r) => r.key));
      const filtered = prev.routes.filter((route) => availableKeys.has(route));
      const routes = filtered.length > 0 ? filtered : Array.from(availableKeys);
      return { ...prev, routes };
    });
  }, [availableRoutes]);

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newUser.username || !newUser.password || newUser.routes.length === 0) {
      setFeedback("Preencha usuário, senha e ao menos uma rota.");
      return;
    }
    setSavingNew(true);
    setFeedback(null);
    try {
      await api.post("/admin/users/", {
        username: newUser.username,
        name: newUser.name,
        password: newUser.password,
        allowed_routes: newUser.routes,
      });
      setNewUser({ username: "", name: "", password: "", routes: availableRoutes.map((r) => r.key) });
      await usersQuery.refetch();
      setFeedback("Usuário criado com sucesso.");
    } catch (err: any) {
      const detail = err?.response?.data || err?.message || "Erro ao criar usuário.";
      setFeedback(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setSavingNew(false);
    }
  };

  const handleToggleRoute = (userId: number | "new", route: string) => {
    if (userId === "new") {
      setNewUser((prev) => {
        const routes = new Set(prev.routes);
        if (routes.has(route)) routes.delete(route);
        else routes.add(route);
        return { ...prev, routes: Array.from(routes) };
      });
    } else {
      setEditingState((prev) => {
        const current = prev[userId];
        if (!current) return prev;
        const routes = new Set(current.routes);
        if (routes.has(route)) routes.delete(route);
        else routes.add(route);
        return { ...prev, [userId]: { ...current, routes: Array.from(routes) } };
      });
    }
  };

  const handleSaveUser = async (userId: number) => {
    const state = editingState[userId];
    if (!state) return;
    setFeedback(null);
    try {
      await api.patch(`/admin/users/${userId}/`, {
        name: state.name,
        allowed_routes: state.routes,
        is_active: state.is_active,
        password: state.password || undefined,
      });
      setEditingId(null);
      await usersQuery.refetch();
      setFeedback("Dados do usuário atualizados.");
    } catch (err: any) {
      const detail = err?.response?.data || err?.message || "Erro ao salvar usuário.";
      setFeedback(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm("Deseja realmente remover este usuário?")) return;
    setFeedback(null);
    try {
      await api.delete(`/admin/users/${userId}/`);
      await usersQuery.refetch();
      setFeedback("Usuário removido.");
    } catch (err: any) {
      const detail = err?.response?.data || err?.message || "Erro ao remover usuário.";
      setFeedback(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-black">Usuários e permissões</div>
          <p className="text-sm text-slate-600">Gerencie contas do painel e defina quais áreas cada usuário pode acessar.</p>
        </div>
      </div>

      <section className="card space-y-4">
        <div className="font-black">Novo usuário</div>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateUser}>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Usuário
            <input
              className="input"
              value={newUser.username}
              onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="ex: joao"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Nome
            <input
              className="input"
              value={newUser.name}
              onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nome completo"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
            Senha
            <input
              className="input"
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="••••••"
              required
            />
          </label>
          <div className="md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Acesso às páginas</span>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {availableRoutes.map((route) => (
                <label key={route.key} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="accent-brand-primary"
                    checked={newUser.routes.includes(route.key)}
                    onChange={() => handleToggleRoute("new", route.key)}
                  />
                  {route.label}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="btn btn-primary min-h-[44px]" disabled={savingNew}>
              {savingNew ? "Criando..." : "Criar usuário"}
            </button>
          </div>
        </form>
      </section>

      {feedback && <div className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-700">{feedback}</div>}

      <section className="flex flex-col gap-3">
        <div className="text-xl font-black">Usuários</div>
        {usersQuery.isLoading && <div className="card">Carregando usuários...</div>}
        {!usersQuery.isLoading && usersQuery.data && usersQuery.data.length === 0 && (
          <div className="card">Nenhum usuário cadastrado.</div>
        )}
        {!usersQuery.isLoading && usersQuery.data && usersQuery.data.map((u) => {
          const editing = editingState[u.id] || { name: "", routes: [], is_active: true, password: "" };
          const isEditing = editingId === u.id;
          return (
            <div key={u.id} className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-black">{u.username}</div>
                  <div className="text-sm text-slate-500">{u.name || "(sem nome)"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                    {u.is_active ? "Ativo" : "Inativo"}
                  </span>
                  <button className="btn btn-ghost" onClick={() => setEditingId(isEditing ? null : u.id)}>
                    {isEditing ? "Fechar" : "Editar"}
                  </button>
                  {user && user.id !== u.id && (
                    <button className="btn" onClick={() => handleDeleteUser(u.id)}>
                      Remover
                    </button>
                  )}
                </div>
              </div>
              {isEditing && (
                <div className="space-y-3 border-t border-slate-200 pt-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                      Nome
                      <input
                        className="input"
                        value={editing.name}
                        onChange={(e) =>
                          setEditingState((prev) => ({
                            ...prev,
                            [u.id]: { ...editing, name: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        className="accent-brand-primary"
                        checked={editing.is_active}
                        onChange={(e) =>
                          setEditingState((prev) => ({
                            ...prev,
                            [u.id]: { ...editing, is_active: e.target.checked },
                          }))
                        }
                      />
                      Usuário ativo
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
                      Nova senha (opcional)
                      <input
                        type="password"
                        className="input"
                        value={editing.password}
                        onChange={(e) =>
                          setEditingState((prev) => ({
                            ...prev,
                            [u.id]: { ...editing, password: e.target.value },
                          }))
                        }
                        placeholder="Deixe em branco para manter a atual"
                      />
                    </label>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-700">Acesso às páginas</span>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {availableRoutes.map((route) => (
                        <label key={route.key} className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            className="accent-brand-primary"
                            checked={editing.routes.includes(route.key)}
                            onChange={() => handleToggleRoute(u.id, route.key)}
                          />
                          {route.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button className="btn" onClick={() => setEditingId(null)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={() => handleSaveUser(u.id)}>Salvar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

export function ConfigMonitoringPage() {
  const [minutes, setMinutes] = useState(180);

  const metricsQuery = useQuery<AdminMetricsResponse>({
    queryKey: ["admin", "metrics", "current"],
    queryFn: async () => {
      const response = await api.get("/admin/metrics");
      return response.data as AdminMetricsResponse;
    },
    refetchInterval: 15_000,
  });

  const historyQuery = useQuery<MetricsHistoryResponse>({
    queryKey: ["admin", "metrics", "history", minutes],
    queryFn: async () => {
      const response = await api.get(`/admin/metrics/history?minutes=${minutes}`);
      return response.data as MetricsHistoryResponse;
    },
    refetchInterval: 60_000,
  });

  const metrics = metricsQuery.data;
  const historyPoints = historyQuery.data?.points ?? [];
  const alerts = useMemo(() => buildAlerts(metrics), [metrics]);
  const timeframeOptions = [
    { value: 60, label: "1h" },
    { value: 180, label: "3h" },
    { value: 360, label: "6h" },
    { value: 720, label: "12h" },
  ];

  const cpuSeverity = getSeverity(metrics?.instance?.cpu_percent, 75, 90);
  const memorySeverity = getSeverity(metrics?.instance?.memory_percent, 75, 90);
  const diskSeverity = getSeverity(metrics?.instance?.disk_percent, 75, 90);

  const activeAdmins = metrics?.connections?.active_users ?? historyQuery.data?.summary?.active_admins ?? 0;
  const activeClients = metrics?.connections?.active_clients ?? historyQuery.data?.summary?.active_clients ?? 0;
  const activeTotalNow = metrics?.connections?.active_total ?? activeAdmins + activeClients;

  const memoryHelper =
    metrics?.instance?.memory_used !== undefined && metrics?.instance?.memory_total !== undefined
      ? `${formatBytes(metrics.instance.memory_used)} de ${formatBytes(metrics.instance.memory_total)}`
      : undefined;

  const diskHelper =
    metrics?.instance?.disk_used !== undefined && metrics?.instance?.disk_total !== undefined
      ? `${formatBytes(metrics.instance.disk_used)} de ${formatBytes(metrics.instance.disk_total)}`
      : undefined;

  const uptimeText = formatDuration(metrics?.instance?.uptime_seconds);
  const latestUpdate = metrics?.timestamp ? new Date(metrics.timestamp) : null;

  const historyStats = useMemo(() => {
    if (!historyPoints.length) return null;
    const values = historyPoints.map((point) => point.active_total ?? point.active_users);
    const peak = Math.max(...values);
    const average = values.reduce((acc, value) => acc + value, 0) / values.length;
    const lastPoint = historyPoints[historyPoints.length - 1];
    return {
      peak,
      average,
      last: lastPoint.active_total ?? lastPoint.active_users,
      lastTime: new Date(lastPoint.timestamp),
    };
  }, [historyPoints]);

  const historyLoading = historyQuery.isLoading && historyPoints.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {metricsQuery.isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          Não foi possível carregar os indicadores da VM. Tente novamente em instantes.
        </div>
      )}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Uso de CPU"
          value={metrics?.instance?.cpu_percent !== undefined ? `${Math.round(metrics.instance.cpu_percent)}%` : "--"}
          helper="Processamento instantâneo da VM"
          severity={cpuSeverity}
          icon={<CPUIcon className="h-4 w-4" />}
        />
        <MetricCard
          label="Memória em uso"
          value={metrics?.instance?.memory_percent !== undefined ? `${Math.round(metrics.instance.memory_percent)}%` : "--"}
          helper={memoryHelper}
          severity={memorySeverity}
          icon={<MemoryIcon className="h-4 w-4" />}
        />
        <MetricCard
          label="Disco ocupado"
          value={metrics?.instance?.disk_percent !== undefined ? `${Math.round(metrics.instance.disk_percent)}%` : "--"}
          helper={diskHelper}
          severity={diskSeverity}
          icon={<DiskIcon className="h-4 w-4" />}
        />
        <MetricCard
          label="Uptime"
          value={uptimeText}
          helper={latestUpdate ? `Último dado: ${formatDateTime(latestUpdate)}` : "Monitorando..."}
          severity="ok"
          icon={<ClockIcon className="h-4 w-4" />}
        />
      </section>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-black text-lg">Fluxo de usuários conectados</div>
            <p className="text-sm text-slate-600">Atualização contínua minuto a minuto.</p>
          </div>
          <div className="flex items-center gap-2">
            {timeframeOptions.map((option) => {
              const isActive = option.value === minutes;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMinutes(option.value)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    isActive ? "bg-brand-primary text-white shadow" : "bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                  disabled={historyQuery.isFetching && isActive}
                >
                  {option.label}
                </button>
              );
            })}
            {historyQuery.isFetching && historyPoints.length > 0 && (
              <span className="text-xs text-slate-400">Atualizando…</span>
            )}
          </div>
        </div>
        <ActiveUsersChart points={historyPoints} loading={historyLoading} />
        {historyQuery.isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            Não foi possível carregar o histórico no momento. Tente novamente em instantes.
          </div>
        )}
        <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
         <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Agora</div>
            <div className="text-2xl font-black text-slate-900">{activeTotalNow}</div>
            <div className="text-xs text-slate-500">Conexões ativas agora</div>
            <div className="text-[11px] text-slate-400">Admin: {activeAdmins} • Clientes: {activeClients}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pico</div>
            <div className="text-2xl font-black text-slate-900">{historyStats ? historyStats.peak : "--"}</div>
            <div className="text-xs text-slate-500">Maior simultaneidade no período</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Média</div>
            <div className="text-2xl font-black text-slate-900">{historyStats ? historyStats.average.toFixed(1) : "--"}</div>
            <div className="text-xs text-slate-500">Conexões por minuto</div>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="font-black">Saúde dos serviços essenciais</div>
        <div className="grid gap-3 md:grid-cols-2">
          {metrics?.systems?.map((system) => {
            const online = (system.status || "").toLowerCase() === "online";
            return (
              <div
                key={system.name}
                className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 transition ${
                  online ? "border-emerald-200 bg-emerald-50/70 text-emerald-800" : "border-rose-200 bg-rose-50/70 text-rose-700"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}`} />
                  {system.name}
                </div>
                <div className="text-xs uppercase tracking-[0.3em] opacity-80">{online ? "Online" : "Alerta"}</div>
                {system.detail && <div className="text-sm opacity-80">{system.detail}</div>}
              </div>
            );
          })}
        </div>
        {!metrics?.systems && <div className="text-sm text-slate-500">Carregando informações dos serviços…</div>}
      </section>

      <section className="card space-y-3">
        <div className="font-black">Alertas e recomendações</div>
        {alerts.length === 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm font-semibold text-emerald-700">
            Nenhum alerta crítico no momento. Continue monitorando regularmente.
          </div>
        )}
        {alerts.map((alert, index) => (
          <div
            key={`${alert.title}-${index}`}
            className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-sm ${
              alert.severity === "critical"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <div className="font-semibold">{alert.title}</div>
            <div>{alert.message}</div>
            {alert.hint && <div className="text-xs opacity-80">{alert.hint}</div>}
          </div>
        ))}
      </section>
    </div>
  );
}

export function ConfigResetPage() {
  const pushToast = useToast((state) => state.push);
  const [confirmText, setConfirmText] = useState("");

  const resetMutation = useMutation({
    mutationFn: async ({ confirm }: { confirm: string }) => {
      const response = await api.post("/admin/reset-sales", { confirm });
      return response.data as {
        ok: boolean;
        orders_deleted: number;
        payments_deleted: number;
        status_logs_deleted: number;
        items_reset: number;
      };
    },
    onSuccess: () => {
      pushToast({ type: "success", message: "Pedidos e vendas foram resetados." });
      setConfirmText("");
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || error?.message || "Não foi possível resetar as vendas.";
      pushToast({ type: "error", message: typeof detail === "string" ? detail : JSON.stringify(detail) });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = confirmText.trim().toUpperCase();
    if (!value) {
      pushToast({ type: "error", message: "Digite RESETAR para confirmar a limpeza." });
      return;
    }
    if (value !== "RESETAR") {
      pushToast({ type: "error", message: "Confirmação incorreta. Digite exatamente RESETAR." });
      return;
    }
    resetMutation.mutate({ confirm: value });
  };

  const result = resetMutation.data;

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50/60 px-5 py-4 text-sm text-amber-800">
        <div className="flex items-center gap-2 text-base font-black">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-white">!</span>
          Atenção — ação irreversível
        </div>
        <p>
          Esta operação remove todos os pedidos, pagamentos registrados e histórico de status, além de zerar os contadores de vendas dos itens.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Os itens, estoques e cardápio permanecem intactos.</li>
          <li>As credenciais e configurações de usuários não são afetadas.</li>
          <li>As integrações (ex.: Mercado Pago) continuam configuradas.</li>
        </ul>
        <p>Faça um backup do banco de dados antes de continuar, caso precise recuperar informações posteriormente.</p>
      </section>

      <section className="card space-y-4">
        <div>
          <div className="font-black">Resetar vendas e pedidos</div>
          <p className="text-sm text-slate-600">
            Digite <span className="font-semibold">RESETAR</span> para liberar o botão e limpar os dados de venda.
          </p>
        </div>
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSubmit}>
          <input
            type="text"
            className="input md:flex-1"
            placeholder="Digite RESETAR para confirmar"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            aria-label="Confirmação para reset"
          />
          <button type="submit" className="btn btn-primary md:w-48" disabled={resetMutation.isLoading}>
            {resetMutation.isLoading ? "Resetando..." : "Resetar agora"}
          </button>
        </form>
        {resetMutation.isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            Ocorreu um erro ao tentar resetar as vendas. Verifique sua conexão e tente novamente.
          </div>
        )}
        {result && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="font-semibold text-slate-800">Resumo da limpeza executada</div>
            <ul className="mt-2 space-y-1">
              <li>
                Pedidos removidos: <strong>{result.orders_deleted}</strong>
              </li>
              <li>
                Pagamentos removidos: <strong>{result.payments_deleted}</strong>
              </li>
              <li>
                Logs de status apagados: <strong>{result.status_logs_deleted}</strong>
              </li>
              <li>
                Itens com contador zerado: <strong>{result.items_reset}</strong>
              </li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">Peça para a equipe recarregar o painel para visualizar a base limpa.</p>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
        <div className="font-semibold text-slate-800">Boas práticas após o reset</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Abra o módulo de vendas para confirmar que não existem registros antigos.</li>
          <li>Crie um pedido de teste para validar o fluxo completo.</li>
          <li>Comunique a equipe que a numeração de pedidos foi reiniciada.</li>
        </ul>
      </section>
    </div>
  );
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "--";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value >= 10 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null) return "--";
  const total = Math.max(seconds, 0);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const parts = [] as string[];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}min`);
  return parts.join(" ");
}

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function getSeverity(value: number | undefined, warn: number, critical: number): SeverityLevel {
  if (value === undefined || value === null || Number.isNaN(value)) return "ok";
  if (value >= critical) return "critical";
  if (value >= warn) return "warning";
  return "ok";
}

function buildAlerts(metrics?: AdminMetricsResponse): MetricsAlert[] {
  if (!metrics) return [];
  const alerts: MetricsAlert[] = [];

  metrics.systems?.forEach((system) => {
    if ((system.status || "").toLowerCase() !== "online") {
      alerts.push({
        severity: "critical",
        title: `${system.name} fora do ar`,
        message: system.detail || "O serviço não respondeu durante a última verificação.",
        hint: "Verifique a conectividade do serviço e reinicie o container/serviço correspondente.",
      });
    }
  });

  const cpuSeverity = getSeverity(metrics.instance?.cpu_percent, 75, 90);
  if (cpuSeverity !== "ok") {
    alerts.push({
      severity: cpuSeverity === "critical" ? "critical" : "warning",
      title: `CPU em ${Math.round(metrics.instance?.cpu_percent ?? 0)}%`,
      message: "O consumo de CPU está elevado.",
      hint:
        cpuSeverity === "critical"
          ? "Considere reiniciar processos pesados ou aumentar os recursos da VM."
          : "Monitore processos no htop/top para identificar picos fora do padrão.",
    });
  }

  const memorySeverity = getSeverity(metrics.instance?.memory_percent, 75, 90);
  if (memorySeverity !== "ok") {
    alerts.push({
      severity: memorySeverity === "critical" ? "critical" : "warning",
      title: `Memória em ${Math.round(metrics.instance?.memory_percent ?? 0)}%`,
      message: "Pouca memória disponível na VM.",
      hint:
        memorySeverity === "critical"
          ? "Reinicie serviços que consomem memória e avalie aumentar o tamanho da instância."
          : "Feche processos não utilizados e acompanhe se o consumo estabiliza.",
    });
  }

  const diskSeverity = getSeverity(metrics.instance?.disk_percent, 75, 90);
  if (diskSeverity !== "ok") {
    alerts.push({
      severity: diskSeverity === "critical" ? "critical" : "warning",
      title: `Disco em ${Math.round(metrics.instance?.disk_percent ?? 0)}%`,
      message: "O armazenamento disponível está reduzido.",
      hint:
        diskSeverity === "critical"
          ? "Libere espaço removendo logs antigos ou amplie o volume de disco imediatamente."
          : "Planeje a limpeza de arquivos temporários e monitore o crescimento do disco.",
    });
  }

  return alerts;
}

function MetricCard({
  label,
  value,
  helper,
  severity,
  icon,
}: {
  label: string;
  value: string;
  helper?: string;
  severity?: SeverityLevel;
  icon?: JSX.Element;
}) {
  const state = severity ?? "ok";
  const wrapperClass =
    state === "critical"
      ? "border-rose-200/80 bg-rose-50"
      : state === "warning"
      ? "border-amber-200/70 bg-amber-50/80"
      : "border-slate-200 bg-white";
  const labelClass =
    state === "critical"
      ? "text-rose-600"
      : state === "warning"
      ? "text-amber-600"
      : "text-slate-500";
  const valueClass =
    state === "critical"
      ? "text-rose-700"
      : state === "warning"
      ? "text-amber-700"
      : "text-slate-900";
  const helperClass =
    state === "critical"
      ? "text-rose-600/80"
      : state === "warning"
      ? "text-amber-600/80"
      : "text-slate-500";

  return (
    <div className={`flex flex-col gap-2 rounded-2xl border p-4 shadow-sm transition ${wrapperClass}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] ${labelClass}`}>
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-3xl font-black ${valueClass}`}>{value}</div>
      {helper && <div className={`text-xs ${helperClass}`}>{helper}</div>}
    </div>
  );
}

function ActiveUsersChart({ points, loading }: { points: MetricsHistoryPoint[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Carregando série histórica…
      </div>
    );
  }

  if (!points.length) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Ainda não há dados suficientes para montar o gráfico.
      </div>
    );
  }

  const width = 640;
  const height = 200;
  const values = points.map((point) => point.active_total ?? point.active_users);
  const maxValue = Math.max(...values, 1);
  const denominator = Math.max(points.length - 1, 1);
  const coords = points.map((point, index) => {
    const x = (index / denominator) * width;
    const y = height - ((point.active_total ?? point.active_users) / maxValue) * height;
    return { x, y, point };
  });

  const polylinePoints = coords.map((coord) => `${coord.x.toFixed(1)},${coord.y.toFixed(1)}`).join(" ");
  const areaPath = `M0 ${height} ${coords
    .map((coord) => `L${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
    .join(" ")} L${width} ${height} Z`;

  const yTicks = Array.from({ length: 5 }, (_, index) => (index / 4) * maxValue);
  const xTickCount = Math.min(6, coords.length);
  const xTickInterval = Math.max(1, Math.floor(coords.length / Math.max(xTickCount - 1, 1)));
  const xTicks = coords.filter((_, index) => index % xTickInterval === 0 || index === coords.length - 1);
  const lastCoord = coords[coords.length - 1];

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Histórico de conexões ativas">
        <defs>
          <linearGradient id="usersArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(232,93,27,0.35)" />
            <stop offset="100%" stopColor="rgba(232,93,27,0)" />
          </linearGradient>
          <linearGradient id="usersLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E85D1B" />
            <stop offset="100%" stopColor="#F9BD1E" />
          </linearGradient>
        </defs>
        {yTicks.map((tickValue, index) => {
          const y = height - (tickValue / maxValue) * height;
          return (
            <g key={`y-${index}`}>
              <line x1={0} x2={width} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="4 4" strokeWidth={1} />
              <text x={0} y={y - 2} fontSize={10} fill="#64748B">
                {Math.round(tickValue)}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#usersArea)" stroke="none" />
        <polyline points={polylinePoints} fill="none" stroke="url(#usersLine)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <circle
          cx={lastCoord.x}
          cy={lastCoord.y}
          r={5}
          fill="#fff"
          stroke="#E85D1B"
          strokeWidth={3}
        />
        <g>
          {xTicks.map((coord, index) => (
            <text key={`x-${index}`} x={coord.x} y={height - 4} fontSize={10} fill="#64748B" textAnchor="middle">
              {formatTimeLabel(new Date(coord.point.timestamp))}
            </text>
          ))}
        </g>
        <text x={lastCoord.x + 8} y={lastCoord.y - 8} fontSize={12} fill="#E85D1B" fontWeight="600">
          {lastCoord.point.active_total ?? lastCoord.point.active_users}
        </text>
      </svg>
    </div>
  );
}

function CPUIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x={6} y={6} width={12} height={12} rx={2} />
      <line x1={9} y1={2} x2={9} y2={4} />
      <line x1={15} y1={2} x2={15} y2={4} />
      <line x1={9} y1={20} x2={9} y2={22} />
      <line x1={15} y1={20} x2={15} y2={22} />
      <line x1={2} y1={9} x2={4} y2={9} />
      <line x1={2} y1={15} x2={4} y2={15} />
      <line x1={20} y1={9} x2={22} y2={9} />
      <line x1={20} y1={15} x2={22} y2={15} />
    </svg>
  );
}

function MemoryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x={3.5} y={7} width={17} height={10} rx={2} />
      <path d="M7 10.5v3" />
      <path d="M12 10.5v3" />
      <path d="M17 10.5v3" />
    </svg>
  );
}

function DiskIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={8} />
      <circle cx={12} cy={12} r={2.5} />
      <path d="M12 4v4" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={8} />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  );
}
