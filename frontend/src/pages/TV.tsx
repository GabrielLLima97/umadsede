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
type TvSettings = {
  fontScale: number;
  columnRatio: number;
  cardSpacing: number;
};

const DEFAULT_SETTINGS: TvSettings = {
  fontScale: 1.25,
  columnRatio: 0.35,
  cardSpacing: 28,
};

const SETTINGS_STORAGE_KEY = "tv-display-settings-v1";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const PALETTES: Record<
  Tone,
  {
    id: string;
    accent: string;
    background: string;
  }
> = {
  warm: {
    id: "bg-gradient-to-br from-amber-500/15 via-amber-400/10 to-amber-500/0 text-amber-800",
    accent: "border-amber-200",
    background: "bg-white",
  },
  fresh: {
    id: "bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-emerald-500/0 text-emerald-800",
    accent: "border-emerald-200",
    background: "bg-white",
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
  fontScale,
  cardSpacing,
}: {
  title: string;
  subtitle: string;
  tone: Tone;
  icon: JSX.Element;
  children: ReactNode;
  fontScale: number;
  cardSpacing: number;
}) {
  const palette = PALETTES[tone];
  const headingSize = Math.max(2.4, 2.4 * fontScale);
  const subtitleSize = Math.max(1.1, 1.1 * fontScale);
  const badgeSize = Math.max(0.65, 0.7 * fontScale);

  return (
    <section
      className={`flex h-full flex-col gap-6 rounded-[28px] border p-6 shadow-lg ${palette.accent} ${palette.background}`}
    >
      <header className="flex flex-col gap-3 text-center">
        <div
          className="mx-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 font-semibold uppercase tracking-[0.3em] text-slate-500"
          style={{ fontSize: `${badgeSize}rem` }}
        >
          {icon}
          {title}
        </div>
        <h2 className="font-black text-slate-900" style={{ fontSize: `${headingSize}rem`, lineHeight: 1.1 }}>
          {title}
        </h2>
        <p className="font-medium text-slate-500" style={{ fontSize: `${subtitleSize}rem` }}>
          {subtitle}
        </p>
      </header>
      <div className="flex flex-col" style={{ gap: `${cardSpacing}px` }}>
        {children}
      </div>
    </section>
  );
}

