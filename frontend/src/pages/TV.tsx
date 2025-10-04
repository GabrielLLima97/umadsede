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
  productionFontScale: number;
  readyFontScale: number;
  productionTitleScale: number;
  readyTitleScale: number;
  columnRatio: number;
  cardSpacing: number;
};

const DEFAULT_SETTINGS: TvSettings = {
  productionFontScale: 1.1,
  readyFontScale: 1.1,
  productionTitleScale: 1,
  readyTitleScale: 1,
  columnRatio: 0.35,
  cardSpacing: 16,
};

const SETTINGS_STORAGE_KEY = "tv-display-settings-v1";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const PALETTES: Record<
  Tone,
  {
    id: string;
    accent: string;
    background: string;
    header: string;
  }
> = {
  warm: {
    id: "text-amber-600",
    accent: "border-amber-200/80",
    background: "bg-gradient-to-br from-amber-50 via-orange-50 to-white",
    header: "text-amber-700",
  },
  fresh: {
    id: "text-emerald-600",
    accent: "border-emerald-200/80",
    background: "bg-gradient-to-br from-emerald-50 via-lime-50 to-white",
    header: "text-emerald-700",
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
  cardSpacing,
  titleScale,
}: {
  title: string;
  subtitle: string;
  tone: Tone;
  icon: JSX.Element;
  children: ReactNode;
  cardSpacing: number;
  titleScale: number;
}) {
  const palette = PALETTES[tone];
  const titleSizeRem = Math.max(1.8, 2.4 * titleScale);
  const subtitleSizeRem = Math.max(0.9, 1.1 * titleScale);

  return (
    <section
      className={`flex h-full flex-col rounded-3xl border ${palette.accent} ${palette.background} backdrop-blur-sm`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 text-left">
        <div className="flex items-center gap-3">
          <div
            className={`inline-flex items-center justify-center rounded-full border border-slate-200/70 bg-white/80 p-2 text-xs font-semibold uppercase tracking-[0.35em] ${palette.header}`}
          >
            {icon}
          </div>
          <div className="flex flex-col leading-tight">
            <span className={`font-black ${palette.header}`} style={{ fontSize: `${titleSizeRem}rem` }}>
              {title}
            </span>
            <span className="text-slate-600" style={{ fontSize: `${subtitleSizeRem}rem` }}>
              {subtitle}
            </span>
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col px-4 py-3" style={{ gap: `${cardSpacing}px` }}>
        {children}
      </div>
    </section>
  );
}

function OrderRow({ order, tone, fontScale }: { order: Order; tone: Tone; fontScale: number }) {
  const palette = PALETTES[tone];
  const nameSizeRem = Math.max(2, 2.3 * fontScale);
  const badgePadding = Math.max(0.6, 0.9 * fontScale);
  const badgeFontRem = Math.max(2.2, 2.4 * fontScale);

  return (
    <article
      className="flex flex-col gap-2 rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3"
      style={{ boxShadow: "0 16px 32px rgba(15, 23, 42, 0.08)" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`inline-flex items-center justify-center rounded-full bg-white shadow-inner px-4 font-black leading-none ${palette.id}`}
          style={{ fontSize: `${badgeFontRem}rem`, padding: `${badgePadding}rem` }}
        >
          {order.id}
        </div>
        <div className="flex min-w-0 flex-1">
          <span
            className="break-words font-extrabold text-slate-900"
            style={{ fontSize: `${nameSizeRem}rem`, lineHeight: 1.05 }}
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
  const messageSize = Math.max(1.2, 1.2 * fontScale);
  const accent = tone === "warm" ? "text-amber-500" : "text-emerald-500";
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200/70 bg-white/90 px-6 py-12 text-center text-sm font-semibold text-slate-500">
      <div className={`${accent} opacity-80`}>{icon}</div>
      <span style={{ fontSize: `${messageSize}rem` }} className="text-slate-700">
        {message}
      </span>
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
        productionFontScale: clamp(
          parsed.productionFontScale ?? parsed.fontScale ?? prev.productionFontScale,
          0.8,
          1.8,
        ),
        readyFontScale: clamp(
          parsed.readyFontScale ?? parsed.fontScale ?? prev.readyFontScale,
          0.8,
          1.8,
        ),
        productionTitleScale: clamp(parsed.productionTitleScale ?? prev.productionTitleScale, 0.8, 1.5),
        readyTitleScale: clamp(parsed.readyTitleScale ?? prev.readyTitleScale, 0.8, 1.5),
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
  const columnGap = Math.max(12, settings.cardSpacing + 4);

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#f7f3ee] font-burger text-slate-900">
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="absolute right-3 top-3 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        style={{ boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)" }}
        aria-label="Ajustar exibição"
      >
        <SettingsIcon className="h-5 w-5" />
      </button>
      <div
        className="grid flex-1 gap-3 p-3 md:p-4"
        style={{ gap: `${columnGap}px`, gridTemplateColumns: columnTemplate }}
      >
        <div className="flex h-full flex-col" style={{ gap: `${settings.cardSpacing}px` }}>
          <Section
            title="Em produção"
            subtitle="Pedidos que a cozinha está finalizando"
            tone="warm"
            icon={<ProductionIcon className="h-4 w-4" />}
            cardSpacing={settings.cardSpacing}
            titleScale={settings.productionTitleScale}
          >
            {pedidosProducao.length > 0 ? (
              pedidosProducao.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  tone="warm"
                  fontScale={settings.productionFontScale}
                />
              ))
            ) : (
              <EmptyState
                icon={<ProductionIcon className="h-6 w-6" />}
                message="Nenhum pedido em produção agora."
                fontScale={settings.productionFontScale}
                tone="warm"
              />
            )}
          </Section>
        </div>

        <div className="flex h-full flex-col" style={{ gap: `${settings.cardSpacing}px` }}>
          <Section
            title="Prontos para retirada"
            subtitle="Pedidos liberados para os clientes"
            tone="fresh"
            icon={<ReadyIcon className="h-4 w-4" />}
            cardSpacing={settings.cardSpacing}
            titleScale={settings.readyTitleScale}
          >
            {pedidosProntos.length > 0 ? (
              pedidosProntos.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  tone="fresh"
                  fontScale={settings.readyFontScale}
                />
              ))
            ) : (
              <EmptyState
                icon={<ReadyIcon className="h-6 w-6" />}
                message="Nenhum pedido pronto no momento."
                fontScale={settings.readyFontScale}
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
              <label htmlFor="productionFontScale">Fonte dos itens (Em produção)</label>
              <span>{Math.round(settings.productionFontScale * 100)}%</span>
            </div>
            <input
              id="productionFontScale"
              type="range"
              min={0.8}
              max={1.8}
              step={0.05}
              value={settings.productionFontScale}
              onChange={(event) => update({ productionFontScale: Number(event.target.value) })}
              className="w-full accent-slate-900"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
              <label htmlFor="readyFontScale">Fonte dos itens (Prontos)</label>
              <span>{Math.round(settings.readyFontScale * 100)}%</span>
            </div>
            <input
              id="readyFontScale"
              type="range"
              min={0.8}
              max={1.8}
              step={0.05}
              value={settings.readyFontScale}
              onChange={(event) => update({ readyFontScale: Number(event.target.value) })}
              className="w-full accent-slate-900"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
              <label htmlFor="productionTitleScale">Fonte de "Em produção"</label>
              <span>{Math.round(settings.productionTitleScale * 100)}%</span>
            </div>
            <input
              id="productionTitleScale"
              type="range"
              min={0.8}
              max={1.5}
              step={0.05}
              value={settings.productionTitleScale}
              onChange={(event) => update({ productionTitleScale: Number(event.target.value) })}
              className="w-full accent-slate-900"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
              <label htmlFor="readyTitleScale">Fonte de "Prontos"</label>
              <span>{Math.round(settings.readyTitleScale * 100)}%</span>
            </div>
            <input
              id="readyTitleScale"
              type="range"
              min={0.8}
              max={1.5}
              step={0.05}
              value={settings.readyTitleScale}
              onChange={(event) => update({ readyTitleScale: Number(event.target.value) })}
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
