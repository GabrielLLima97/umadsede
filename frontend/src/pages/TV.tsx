import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";

type Order = {
  id: number;
  cliente_nome?: string;
  status: string;
  created_at: string;
};

const PRODUCTION_STATUS = "em produção";
const READY_STATUS = "pronto";

type Tone = "warm" | "fresh";

type Palette = {
  badge: string;
  id: string;
  accent: string;
};

const PALETTES: Record<Tone, Palette> = {
  warm: {
    badge: "border-amber-400 bg-amber-50 text-amber-700",
    id: "bg-gradient-to-br from-amber-500/15 via-amber-400/10 to-amber-500/0 text-amber-800",
    accent: "border-amber-200",
  },
  fresh: {
    badge: "border-emerald-400 bg-emerald-50 text-emerald-700",
    id: "bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-emerald-500/0 text-emerald-800",
    accent: "border-emerald-200",
  },
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
      className={className ?? "h-5 w-5"}
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
      className={className ?? "h-5 w-5"}
      aria-hidden="true"
    >
      <path d="M4 8h16l-1.5 9a3 3 0 0 1-3 2.6H8.5a3 3 0 0 1-3-2.6L4 8Z" />
      <path d="M9.5 5.5h5" />
      <path d="m9.5 12 2 2 3.5-3.5" />
    </svg>
  );
}

function Section({
  title,
  subtitle,
  tone,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  tone: Tone;
  icon: JSX.Element;
  children: ReactNode;
}) {
  const palette = PALETTES[tone];

  return (
    <section className={`flex flex-col gap-6 rounded-[28px] border bg-white/95 p-6 shadow-lg ${palette.accent}`}>
      <header className="flex flex-col gap-3 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          {icon}
          {title}
        </div>
        <h2 className="text-3xl font-black text-slate-900 md:text-4xl">{title}</h2>
        <p className="text-sm font-medium text-slate-500 md:text-base">{subtitle}</p>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function OrderRow({ order, tone }: { order: Order; tone: Tone }) {
  const palette = PALETTES[tone];

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-black ${palette.id}`}>{order.id}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="break-words text-2xl font-extrabold text-slate-900 md:text-3xl">{order.cliente_nome || "Cliente"}</span>
          <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${palette.badge}`}>
            {order.status}
          </span>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ icon, message }: { icon: JSX.Element; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm font-semibold text-slate-500">
      {icon}
      <span>{message}</span>
    </div>
  );
}

export default function TV() {
  const [producao, setProducao] = useState<Order[]>([]);
  const [prontos, setProntos] = useState<Order[]>([]);

  useEffect(() => {
    const carregar = () =>
      api.get("/orders/").then((r) => {
        const data = (r.data?.results || r.data || []) as Order[];
        const arr = Array.isArray(data) ? data : [];
        const byCreated = (a: Order, b: Order) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        setProducao(arr.filter((p) => p.status === PRODUCTION_STATUS).sort(byCreated));
        setProntos(arr.filter((p) => p.status === READY_STATUS).sort(byCreated));
      });

    carregar();
    const interval = setInterval(carregar, 5000);

    const host = window.location.hostname + (window.location.port === "5173" ? ":8000" : "");
    const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${wsProto}://${host}/ws/orders`);
    ws.onmessage = () => carregar();
    ws.onerror = () => {};

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const pedidosProducao = useMemo(() => producao, [producao]);
  const pedidosProntos = useMemo(() => prontos, [prontos]);

  return (
    <div className="min-h-screen w-full bg-[#f7f3ee] px-6 py-10 font-burger text-slate-900 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <Section
          title="Em produção"
          subtitle="Pedidos que a cozinha está finalizando"
          tone="warm"
          icon={<ProductionIcon className="h-4 w-4" />}
        >
          {pedidosProducao.length > 0 ? (
            pedidosProducao.map((order) => <OrderRow key={order.id} order={order} tone="warm" />)
          ) : (
            <EmptyState icon={<ProductionIcon className="h-6 w-6 text-amber-500" />} message="Nenhum pedido em produção agora." />
          )}
        </Section>

        <Section
          title="Prontos para retirada"
          subtitle="Pedidos liberados para os clientes"
          tone="fresh"
          icon={<ReadyIcon className="h-4 w-4" />}
        >
          {pedidosProntos.length > 0 ? (
            pedidosProntos.map((order) => <OrderRow key={order.id} order={order} tone="fresh" />)
          ) : (
            <EmptyState icon={<ReadyIcon className="h-6 w-6 text-emerald-500" />} message="Nenhum pedido pronto no momento." />
          )}
        </Section>
      </div>
    </div>
  );
}
