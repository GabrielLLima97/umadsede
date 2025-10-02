import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, NavLink, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";
import { useAuth, attachAuthEventListeners } from "../../store/auth";
import { ADMIN_ROUTES, AdminRouteDefinition, getFirstAllowedRoute } from "../../constants/adminRoutes";

import type { DashboardUser } from "../../store/auth";

type NavItem = AdminRouteDefinition & { icon?: JSX.Element };

type AdminMetricsResponse = {
  systems: { name: string; status: string; detail?: string }[];
  connections: { active_tokens: number; active_users: number };
  instance: {
    cpu_percent?: number;
    memory_percent?: number;
    memory_total?: number;
    memory_used?: number;
    disk_percent?: number;
    disk_total?: number;
    disk_used?: number;
    load_avg?: number[];
  };
};

const NAV_ICONS: Record<string, JSX.Element> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 13h7V4H4v9Zm9 7h7v-9h-7v9ZM4 20h7v-5H4v5Zm9-16v5h7V4h-7Z" />
    </svg>
  ),
  vendas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 7h2l1 10h10l2-6H7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  ),
  cozinha: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M5 4h4v8H5zm5 0h9l-1 7h-8zm-4 14h12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  tv: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8" strokeLinecap="round" />
    </svg>
  ),
  itens: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 5h16v4H4zm0 6h16v8H4z" />
      <path d="M10 15h4" strokeLinecap="round" />
    </svg>
  ),
  estoque: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 7h16v12H4z" />
      <path d="M4 11h16" strokeLinecap="round" />
    </svg>
  ),
  pagamentos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M15 14h3" strokeLinecap="round" />
    </svg>
  ),
  config: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9.1 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9.1a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9A1.65 1.65 0 0 0 10.65 3.1V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 14.9 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
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
    if (allowedSet.has(route.key)) {
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
}: {
  items: NavItem[];
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex w-72 transform bg-white/90 text-slate-800 shadow-2xl backdrop-blur-xl transition-transform duration-200 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-20" : "md:w-72"}`}
      >
        <div className="flex h-full w-full flex-col border-r border-white/30">
          <div className="hidden items-center justify-center px-4 py-6 md:flex">
            <img src="/logo.png" alt="UMADSEDE" className="h-12" />
          </div>
          <nav className="flex-1 space-y-1 px-3 py-3">
            {items.map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                title={item.label}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive || currentPath.startsWith(item.path)
                      ? "bg-brand-primary/10 text-brand-primary"
                      : "text-slate-600 hover:bg-slate-100"
                  } ${collapsed ? "justify-center" : ""}`
                }
                onClick={onNavigate}
              >
                <span>{item.icon || NAV_ICONS[item.key]}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-white/30 px-3 py-4">
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 ${
                collapsed ? "justify-center" : ""}`}
              onClick={onLogout}
              title="Sair"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M16 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12H9" strokeLinecap="round" />
                <path d="M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" strokeLinecap="round" />
              </svg>
              {!collapsed && <span>Sair</span>}
            </button>
          </div>
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
    <header className="sticky top-0 z-50 border-b border-white/20 bg-white/70 backdrop-blur-xl transition-colors hover:bg-white/60">
      <div className="flex items-center gap-4 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-slate-600 shadow-sm transition hover:bg-white/40 md:hidden"
          aria-label="Abrir menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/40 text-slate-600 shadow-sm transition hover:bg-white/40 md:inline-flex"
          aria-label="Alternar menu"
        >
          {collapsed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={onLogoClick}
          className="hidden items-center gap-2 text-left md:flex"
        >
          <img src="/logo.png" alt="UMADSEDE" className="h-8" />
        </button>
        <div className="flex flex-1 flex-wrap items-center gap-4">
          {showInsights && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              {loadingMetrics && <span>Carregando status…</span>}
              {!loadingMetrics && systems.map((system) => (
                <span
                  key={system.name}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${system.status === "online" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                >
                  <span className={`h-2 w-2 rounded-full ${system.status === "online" ? "bg-emerald-500" : "bg-rose-500"}`} />
                  {system.name}
                </span>
              ))}
            </div>
          )}
          {showInsights && instance && (
            <div className="hidden items-center gap-4 text-xs text-slate-600 xl:flex">
              <MetricPill label="CPU" value={`${instance.cpu_percent?.toFixed(0)}%`} />
              <MetricPill label="Memória" value={`${instance.memory_percent?.toFixed(0)}%`} tooltip={formatBytes(instance.memory_used)} />
              <MetricPill label="Disco" value={`${instance.disk_percent?.toFixed(0)}%`} tooltip={formatBytes(instance.disk_used)} />
              {instance.load_avg && (
                <MetricPill label="Load" value={instance.load_avg.map((v: number) => v.toFixed(2)).join(" / ")} />
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {showInsights && (
            <div className="hidden items-center gap-1 rounded-full border border-white/40 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm md:flex">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0" strokeLinecap="round" strokeLinejoin="round" />
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
    <div className="flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 font-semibold text-slate-600" title={tooltip}>
      <span className="uppercase text-[11px] tracking-wide text-slate-500">{label}</span>
      <span>{value}</span>
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
