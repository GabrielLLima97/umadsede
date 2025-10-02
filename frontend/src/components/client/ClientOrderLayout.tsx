import { PropsWithChildren, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

type Props = PropsWithChildren<{ rightSlot?: ReactNode }>;

export default function ClientOrderLayout({ children, rightSlot }: Props) {
  const loc = useLocation();
  const isOrders = loc.pathname.startsWith("/cliente/pedidos");
  const isClienteRoot = loc.pathname.startsWith("/cliente") && !isOrders;
  return (
    <div className="w-full min-h-screen bg-cream font-sans">
      <header
        role="banner"
        className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm"
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4">
          <Link
            to="/cliente"
            className="flex items-center gap-3 rounded-full px-2 py-1 transition hover:bg-slate-100"
            aria-label="Ir para página inicial do cliente"
          >
            <img
              src="/logo.png"
              alt="UMADSEDE"
              className="h-10 w-auto"
              loading="lazy"
              decoding="async"
              sizes="(max-width: 768px) 140px, 180px"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold uppercase tracking-[0.18em] text-brand-primary">
                Umadsede
              </span>
              <span className="text-xs font-medium text-slate-600 sm:text-sm">Hamburgueria artesanal • pedidos digitais</span>
            </div>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            {rightSlot}
            {isOrders && (
              <Link to="/cliente" className="btn btn-primary min-h-[48px]">Fazer pedido</Link>
            )}
            {isClienteRoot && (
              <Link
                to="/cliente/pedidos"
                className="btn btn-ghost min-h-[48px] border border-brand-primary text-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary"
              >
                Meus pedidos
              </Link>
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
