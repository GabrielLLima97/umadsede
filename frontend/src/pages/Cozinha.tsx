import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { OrderCard } from "../components/Kanban"; // permanece importado caso use seu card atual

// =============================
// Utilitários
// =============================
function debounce<T extends (...args: any[]) => void>(fn: T, ms = 250) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

/** Busca todas as páginas de um endpoint tipo DRF (results/next) ou um array simples */
async function fetchAllPaginated(path: string, pageSize = 200) {
  const all: any[] = [];
  // Garante limit no path
  const hasQuery = path.includes("?");
  let url: string | null = `${path}${hasQuery ? "&" : "?"}limit=${pageSize}&offset=0`;

  while (url) {
    const res = await api.get(url);
    const data = res.data;
    const page = Array.isArray(data) ? data : (data.results ?? data ?? []);
    if (Array.isArray(page)) all.push(...page);

    // DRF: data.next pode ser URL absoluta
    const next = Array.isArray(data) ? null : (data.next ?? null);
    url = next ? next : null;

    // Fallback simples, caso back não exponha next, mas retorne sempre pageSize
    if (!url && !Array.isArray(data) && Array.isArray(page) && page.length === pageSize) {
      try {
        const base = new URL(path, window.location.origin);
        const curOffset = Number(base.searchParams.get("offset") ?? "0");
        base.searchParams.set("limit", String(pageSize));
        base.searchParams.set("offset", String(curOffset + pageSize));
        url = base.pathname + "?" + base.searchParams.toString();
      } catch {
        // ignora
      }
    }
  }
  return all;
}

// =============================
// Tipos mínimos
// =============================
export type Pedido = {
  id: number;
  status: string;
  created_at?: string;
  cliente?: string;
  cliente_nome?: string;
  itens?: Array<{ id: number; nome?: string; qtd?: number }>;
  qtd_itens?: number;
  antecipado?: boolean;
  [k: string]: any;
};

// Fluxo de status padrão da cozinha, ajuste se necessário para refletir seus valores reais
const STATUS_FLOW = ["RECEBIDO", "EM_PREPARO", "PRONTO", "ENTREGUE"] as const;
const COZINHA_COLUMNS = ["RECEBIDO", "EM_PREPARO", "PRONTO"] as const; // colunas visíveis na cozinha

const prevOf: Record<string, string | undefined> = STATUS_FLOW.reduce((acc, s, i) => {
  acc[s] = i > 0 ? STATUS_FLOW[i - 1] : undefined;
  return acc;
}, {} as Record<string, string | undefined>);

const nextOf: Record<string, string | undefined> = STATUS_FLOW.reduce((acc, s, i) => {
  acc[s] = i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : undefined;
  return acc;
}, {} as Record<string, string | undefined>);

