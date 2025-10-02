import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { ADMIN_ROUTES } from "../constants/adminRoutes";
import { useAuth } from "../store/auth";

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

export default function AdminConfig() {
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

  const [newUser, setNewUser] = useState({
    username: "",
    name: "",
    password: "",
    routes: availableRoutes.map((r) => r.key),
  });
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

  const handleCreateUser = async (event: React.FormEvent) => {
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
          <div className="text-2xl font-black">Configurações do painel</div>
          <p className="text-sm text-slate-600">Gerencie usuários e permissões de acesso.</p>
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

type EditingState = {
  name: string;
  routes: string[];
  is_active: boolean;
  password: string;
};
