import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, NavLink, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";
import { useAuth, attachAuthEventListeners } from "../../store/auth";
import { ADMIN_ROUTES, AdminRouteDefinition, getFirstAllowedRoute } from "../../constants/adminRoutes";
import type { DashboardUser } from "../../store/auth";

type NavItem = AdminRouteDefinition & { icon: JSX.Element };

type AdminMetricsResponse = {
  systems: { name: string; status: string; detail?: string }[];
  connections: { active_tokens: number; active_users: number };
  instance: {
    cpu_percent?: number;
    memory_percent?: number;
    memory_used?: number;
    disk_percent?: number;
    disk_used?: number;
    load_avg?: number[];
  };
};

const NAV_ICONS: Record<string, JSX.Element> = {
  dashboard: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M11 3a8 8 0 1 0 0 18h2a8 8 0 0 0 0-18h-2Zm1 4a1 1 0 0 1 1 1v4.6l2.4 2.4a1 1 0 0 1-1.4 1.4l-2.8-2.8a1 1 0 0 1-.3-.7V8a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  vendas: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M5 4a1 1 0 0 0-1 1v2h1.28l2.7 9.47A3 3 0 0 0 10.87 18H18a1 1 0 0 0 0-2h-7.13a1 1 0 0 1-.96-.7L9.18 14H17a3 3 0 0 0 2.82-2l1.9-5.7A1 1 0 0 0 20.8 5H6.42L6.1 4.13A1 1 0 0 0 5 4Zm2 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  ),
  cozinha: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M5 3a1 1 0 0 0-1 1v8h2V4a1 1 0 0 0-1-1Zm4 0a1 1 0 0 0-1 1v8h2V4a1 1 0 0 0-1-1Zm4 0a1 1 0 0 0-1 1v8.5a2.5 2.5 0 1 0 3 2.45V4a1 1 0 0 0-1-1h-1Zm6.56 2.17a.75.75 0 0 0-.94-.5l-2.95.85a.75.75 0 0 0-.53.71v11.77a2 2 0 0 1-2 2H7.86a2 2 0 0 1-2-2V14H4v4.83a3 3 0 0 0 3 3h8.28a3 3 0 0 0 3-3V6.66l2.45-.7a.75.75 0 0 0 .5-.94Z" />
    </svg>
  ),
  tv: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M4 5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H4Zm16 2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h16Zm-9 14a1 1 0 0 0 0 2h2a1 1 0 1 0 0-2h-2Z" />
    </svg>
  ),
  itens: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M5 5a2 2 0 0 0-2 2v2h18V7a2 2 0 0 0-2-2H5Zm16 6H3v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6Zm-7 2a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  estoque: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M4.5 5h15a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v9h13V7h-13Zm3 11a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2h-7Z" />
    </svg>
  ),
  pagamentos: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M3 6a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3H3Zm18 2a1 1 0 0 1 1 1v1H2V9a1 1 0 0 1 1-1h18Zm-4 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  ),
  config: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <path d="M11.66 3.05a1 1 0 0 1 .68 0l1.51.44a2 2 0 0 0 1.66-.35l1.1-.84a1 1 0 0 1 1.49.29l.94 1.63a2 2 0 0 0 1.38 1l1.51.33a1 1 0 0 1 .78.98l-.06 1.88a2 2 0 0 0 .57 1.43l1.15 1.23a1 1 0 0 1 0 1.37l-1.15 1.23a2 2 0 0 0-.57 1.43l.06 1.88a1 1 0 0 1-.78.98l-1.51.33a2 2 0 0 0-1.38 1l-.94 1.63a1 1 0 0 1-1.49.29l-1.1-.84a2 2 0 0 0-1.66-.35l-1.51.44a1 1 0 0 1-.68 0l-1.51-.44a2 2 0 0 0-1.66.35l-1.1.84a1 1 0 0 1-1.49-.29l-.94-1.63a2 2 0 0 0-1.38-1l-1.51-.33a1 1 0 0 1-.78-.98l.06-1.88a2 2 0 0 0-.57-1.43L.74 12.4a1 1 0 0 1 0-1.37L1.9 9.8a2 2 0 0 0 .57-1.43L2.41 6.5a1 1 0 0 1 .78-.98l1.51-.33a2 2 0 0 0 1.38-1L6.12 2.56a1 1 0 0 1 1.49-.29l1.1.84a2 2 0 0 0 1.66.35l1.29-.37Z" />
      <circle cx="12" cy="12" r="3.5" fill="#fff" />
    </svg>
  ),
};

