import { create } from "zustand";
import { api, setAuthToken } from "../api";

export type DashboardUser = {
  id: number;
  username: string;
  name?: string;
  allowed_routes: string[];
  is_active: boolean;
};

type AuthState = {
  token: string | null;
  user: DashboardUser | null;
  allowedRoutes: string[];
  initialized: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<DashboardUser>;
  logout: (options?: { silent?: boolean }) => Promise<void>;
  initialize: () => Promise<void>;
  hasRoute: (route: string) => boolean;
  setUser: (user: DashboardUser | null, token?: string | null) => void;
};

const TOKEN_KEY = "umadsede-admin-token";

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  allowedRoutes: [],
  initialized: false,
  loading: false,
  async login(username, password) {
    const response = await api.post("/admin/auth/login", { username, password });
    const { token, user } = response.data;
    get().setUser(user, token);
    return user as DashboardUser;
  },
  async logout(options) {
    const silent = options?.silent;
    try {
      if (!silent) {
        await api.post("/admin/auth/logout");
      }
    } catch {
      // ignora erros de logout explícito
    }
    setAuthToken(null);
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, allowedRoutes: [] });
  },
  async initialize() {
    if (get().initialized) return;
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setAuthToken(stored);
      set({ token: stored, loading: true });
      try {
        const me = await api.get("/admin/auth/me");
        const user: DashboardUser = me.data.user;
        set({ user, allowedRoutes: user.allowed_routes || [], loading: false });
      } catch {
        setAuthToken(null);
        localStorage.removeItem(TOKEN_KEY);
        set({ token: null, user: null, allowedRoutes: [], loading: false });
      }
    }
    set({ initialized: true });
  },
  hasRoute(route: string) {
    const allowed = get().allowedRoutes || [];
    return allowed.includes(route) || allowed.includes("config") || allowed.includes("dashboard");
  },
  setUser(user, token) {
    if (token) {
      setAuthToken(token);
      localStorage.setItem(TOKEN_KEY, token);
    }
    set({
      token: token ?? get().token,
      user,
      allowedRoutes: user?.allowed_routes || [],
      initialized: true,
      loading: false,
    });
  },
}));

// Expose helper to respond to global logout events triggered pelos interceptors
export function attachAuthEventListeners() {
  const handler = () => {
    const { logout } = useAuth.getState();
    logout({ silent: true });
  };
  window.addEventListener("auth:logout", handler);
  return () => window.removeEventListener("auth:logout", handler);
}
