import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate, NavLink, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";
import { useAuth, attachAuthEventListeners } from "../../store/auth";
import { ADMIN_ROUTES, AdminRouteDefinition, getFirstAllowedRoute } from "../../constants/adminRoutes";
import type { DashboardUser } from "../../store/auth";
import { useAdminPresence } from "../../hooks/useClientPresence";

type NavItem = AdminRouteDefinition & { icon: JSX.Element };

type AdminMetricsResponse = {
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
    memory_used?: number;
    disk_percent?: number;
    disk_used?: number;
    load_avg?: number[];
  };
};

function createNavIcon(children: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const NAV_ICONS: Record<string, JSX.Element> = {
  dashboard: createNavIcon(
    <>
      <circle cx="12" cy="12" r="7.25" />
      <path d="M12 12l2.9-2.9" />
      <path d="M8.6 15.4a4.1 4.1 0 0 1 6.8 0" />
    </>
  ),
  vendas: createNavIcon(
    <>
      <rect x="5.25" y="8.5" width="13.5" height="11" rx="2.25" />
      <path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5" />
      <path d="M9.5 12.25h5" />
    </>
  ),
  cozinha: createNavIcon(
    <>
      <path d="M12 6.25a3.75 3.75 0 0 1 3.75 3.75v.5H8.25v-.5A3.75 3.75 0 0 1 12 6.25Z" />
      <path d="M5.8 11h12.4l-.33 5.16a2.4 2.4 0 0 1-2.4 2.24H8.53a2.4 2.4 0 0 1-2.4-2.24L5.8 11Z" />
      <path d="M12 6.25V5" />
    </>
  ),
  tv: createNavIcon(
    <>
      <rect x="3.75" y="5.5" width="16.5" height="11.5" rx="2" />
      <path d="M8 20h8" />
    </>
  ),
  itens: createNavIcon(
    <>
      <circle cx="5.6" cy="7.5" r="1.2" />
      <circle cx="5.6" cy="12" r="1.2" />
      <circle cx="5.6" cy="16.5" r="1.2" />
      <path d="M9 7.5h9.5" />
      <path d="M9 12h9.5" />
      <path d="M9 16.5h9.5" />
    </>
  ),
  estoque: createNavIcon(
    <>
      <rect x="4.5" y="6.75" width="15" height="10.5" rx="1.9" />
      <path d="M4.5 11h15" />
      <path d="M12 6.75v10.5" />
    </>
  ),
  pagamentos: createNavIcon(
    <>
      <rect x="4.25" y="6.75" width="15.5" height="10.5" rx="1.8" />
      <path d="M4.25 10.5h15.5" />
      <path d="M8.75 15h3.5" />
    </>
  ),
  config: createNavIcon(
    <>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="6.75" />
      <line x1="12" y1="5" x2="12" y2="3.75" />
      <line x1="12" y1="20.25" x2="12" y2="19" />
      <line x1="5" y1="12" x2="3.75" y2="12" />
      <line x1="20.25" y1="12" x2="19" y2="12" />
      <line x1="16.45" y1="7.55" x2="17.5" y2="6.5" />
      <line x1="7.55" y1="16.45" x2="6.5" y2="17.5" />
      <line x1="16.45" y1="16.45" x2="17.5" y2="17.5" />
      <line x1="7.55" y1="7.55" x2="6.5" y2="6.5" />
    </>
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
  const isCozinhaRoute = location.pathname.startsWith("/admin/cozinha");
  const isTvRoute = location.pathname.startsWith("/admin/tv");

  useAdminPresence(Boolean(token));

  useEffect(() => {
    initialize();
    const detach = attachAuthEventListeners();
    return () => detach();
  }, [initialize]);

  useEffect(() => {
    const shouldCollapse = isCozinhaRoute || isTvRoute;
    setSidebarCollapsed(shouldCollapse);
  }, [isCozinhaRoute, isTvRoute]);

  const showAdminInsights = useMemo(() => (allowedRoutes || []).includes("config"), [allowedRoutes]);
  const metrics = useAdminMetrics(showAdminInsights);

  const connectionTotals = {
    admins: metrics.data?.connections?.active_users ?? 0,
    clients: metrics.data?.connections?.active_clients ?? 0,
    total:
      metrics.data?.connections?.active_total ??
      ((metrics.data?.connections?.active_users ?? 0) + (metrics.data?.connections?.active_clients ?? 0)),
  };

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
      <div className="relative flex flex-1 flex-col">
        {!isTvRoute && (
          <AdminHeader
            user={user}
            metrics={metrics.data}
            loadingMetrics={metrics.isLoading}
            showInsights={showAdminInsights}
            collapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            onLogoClick={handleNavigateHome}
            activeConnections={connectionTotals}
          />
        )}
        {isTvRoute && (
          <>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="absolute left-3 top-3 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 md:hidden"
              style={{ boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)" }}
              aria-label="Abrir menu"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="absolute left-3 top-3 z-50 hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 md:inline-flex"
              style={{ boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)" }}
              aria-label="Alternar menu"
            >
              {sidebarCollapsed ? (
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8.5 6.5 14 12l-5.5 5.5" />
                  <path d="M5 6.5 10.5 12 5 17.5" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15.5 6.5 10 12l5.5 5.5" />
                  <path d="M19 6.5 13.5 12 19 17.5" />
                </svg>
              )}
            </button>
          </>
        )}
        <main
          className={`flex-1 ${isTvRoute ? "overflow-hidden p-0" : "overflow-y-auto p-4 md:p-6"}`}
        >
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
        className={`fixed inset-y-0 left-0 z-20 flex w-72 transform bg-white/55 text-slate-800 shadow-xl backdrop-blur-xl transition-transform duration-200 md:sticky md:top-[4.5rem] md:z-0 md:self-start md:h-[calc(100vh-4.5rem)] md:border md:border-white/30 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-20" : "md:w-72"}`}
      >
        <div className="flex h-full w-full flex-col border-r border-white/30">
          <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-8 pt-20 md:pt-10">
            {items.map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                title={item.label}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 rounded-xl py-2 text-sm font-semibold transition-colors ${
                    isActive || currentPath.startsWith(item.path)
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "text-slate-600 hover:bg-white/50"
                  } ${collapsed ? "justify-center px-0" : "pl-2 pr-3"}`
                }
                onClick={onNavigate}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              </NavLink>
            ))}
            {showConfig && (
              <NavLink
                to="/admin/config"
                title="Configurações"
                className={({ isActive }) =>
                  `mt-4 flex w-full items-center gap-3 rounded-xl py-2 text-sm font-semibold transition-colors ${
                    isActive ? "bg-brand-primary/15 text-brand-primary" : "text-slate-600 hover:bg-white/50"
                  } ${collapsed ? "justify-center px-0" : "pl-2 pr-3"}`
                }
                onClick={onNavigate}
              >
                <span className="shrink-0">{NAV_ICONS.config}</span>
                {!collapsed && <span className="flex-1 truncate">Configurações</span>}
              </NavLink>
            )}
            <div className="border-t border-white/40 pt-4">
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white/60 ${
                  collapsed ? "justify-center px-0" : "pl-2 pr-3"}`}
                onClick={onLogout}
                title="Sair"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M13 5.5V4.75A2.75 2.75 0 0 1 15.75 2h3.5A2.75 2.75 0 0 1 22 4.75v14.5A2.75 2.75 0 0 1 19.25 22h-3.5A2.75 2.75 0 0 1 13 19.25V18.5" />
                  <path d="M3 12h10" />
                  <path d="m6.5 8.5-3.5 3.5 3.5 3.5" />
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
  activeConnections,
  showInsights,
  collapsed,
  onToggleSidebar,
  onToggleCollapse,
  onLogoClick,
}: {
  user: DashboardUser;
  metrics?: AdminMetricsResponse;
  loadingMetrics: boolean;
  activeConnections: { total: number; admins: number; clients: number };
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
      <div className="flex items-center gap-3 px-2 py-3 md:pl-4 md:pr-6">
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
          className="hidden h-10 w-10 items-center justify-center rounded-full border border-brand-primary/50 bg-brand-primary text-white shadow-md shadow-brand-primary/30 transition hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 md:inline-flex"
          aria-label="Alternar menu"
        >
          {collapsed ? (
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8.5 6.5 14 12l-5.5 5.5" />
              <path d="M5 6.5 10.5 12 5 17.5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15.5 6.5 10 12l5.5 5.5" />
              <path d="M19 6.5 13.5 12 19 17.5" />
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
            <div
              className="hidden items-center gap-2 rounded-full border border-white/50 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm md:flex"
              title={`Administradores: ${activeConnections.admins} • Clientes: ${activeConnections.clients}`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                <path d="M4 20a8 8 0 0 1 16 0" />
              </svg>
              <span>{activeConnections.total}</span>
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