// =============================
// Subpágina em Lista
// =============================
function ListaCozinha({
  pedidos,
  onPrev,
  onNext,
  onToggleAntecipado,
}: {
  pedidos: Pedido[];
  onPrev: (p: Pedido) => void;
  onNext: (p: Pedido) => void;
  onToggleAntecipado: (p: Pedido, v: boolean) => void;
}) {
  return (
    <div className="overflow-auto rounded border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">Cliente</th>
            <th className="p-2 text-left">Itens</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Antecipado</th>
            <th className="p-2 text-left">Ações</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.id}</td>
              <td className="p-2">{p.cliente_nome ?? p.cliente ?? "-"}</td>
              <td className="p-2">{p.itens?.length ?? p.qtd_itens ?? "-"}</td>
              <td className="p-2 font-medium">{p.status}</td>
              <td className="p-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!p.antecipado}
                    onChange={(e) => onToggleAntecipado(p, e.target.checked)}
                  />
                  <span>{p.antecipado ? "Sim" : "Não"}</span>
                </label>
              </td>
              <td className="p-2">
                <div className="flex gap-2">
                  {prevOf[p.status] && (
                    <button className="px-2 py-1 border rounded" onClick={() => onPrev(p)}>
                      ← {prevOf[p.status]}
                    </button>
                  )}
                  {nextOf[p.status] && (
                    <button className="px-2 py-1 border rounded" onClick={() => onNext(p)}>
                      {nextOf[p.status]} →
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {pedidos.length === 0 && (
            <tr>
              <td className="p-4 text-center text-gray-500" colSpan={6}>
                Sem pedidos nesta fila
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// =============================
// Componente principal
// =============================
export default function Cozinha() {
  const [dados, setDados] = useState<Pedido[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [mostrarAntecipados, setMostrarAntecipados] = useState(false);
  const [mostrarResumoItens, setMostrarResumoItens] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");

  const PAGE_SIZE = 200; // pode ajustar
  const COZINHA_STATUSES = COZINHA_COLUMNS as unknown as string[];

  // =============================
  // Ações
  // =============================
  const updateStatus = async (id: number, status: string | undefined) => {
    if (!status) return;
    try {
      await api.patch(`/orders/${id}/`, { status });
      setDados((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    } catch (e) {
      console.error("Falha ao atualizar status", e);
    }
  };

  const toggleAntecipado = async (id: number, v: boolean) => {
    try {
      await api.patch(`/orders/${id}/`, { antecipado: v });
      setDados((prev) => prev.map((p) => (p.id === id ? { ...p, antecipado: v } : p)));
    } catch (e) {
      console.error("Falha ao alternar antecipado", e);
    }
  };

  const carregar = async () => {
    // Ordenação estável por created_at asc, ajuste se necessário
    const ordersPath = `/orders/?status__in=${COZINHA_STATUSES.join(",")}&ordering=created_at`;
    const allOrders = await fetchAllPaginated(ordersPath, PAGE_SIZE);

    setDados((prev) => {
      const mapPrev = new Map(prev.map((p) => [p.id, p]));
      for (const o of allOrders) mapPrev.set(o.id, { ...(mapPrev.get(o.id) ?? {}), ...o });
      // somente os que interessam à cozinha e ordenação estável
      const merged = Array.from(mapPrev.values())
        .filter((p) => COZINHA_STATUSES.includes(p.status))
        .sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return ta - tb;
        });
      return merged;
    });
  };

  // =============================
  // WebSocket + heartbeat + primeira carga
  // =============================
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    const host = window.location.hostname + (window.location.port === "5173" ? ":8000" : "");
    const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsProto}://${host}/ws/orders`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      const safeReload = debounce(carregar, 300);
      ws.onmessage = () => safeReload();
      ws.onerror = (e) => console.warn("WS erro cozinha:", e);
      ws.onclose = () => {};
    } catch (e) {
      console.warn("Falha WS cozinha", e);
    }

    const t = window.setInterval(() => setNow(Date.now()), 5000);
    carregar(); // primeira carga completa

    return () => {
      if (wsRef.current) try { wsRef.current.close(); } catch {}
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =============================
  // Derivados e filtros
  // =============================
  const pedidosFiltrados = useMemo(() => {
    let arr = dados;
    if (mostrarAntecipados) arr = arr.filter((p) => !!p.antecipado);
    return arr;
  }, [dados, mostrarAntecipados]);

  const porColuna = useMemo(() => {
    const groups: Record<string, Pedido[]> = {};
    for (const col of COZINHA_COLUMNS) groups[col] = [];
    for (const p of pedidosFiltrados) if (groups[p.status]) groups[p.status].push(p);
    return groups;
  }, [pedidosFiltrados]);

  // =============================
  // UI auxiliar
  // =============================
  function SmallCard({ p }: { p: Pedido }) {
    return (
      <div className="rounded-xl border p-3 bg-white shadow-sm flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">#{p.id}</span>
          <span className="opacity-60">{p.cliente_nome ?? p.cliente ?? "Cliente"}</span>
        </div>
        <div className="text-xs opacity-70">{p.itens?.length ?? p.qtd_itens ?? 0} itens</div>
        <div className="flex items-center gap-2">
          {prevOf[p.status] && (
            <button
              className="px-2 py-1 border rounded text-xs"
              onClick={() => updateStatus(p.id, prevOf[p.status])}
            >
              ← {prevOf[p.status]}
            </button>
          )}
          {nextOf[p.status] && (
            <button
              className="px-2 py-1 border rounded text-xs"
              onClick={() => updateStatus(p.id, nextOf[p.status])}
            >
              {nextOf[p.status]} →
            </button>
          )}
          <label className="ml-auto inline-flex items-center gap-1 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!p.antecipado}
              onChange={(e) => toggleAntecipado(p.id, e.target.checked)}
            />
            Antecipado
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Barra de controles */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`px-3 py-1 rounded ${viewMode === "kanban" ? "bg-black text-white" : "bg-gray-200"}`}
          onClick={() => setViewMode("kanban")}
        >
          Kanban
        </button>
        <button
          className={`px-3 py-1 rounded ${viewMode === "lista" ? "bg-black text-white" : "bg-gray-200"}`}
          onClick={() => setViewMode("lista")}
        >
          Lista
        </button>

        <label className="ml-2 inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={mostrarAntecipados}
            onChange={(e) => setMostrarAntecipados(e.target.checked)}
          />
          <span className="text-sm">Somente antecipados</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={mostrarResumoItens}
            onChange={(e) => setMostrarResumoItens(e.target.checked)}
          />
          <span className="text-sm">Resumo de itens</span>
        </label>

        <div className="ml-auto text-xs opacity-60">{new Date(now).toLocaleTimeString()}</div>
      </div>

      {/* Conteúdo */}
      {viewMode === "lista" ? (
        <ListaCozinha
          pedidos={pedidosFiltrados}
          onPrev={(p) => updateStatus(p.id, prevOf[p.status])}
          onNext={(p) => updateStatus(p.id, nextOf[p.status])}
          onToggleAntecipado={(p, v) => toggleAntecipado(p.id, v)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {COZINHA_COLUMNS.map((col) => (
            <div key={col} className="rounded-xl border bg-gray-50">
              <div className="p-3 border-b flex items-center justify-between">
                <h3 className="font-semibold">{col}</h3>
                <span className="text-xs opacity-60">{porColuna[col].length}</span>
              </div>
              <div className="p-3 flex flex-col gap-2 min-h-[200px]">
                {porColuna[col].map((p) => (
                  // Preferencialmente use seu OrderCard se já esperar essas props
                  // <OrderCard key={p.id} order={p} onPrev={() => updateStatus(p.id, prevOf[p.status])} onNext={() => updateStatus(p.id, nextOf[p.status])} onToggleAntecipado={(v:boolean)=>toggleAntecipado(p.id,v)} />
                  <SmallCard key={p.id} p={p} />
                ))}
                {porColuna[col].length === 0 && (
                  <div className="text-xs text-center opacity-50 py-6">Sem pedidos</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
