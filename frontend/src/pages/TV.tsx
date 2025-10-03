import { useEffect, useState } from "react";
import { api } from "../api";

type Order = {
  id: number;
  cliente_nome?: string;
  status: string;
  created_at: string;
};

function ProductionIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-6 w-6"}
      aria-hidden="true"
    >
      <path d="M6 6.5h12" />
      <path d="M4.5 10.5h15" />
      <path d="M7 10.5v5.5a3.5 3.5 0 0 0 3.5 3.5h3a3.5 3.5 0 0 0 3.5-3.5v-5.5" />
      <path d="M9 3.5v1.5" />
      <path d="M12 3v1.5" />
      <path d="M15 3.5v1.5" />
    </svg>
  );
}

function ReadyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-6 w-6"}
      aria-hidden="true"
    >
      <path d="M4 8h16l-1.5 9a3 3 0 0 1-3 2.6H8.5a3 3 0 0 1-3-2.6L4 8Z" />
      <path d="M9.5 5.5h5" />
      <path d="m9.5 12 2 2 3.5-3.5" />
    </svg>
  );
}

export default function TV() {
  const [prontos, setProntos] = useState<Order[]>([]);
  const [producao, setProducao] = useState<Order[]>([]);

  useEffect(() => {
    const carregar = () =>
      api.get("/orders/").then((r) => {
        const data = (r.data?.results || r.data || []) as Order[];
        const arr = Array.isArray(data) ? data : [];
        const byCreated = (a: Order, b: Order) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        setProntos(arr.filter((p) => p.status === "pronto").sort(byCreated));
        setProducao(arr.filter((p) => p.status === "em produção").sort(byCreated));
      });

    carregar();
    const t = setInterval(carregar, 5000);

    const host = window.location.hostname + (window.location.port === "5173" ? ":8000" : "");
    const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${wsProto}://${host}/ws/orders`);
    ws.onmessage = () => carregar();
    ws.onerror = () => {};

    return () => {
      clearInterval(t);
      ws.close();
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl font-burger px-4 pb-12 pt-8 md:px-10 lg:px-16">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section className="relative flex flex-col rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-white/90 p-6 shadow-[0_25px_70px_-45px_rgba(217,119,6,0.6)]">
          <header className="flex flex-col items-center gap-4 text-center">
            <div className="inline-flex items-center gap-3 rounded-full bg-amber-500/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-amber-700">
              <ProductionIcon className="h-5 w-5" />
              Em produção
            </div>
            <h2 className="flex items-center gap-3 text-4xl font-black text-amber-800 md:text-5xl">
              <ProductionIcon className="h-10 w-10 md:h-12 md:w-12" />
              Pedidos em produção
            </h2>
            <p className="text-sm font-medium text-amber-600/80 md:text-base">
              Acompanhe os pedidos sendo preparados neste momento
            </p>
          </header>
          <div className="mt-6 flex flex-col gap-5">
            {producao.map((order) => (
              <article
                key={order.id}
                className="flex items-stretch gap-4 rounded-3xl border border-amber-200/70 bg-white/95 p-4 shadow-[0_18px_45px_-30px_rgba(217,119,6,0.55)] backdrop-blur-sm"
              >
                <div className="flex min-w-[7rem] flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-amber-500/0 px-5 py-4 md:min-w-[8rem]">
                  <span className="text-5xl font-black leading-none text-amber-700 md:text-6xl">{order.id}</span>
                </div>
                <span
                  className="hidden h-full w-px self-stretch bg-gradient-to-b from-transparent via-amber-400/50 to-transparent md:inline-flex"
                  aria-hidden="true"
                />
                <div className="flex flex-1 items-center rounded-2xl bg-white/75 px-6 py-4">
                  <span className="truncate text-3xl font-bold text-slate-900 md:text-4xl">{order.cliente_nome || "Cliente"}</span>
                </div>
              </article>
            ))}
            {producao.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300/70 bg-white/70 px-6 py-12 text-center text-amber-600">
                <ProductionIcon className="mb-3 h-10 w-10" />
                <span className="text-lg font-semibold">Sem pedidos em produção no momento</span>
              </div>
            )}
          </div>
        </section>
        <section className="relative flex flex-col rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-white/90 p-6 shadow-[0_30px_85px_-40px_rgba(16,185,129,0.6)]">
          <header className="flex flex-col items-center gap-4 text-center">
            <div className="inline-flex items-center gap-3 rounded-full bg-emerald-500/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-700">
              <ReadyIcon className="h-5 w-5" />
              Prontos para retirada
            </div>
            <h2 className="flex items-center gap-3 text-4xl font-black text-emerald-800 md:text-5xl">
              <ReadyIcon className="h-10 w-10 md:h-12 md:w-12" />
              Pedidos prontos para retirada
            </h2>
            <p className="text-sm font-medium text-emerald-600/80 md:text-base">
              Clientes podem retirar seus pedidos a seguir
            </p>
          </header>
          <div className="mt-6 flex flex-col gap-5">
            {prontos.map((order) => (
              <article
                key={order.id}
                className="flex items-stretch gap-5 rounded-3xl border border-emerald-200/70 bg-white/95 p-5 shadow-[0_22px_55px_-28px_rgba(16,185,129,0.6)] backdrop-blur-sm"
              >
                <div className="flex min-w-[8rem] flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 via-emerald-400/10 to-emerald-500/0 px-6 py-5 md:min-w-[9rem]">
                  <span className="text-6xl font-black leading-none text-emerald-700 md:text-7xl">{order.id}</span>
                </div>
                <span
                  className="hidden h-full w-px self-stretch bg-gradient-to-b from-transparent via-emerald-400/60 to-transparent md:inline-flex"
                  aria-hidden="true"
                />
                <div className="flex flex-1 items-center rounded-2xl bg-white/80 px-8 py-5">
                  <span className="truncate text-4xl font-extrabold text-emerald-900 md:text-5xl">{order.cliente_nome || "Cliente"}</span>
                </div>
              </article>
            ))}
            {prontos.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-300/70 bg-white/70 px-6 py-12 text-center text-emerald-600">
                <ReadyIcon className="mb-3 h-10 w-10" />
                <span className="text-lg font-semibold">Nenhum pedido pronto para retirada agora</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
