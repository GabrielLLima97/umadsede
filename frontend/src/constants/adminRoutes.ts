export type AdminRouteDefinition = {
  key: string;
  label: string;
  path: string;
};

export const ADMIN_ROUTES: AdminRouteDefinition[] = [
  { key: "dashboard", label: "Dashboard", path: "/admin/dashboard" },
  { key: "vendas", label: "Vendas (Caixa)", path: "/admin/vendas" },
  { key: "cozinha", label: "Cozinha", path: "/admin/cozinha" },
  { key: "tv", label: "TV", path: "/admin/tv" },
  { key: "itens", label: "Itens", path: "/admin/itens" },
  { key: "estoque", label: "Estoque", path: "/admin/estoque" },
  { key: "pagamentos", label: "Pagamentos", path: "/admin/pagamentos" },
  { key: "config", label: "Configurações", path: "/admin/config" },
];

export function getFirstAllowedRoute(allowed: string[] | undefined | null): string {
  if (!allowed || allowed.length === 0) {
    return "/admin/dashboard";
  }
  const order = ADMIN_ROUTES;
  for (const route of order) {
    if (allowed.includes(route.key)) {
      return route.path;
    }
  }
  return "/admin/dashboard";
}
