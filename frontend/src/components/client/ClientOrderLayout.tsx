import { PropsWithChildren, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

type Props = PropsWithChildren<{
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
}>;

export default function ClientOrderLayout({ children, centerSlot, rightSlot }: Props) {
  const loc = useLocation();
  const isOrders = loc.pathname.startsWith("/cliente/pedidos");
  const isClienteRoot = loc.pathname.startsWith("/cliente") && !isOrders;
  return (
    <div className="w-full min-h-screen bg-cream font-sans">
      <header role="banner" className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto h-16 px-4 flex items-center gap-3">
          <Link to="/cliente" className="flex items-center gap-2" aria-label="Ir para página inicial do cliente">
            <img
              src="/logo.png"
              alt="UMADSEDE"
              className="h-10 w-auto"
              loading="lazy"
              decoding="async"
              sizes="(max-width: 768px) 140px, 180px"
            />
          </Link>
          <div className="flex-1 flex items-center min-w-0">
            {centerSlot}
          </div>
          <div className="flex items-center gap-2">
            {rightSlot}
            {isOrders && (
              <Link to="/cliente" className="btn btn-primary min-h-[48px]">Fazer pedido</Link>
            )}
            {isClienteRoot && (
              <Link to="/cliente/pedidos" className="btn btn-primary min-h-[48px]">Meus pedidos</Link>
            )}
            {!loc.pathname.startsWith("/cliente") && (
              <Link to="/cliente" className="btn btn-primary min-h-[48px]">Fazer pedido</Link>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-4 pt-4 pb-24 md:pb-16">
        {children}
      </main>
      <footer className="mt-6">
        <img
          src="/linhas.png"
          alt="decoração"
          className="w-full max-w-[1400px] mx-auto select-none pointer-events-none"
          loading="lazy"
          decoding="async"
          sizes="(max-width: 768px) 100vw, 1400px"
        />
      </footer>
    </div>
  );
}
