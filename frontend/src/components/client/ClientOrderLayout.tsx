import { PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";

export default function ClientOrderLayout({ children }: PropsWithChildren) {
  const loc = useLocation();
  const isOrders = loc.pathname.startsWith("/cliente/pedidos");
  const isClienteRoot = loc.pathname.startsWith("/cliente") && !isOrders;
  return (
    <div className="w-full min-h-screen bg-cream">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <img src="/logo.png" alt="UMADSEDE" className="h-12" />
          <div>
            {isOrders && (
              <Link to="/cliente" className="btn btn-primary">Fazer pedido</Link>
            )}
            {isClienteRoot && (
              <Link to="/cliente/pedidos" className="btn btn-primary">Meus pedidos</Link>
            )}
            {!loc.pathname.startsWith("/cliente") && (
              <Link to="/cliente" className="btn btn-primary">Fazer pedido</Link>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-4 py-4">
        {children}
      </main>
      {/* Linha decorativa no rodapé */}
      <footer className="mt-6">
        <img src="/linhas.png" alt="decoração" className="w-full max-w-[1400px] mx-auto select-none pointer-events-none" />
      </footer>
    </div>
  );
}
