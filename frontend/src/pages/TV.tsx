import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";

type Order = {
  id: number;
  cliente_nome?: string;
  status: string;
  created_at: string;
};

const PRODUCTION_STATUSES = ["pago", "a preparar", "em produção"];
const READY_STATUSES = ["pronto"];

const STATUS_META: Record<string, { label: string; badge: string; text: string }> = {
  pago: {
    label: "Pago",
    badge: "border-sky-300 bg-sky-100/80 text-sky-800",
    text: "text-sky-700",
  },
  "a preparar": {
    label: "A preparar",
    badge: "border-amber-300 bg-amber-100/80 text-amber-800",
    text: "text-amber-700",
  },
  "em produção": {
    label: "Em produção",
    badge: "border-orange-300 bg-orange-100/80 text-orange-800",
    text: "text-orange-700",
  },
  pronto: {
    label: "Pronto",
    badge: "border-emerald-300 bg-emerald-100/80 text-emerald-800",
    text: "text-emerald-700",
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

function StatusBadge({ status }: { status: string }) {
  const base = STATUS_META[status];
  if (!base) {
    return null;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${base.badge}`}
    >
      {base.label}
    </span>
  );
}

function OrderCard({ order, tone }: { order: Order; tone: "amber" | "emerald" }) {
  const statusMeta = STATUS_META[order.status];
  const accentClasses =
    tone === "amber"
      ? "from-amber-500/20 via-amber-400/10 to-amber-500/0 text-amber-700"
      : "from-emerald-500/20 via-emerald-400/10 to-emerald-500/0 text-emerald-700";

  const borderClasses =
    tone === "amber"
      ? "border border-amber-200/70 shadow-[0_18px_45px_-30px_rgba(217,119,6,0.45)]"
      : "border border-emerald-200/70 shadow-[0_22px_55px_-28px_rgba(16,185,129,0.5)]";

  return (
    <article className={`flex h-full flex-col gap-4 rounded-3xl bg-white/92 p-5 backdrop-blur-sm ${borderClasses}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex min-w-[5.5rem] flex-col items-center justify-center rounded-2xl bg-gradient-to-br px-4 py-3 text-5xl font-black leading-none ${accentClasses}`}>
          {order.id}
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="truncate text-3xl font-extrabold text-slate-900 md:text-4xl">
          {order.cliente_nome || "Cliente"}
        </span>
        {statusMeta && (
          <span className={`text-sm font-semibold ${statusMeta.text}`}>{statusMeta.label}</span>
        )}
      </div>
    </article>
  );
}

function EmptyState({ tone, message }: { tone: "amber" | "emerald"; message: string }) {
  const Icon = tone === "amber" ? ProductionIcon : ReadyIcon;
  const border = tone === "amber" ? "border-amber-300/70 text-amber-600" : "border-emerald-300/70 text-emerald-600";
  return (
    <div className={`flex h-full flex-col items-center justify-center rounded-2xl border border-dashed bg-white/60 px-6 py-12 text-center text-sm font-semibold ${border}`}>
      <Icon className="mb-3 h-10 w-10" />
      <span className="text-base">{message}</span>
    </div>
  );
}

function SectionWrapper({
  title,
  subtitle,
  tone,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  tone: "amber" | "emerald";
  icon: JSX.Element;
  children: ReactNode;
}) {
  const border = tone === "amber" ? "border-amber-200/70" : "border-emerald-200/70";
  const gradient = tone === "amber" ? "from-amber-50 via-white to-white/90" : "from-emerald-50 via-white to-white/90";
  const shadow =
    tone === "amber"
      ? "shadow-[0_30px_70px_-45px_rgba(217,119,6,0.6)]"
      : "shadow-[0_32px_80px_-45px_rgba(16,185,129,0.6)]";

  return (
    <section
      className={`relative flex min-h-[480px] flex-col rounded-[2.25rem] border ${border} bg-gradient-to-br ${gradient} p-6 text-slate-900 ${shadow}`}
    >
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-600">
          {icon}
          {title}
        </div>
        <h2 className="text-4xl font-black md:text-5xl">{title}</h2>
        <p className="text-sm font-medium text-slate-500 md:text-base">{subtitle}</p>
      </header>
      <div className="mt-8 flex-1">{children}</div>
    </section>
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
        setProntos(arr.filter((p) => READY_STATUSES.includes(p.status)).sort(byCreated));
        setProducao(arr.filter((p) => PRODUCTION_STATUSES.includes(p.status)).sort(byCreated));
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

  const sortedProducao = useMemo(() => producao, [producao]);
  const sortedProntos = useMemo(() => prontos, [prontos]);

  return (
    <div className="min-h-screen w-full bg-slate-950 px-6 pb-12 pt-10 font-burger text-white md:px-10">
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-10">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <SectionWrapper
            title="Em produção"
            subtitle="Acompanhe pedidos em preparo e recém pagos"
            tone="amber"
            icon={<ProductionIcon className="h-4 w-4" />}
          >
            {sortedProducao.length > 0 ? (
              <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 [@media(min-width:1920px)]:grid-cols-5">
                {sortedProducao.map((order) => (
                  <OrderCard key={order.id} order={order} tone="amber" />
                ))}
              </div>
            ) : (
              <EmptyState tone="amber" message="Sem pedidos em produção agora." />
            )}
          </SectionWrapper>

          <SectionWrapper
            title="Prontos para retirada"
            subtitle="Pedidos liberados para o cliente"
            tone="emerald"
            icon={<ReadyIcon className="h-4 w-4" />}
          >
            {sortedProntos.length > 0 ? (
              <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 [@media(min-width:1920px)]:grid-cols-5">
                {sortedProntos.map((order) => (
                  <OrderCard key={order.id} order={order} tone="emerald" />
                ))}
              </div>
            ) : (
              <EmptyState tone="emerald" message="Nenhum pedido pronto no momento." />
            )}
          </SectionWrapper>
        </div>
      </div>
    </div>
  );
}
