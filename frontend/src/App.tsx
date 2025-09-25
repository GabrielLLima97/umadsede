import { Outlet, Link, useLocation } from "react-router-dom";
export default function App(){
  const loc = useLocation();
  const isWide = loc.pathname.startsWith("/cozinha") || loc.pathname.startsWith("/tv");
  const isClient = loc.pathname.startsWith("/cliente");
  const isStatus = loc.pathname.startsWith("/status");
  const isAdmin = loc.pathname.startsWith("/admin");
  return (
    <div className={isWide || isClient || isAdmin ? "w-full p-0" : "max-w-6xl mx-auto p-4"}>
      {!isClient && (
        <header className={`flex items-center ${isStatus?"justify-center":"justify-between"} p-4`}>
          <img src="/logo.png" alt="UMADSEDE" className={isStatus?"h-20":"h-14"} />
          {!isStatus && (
          <nav className="flex gap-3 text-sm">
            
            <Link className={`btn btn-primary ${loc.pathname==="/cozinha"?"ring-2 ring-white/60":""}`} to="/cozinha">Cozinha</Link>
            <Link className={`btn btn-primary ${loc.pathname==="/tv"?"ring-2 ring-white/60":""}`} to="/tv">TV</Link>
            <Link className={`btn btn-primary ${loc.pathname==="/admin/itens"?"ring-2 ring-white/60":""}`} to="/admin/itens">Itens</Link>
            <Link className={`btn btn-primary ${loc.pathname==="/admin/pagamentos"?"ring-2 ring-white/60":""}`} to="/admin/pagamentos">Pagamentos</Link>
            <Link className={`btn btn-primary ${loc.pathname==="/admin/vendas"?"ring-2 ring-white/60":""}`} to="/admin/vendas">Vendas (Caixa)</Link>
            <Link className={`btn btn-primary ${loc.pathname==="/admin/estoque"?"ring-2 ring-white/60":""}`} to="/admin/estoque">Estoque</Link>
            <Link className={`btn btn-primary ${loc.pathname==="/admin/relatorio"?"ring-2 ring-white/60":""}`} to="/admin/relatorio">Relatórios</Link>
          </nav>
          )}
        </header>
      )}
      <Outlet />
      {/* Linha decorativa no rodapé */}
      {!isClient && (
        <footer className="mt-8">
          <img src="/linhas.png" alt="decoração" className="w-full max-w-6xl mx-auto select-none pointer-events-none" />
        </footer>
      )}
    </div>
  );
}