const METRICS_QUERY_KEY = ["admin", "metrics"];

function useAdminMetrics(enabled: boolean) {
  return useQuery({
    queryKey: METRICS_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get("/admin/metrics");
      return response.data as AdminMetricsResponse;
    },
    enabled,
    refetchInterval: 15_000,
  });
}

export default function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, allowedRoutes, initialize, initialized, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    initialize();
    const detach = attachAuthEventListeners();
    return () => detach();
  }, [initialize]);

  const showAdminInsights = useMemo(() => (allowedRoutes || []).includes("config"), [allowedRoutes]);
  const metrics = useAdminMetrics(showAdminInsights);

  if (!token && initialized) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!initialized || loading || (token && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500">
        Carregando painel…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  const visibleNavItems = getVisibleNavItems(allowedRoutes);
  const handleNavigateHome = () => {
    const first = getFirstAllowedRoute(allowedRoutes);
    navigate(first, { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <AdminSidebar
        items={visibleNavItems}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        currentPath={location.pathname}
        onNavigate={() => setSidebarOpen(false)}
        onLogout={() => logout().then(() => navigate("/admin/login"))}
        showConfig={showAdminInsights}
      />
      <div className="flex flex-1 flex-col">
        <AdminHeader
          user={user}
          metrics={metrics.data}
          loadingMetrics={metrics.isLoading}
          showInsights={showAdminInsights}
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onLogoClick={handleNavigateHome}
          activeUsers={metrics.data?.connections?.active_users ?? 0}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getVisibleNavItems(allowedRoutes: string[]): NavItem[] {
  const allowedSet = new Set(allowedRoutes || []);
  const base: NavItem[] = [];
  ADMIN_ROUTES.forEach((route) => {
    if (route.key !== "config" && allowedSet.has(route.key)) {
      base.push({ ...route, icon: NAV_ICONS[route.key] });
    }
  });
  return base;
}

function AdminSidebar({
  items,
  open,
  collapsed,
  onClose,
  currentPath,
  onNavigate,
  onLogout,
  showConfig,
}: {
  items: NavItem[];
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: () => void;
  onLogout: () => void;
  showConfig: boolean;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex w-72 transform bg-white/70 text-slate-800 shadow-2xl backdrop-blur-2xl transition-transform duration-200 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-20" : "md:w-72"}`}
      >
        <div className="flex h-full w-full flex-col border-r border-white/30">
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-8">
            {items.map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                title={item.label}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive || currentPath.startsWith(item.path)
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "text-slate-600 hover:bg-white/50"
                  } ${collapsed ? "justify-center" : ""}`
                }
                onClick={onNavigate}
              >
                <span>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
            {showConfig && (
              <NavLink
                to="/admin/config"
                title="Configurações"
                className={({ isActive }) =>
                  `mt-4 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive ? "bg-brand-primary/15 text-brand-primary" : "text-slate-600 hover:bg-white/50"
                  } ${collapsed ? "justify-center" : ""}`
                }
                onClick={onNavigate}
              >
                <span>{NAV_ICONS.config}</span>
                {!collapsed && <span>Configurações</span>}
              </NavLink>
            )}
            <div className="border-t border-white/40 pt-4">
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white/60 ${
                  collapsed ? "justify-center" : ""}`}
                onClick={onLogout}
                title="Sair"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M13 3a1 1 0 0 1 1 1v3h-2V5H6v14h6v-2h2v3a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7Zm5.59 7.59a1 1 0 1 1 1.41 1.41l-2.3 2.29H11v-2h6.7l-.11.11ZM21 12l-3.3 3.3-1.4-1.4L17.6 13H11v-2h6.6l-1.3-1.3 1.4-1.41L21 12Z" />
                </svg>
                {!collapsed && <span>Sair</span>}
              </button>
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}

function AdminHeader({
  user,
  metrics,
  loadingMetrics,
  activeUsers,
  showInsights,
  collapsed,
  onToggleSidebar,
  onToggleCollapse,
  onLogoClick,
}: {
  user: DashboardUser;
  metrics?: AdminMetricsResponse;
  loadingMetrics: boolean;
  activeUsers: number;
  showInsights: boolean;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onToggleCollapse: () => void;
  onLogoClick: () => void;
}) {
  const systems = metrics?.systems || [];
  const instance = metrics?.instance;

  return (
    <header className="sticky top-0 z-[60] border-b border-white/30 bg-white/60 backdrop-blur-2xl transition">
      <div className="flex items-center gap-4 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/50 text-slate-600 shadow-sm transition hover:bg-white/50 md:hidden"
          aria-label="Abrir menu"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/50 text-slate-600 shadow-sm transition hover:bg-white/50 md:inline-flex"
          aria-label="Alternar menu"
        >
          {collapsed ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="m9 12 5-5v10z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="m15 12-5 5V7z" />
            </svg>
          )}
        </button>
        <button type="button" onClick={onLogoClick} className="hidden items-center gap-2 text-left md:flex">
          <img src="/logo.png" alt="UMADSEDE" className="h-10" />
        </button>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {showInsights && (
            <div className="flex flex-col gap-2 text-[10px] text-slate-600 sm:flex-row sm:flex-wrap">
              {loadingMetrics && <span className="rounded-full bg-white/60 px-2 py-1 font-semibold text-slate-500">Carregando status…</span>}
              {!loadingMetrics && (
                <>
                  {systems.map((system) => (
                    <span
                      key={system.name}
                      className={`flex items-center gap-2 rounded-full border border-white/50 px-3 py-1 font-semibold shadow-sm ${
                        system.status === "online" ? "text-emerald-700" : "text-rose-700"
                      } bg-white/65`}
                    >
                      <span className={`h-2 w-2 rounded-full ${system.status === "online" ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {system.name}
                    </span>
                  ))}
                  {instance && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MetricPill label="CPU" value={`${instance.cpu_percent?.toFixed(0)}%`} />
                      <MetricPill label="Memória" value={`${instance.memory_percent?.toFixed(0)}%`} tooltip={formatBytes(instance.memory_used)} />
                      <MetricPill label="Disco" value={`${instance.disk_percent?.toFixed(0)}%`} tooltip={formatBytes(instance.disk_used)} />
                      {instance.load_avg && (
                        <MetricPill label="Load" value={instance.load_avg.map((v: number) => v.toFixed(2)).join(" / ")} />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {showInsights && (
            <div className="hidden items-center gap-1 rounded-full border border-white/50 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm md:flex">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0" />
              </svg>
              <span>{activeUsers}</span>
            </div>
          )}
          <div className="hidden text-right text-sm md:block">
            <div className="font-semibold text-slate-700">{user.name || user.username}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function MetricPill({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/50 bg-white/70 px-3 py-1 font-semibold text-slate-600 shadow-sm" title={tooltip}>
      <span className="uppercase text-[10px] tracking-[0.2em] text-slate-500">{label}</span>
      <span className="text-xs font-bold text-slate-700">{value}</span>
    </div>
  );
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(1)} ${units[index]}`;
}
