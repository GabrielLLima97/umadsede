import { FormEvent, useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { ADMIN_ROUTES, getFirstAllowedRoute } from "../constants/adminRoutes";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { token, user, login, allowedRoutes, initialized, initialize, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  if (token && user) {
    const target = getFirstAllowedRoute(allowedRoutes);
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const u = await login(username, password);
      const target = getFirstAllowedRoute(u.allowed_routes);
      navigate(target, { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Falha ao entrar";
      setError(String(detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="UMADSEDE" className="mx-auto h-14" />
          <h1 className="mt-4 text-2xl font-black text-slate-900">Acesso administrativo</h1>
          <p className="text-sm text-slate-600">Entre com suas credenciais para acessar o painel.</p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Usuário
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Senha
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
          <button
            type="submit"
            className="btn btn-primary mt-2 min-h-[48px]"
            disabled={submitting}
          >
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