function OrderRow({ order, tone, fontScale }: { order: Order; tone: Tone; fontScale: number }) {
  const palette = PALETTES[tone];
  const idSizeRem = Math.max(2.2, 2.4 * fontScale);
  const badgeSizeRem = Math.max(4.5, 5 * fontScale);
  const nameSizeRem = Math.max(1.8, 2.1 * fontScale);

  const badgeStyle = {
    width: `${badgeSizeRem}rem`,
    height: `${badgeSizeRem}rem`,
    fontSize: `${idSizeRem}rem`,
  };

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex items-center justify-center rounded-2xl font-black ${palette.id}`} style={badgeStyle}>
          {order.id}
        </div>
        <div className="flex min-w-0 flex-1">
          <span
            className="break-words font-extrabold text-slate-900"
            style={{ fontSize: `${nameSizeRem}rem`, lineHeight: 1.1 }}
          >
            {order.cliente_nome || "Cliente"}
          </span>
        </div>
      </div>
    </article>
  );
}

function EmptyState({
  icon,
  message,
  fontScale,
  tone,
}: {
  icon: JSX.Element;
  message: string;
  fontScale: number;
  tone: Tone;
}) {
  const messageSize = Math.max(1, 1.15 * fontScale);
  const accent = tone === "warm" ? "text-amber-500" : "text-emerald-500";
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm font-semibold text-slate-500">
      <div className={accent}>{icon}</div>
      <span style={{ fontSize: `${messageSize}rem` }}>{message}</span>
    </div>
  );
}

export default function TV() {
  const [producao, setProducao] = useState<Order[]>([]);
  const [prontos, setProntos] = useState<Order[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<TvSettings>(DEFAULT_SETTINGS);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TvSettings>;
      setSettings((prev) => ({
        fontScale: clamp(parsed.fontScale ?? prev.fontScale, 0.8, 1.8),
        columnRatio: clamp(parsed.columnRatio ?? prev.columnRatio, 0.2, 0.6),
        cardSpacing: clamp(parsed.cardSpacing ?? prev.cardSpacing, 12, 80),
      }));
    } catch (error) {
      console.warn("Não foi possível carregar as preferências da TV:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const pedidosProducao = useMemo(() => producao, [producao]);
  const pedidosProntos = useMemo(() => prontos, [prontos]);

  const productionShare = clamp(settings.columnRatio, 0.2, 0.6);
  const readyShare = clamp(1 - productionShare, 0.4, 0.8);
  const columnTemplate = `minmax(0, ${productionShare}fr) minmax(0, ${readyShare}fr)`;
  const columnGap = Math.max(20, settings.cardSpacing + 10);

  return (
    <div className="min-h-screen w-full bg-[#f7f3ee] px-4 py-10 font-burger text-slate-900 md:px-8 lg:px-12">
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700"
        >
          <SettingsIcon className="h-4 w-4" />
          Ajustar exibição
        </button>
      </div>
      <div
        className="mx-auto grid w-full max-w-[1800px]"
        style={{ gap: `${columnGap}px`, gridTemplateColumns: columnTemplate }}
      >
        <div className="flex flex-col" style={{ gap: `${settings.cardSpacing}px` }}>
          <Section
            title="Em produção"
            subtitle="Pedidos que a cozinha está finalizando"
            tone="warm"
            icon={<ProductionIcon className="h-4 w-4" />}
            fontScale={settings.fontScale}
            cardSpacing={settings.cardSpacing}
          >
            {pedidosProducao.length > 0 ? (
              pedidosProducao.map((order) => (
                <OrderRow key={order.id} order={order} tone="warm" fontScale={settings.fontScale} />
              ))
            ) : (
              <EmptyState
                icon={<ProductionIcon className="h-6 w-6" />}
                message="Nenhum pedido em produção agora."
                fontScale={settings.fontScale}
                tone="warm"
              />
            )}
          </Section>
        </div>

        <div className="flex flex-col" style={{ gap: `${settings.cardSpacing}px` }}>
          <Section
            title="Prontos para retirada"
            subtitle="Pedidos liberados para os clientes"
            tone="fresh"
            icon={<ReadyIcon className="h-4 w-4" />}
            fontScale={settings.fontScale}
            cardSpacing={settings.cardSpacing}
          >
            {pedidosProntos.length > 0 ? (
              pedidosProntos.map((order) => (
                <OrderRow key={order.id} order={order} tone="fresh" fontScale={settings.fontScale} />
              ))
            ) : (
              <EmptyState
                icon={<ReadyIcon className="h-6 w-6" />}
                message="Nenhum pedido pronto no momento."
                fontScale={settings.fontScale}
                tone="fresh"
              />
            )}
          </Section>
        </div>
      </div>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onChange={setSettings}
          onReset={() => setSettings(DEFAULT_SETTINGS)}
        />
      )}
    </div>
  );
}

function SettingsModal({
  settings,
  onChange,
  onClose,
  onReset,
}: {
  settings: TvSettings;
  onChange: (value: TvSettings | ((prev: TvSettings) => TvSettings)) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const update = (partial: Partial<TvSettings>) =>
    onChange((prev) => ({
      ...prev,
      ...partial,
    }));

  const productionPercent = Math.round(clamp(settings.columnRatio, 0.2, 0.6) * 100);
  const readyPercent = 100 - productionPercent;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white p-6 text-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-2xl font-black">Ajustes da TV</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Ajuste a exibição conforme o ambiente. As configurações ficam salvas apenas nesta máquina.
        </p>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
              <label htmlFor="fontScale">Escala da fonte</label>
              <span>{Math.round(settings.fontScale * 100)}%</span>
            </div>
            <input
              id="fontScale"
              type="range"
              min={0.9}
              max={1.8}
              step={0.05}
              value={settings.fontScale}
              onChange={(event) => update({ fontScale: Number(event.target.value) })}
              className="w-full accent-slate-900"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
              <label htmlFor="columnRatio">Proporção das colunas</label>
              <span>
                {productionPercent}% produção / {readyPercent}% retirada
              </span>
            </div>
            <input
              id="columnRatio"
              type="range"
              min={0.25}
              max={0.5}
              step={0.01}
              value={settings.columnRatio}
              onChange={(event) => update({ columnRatio: Number(event.target.value) })}
              className="w-full accent-slate-900"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
              <label htmlFor="cardSpacing">Espaçamento entre pedidos</label>
              <span>{settings.cardSpacing}px</span>
            </div>
            <input
              id="cardSpacing"
              type="range"
              min={12}
              max={80}
              step={4}
              value={settings.cardSpacing}
              onChange={(event) => update({ cardSpacing: Number(event.target.value) })}
              className="w-full accent-slate-900"
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Restaurar padrão
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z" />
      <path d="m19.4 15 .6 3.2-3.2.6-1.2 2.6-3-1.2-3 1.2-1.2-2.6-3.2-.6.6-3.2-2-2.4 2-2.4-.6-3.2 3.2-.6 1.2-2.6 3 1.2 3-1.2 1.2 2.6 3.2.6-.6 3.2 2 2.4-2 2.4Z" />
    </svg>
  );
}
