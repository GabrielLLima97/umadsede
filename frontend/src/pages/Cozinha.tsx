import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { OrderCard } from "../components/Kanban";

// =============================
// Utils
// =============================
function debounce<T extends (...args: any[]) => void>(fn: T, ms = 300) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

function normalizeNextToSameOrigin(nextUrl: string): string {
  try {
    const n = new URL(nextUrl, window.location.origin);
    n.protocol = window.location.protocol;
    n.host = window.location.host;
    return n.pathname + n.search;
  } catch {
    return nextUrl;
  }
}

/** Busca todas as páginas (DRF results/next ou array simples) */
async function fetchAllPaginated(path: string, pageSize = 200) {
  const all: any[] = [];
  const hasQuery = path.includes("?");
  // IMPORTANTE: path SEM /api no começo
  let url: string | null = `${path}${hasQuery ? "&" : "?"}limit=${pageSize}&offset=0`;
  while (url) {
    const res = await api.get(url);
    const data = res.data;
    const page = Array.isArray(data) ? data : (data.results ?? data ?? []);
    if (Array.isArray(page)) all.push(...page);

    const nextRaw = Array.isArray(data) ? null : (data.next ?? null);
    if (nextRaw) {
      url = normalizeNextToSameOrigin(nextRaw);
    } else {
      url = null;
    }

    // fallback para back sem 'next'
    if (!url && !Array.isArray(data) && Array.isArray(page) && page.length === pageSize) {
      try {
        const base = new URL(path, window.location.origin);
        const curOffset = Number(base.searchParams.get("offset") ?? "0");
        base.searchParams.set("limit", String(pageSize));
        base.searchParams.set("offset", String(curOffset + pageSize));
        url = base.pathname + "?" + base.searchParams.toString();
      } catch {}
    }
  }
  return all;
}

const parseBoolean = (value: unknown) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "t", "sim", "yes"].includes(normalized);
  }
  return !!value;
};

// =============================
// Tipos
// =============================
type Pedido = {
  id: number;
  status: string; // "pago" | "a preparar" | "em produção" | "pronto" | "finalizado" (ajuste conforme seu back)
  created_at?: string;
  cliente_nome?: string;
  cliente?: string;
  itens?: Array<{ id: number; item?: number; nome?: string; qtd?: number; categoria?: string }>;
  antecipado?: boolean | string | number;
  [k: string]: any;
};

// status flow original em PT-BR
const nextOf: Record<string, string> = {
  "pago": "a preparar",
  "a preparar": "em produção",
  "em produção": "pronto",
  "pronto": "finalizado",
  "finalizado": "finalizado",
};
const prevOf: Record<string, string> = {
  "finalizado": "pronto",
  "pronto": "em produção",
  "em produção": "a preparar",
  "a preparar": "pago",
  "pago": "pago",
};

// =============================
// Subpágina Lista (novidade)
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
              <td className="p-2">{p.itens?.length ?? "-"}</td>
              <td className="p-2 font-medium">{p.status}</td>
              <td className="p-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!parseBoolean(p.antecipado)}
                    onChange={(e) => onToggleAntecipado(p, e.target.checked)}
                  />
                  <span>{parseBoolean(p.antecipado) ? "Sim" : "Não"}</span>
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
export default function Cozinha(){
  const [dados,setDados]=useState<Pedido[]>([]);
  const [itemsMap,setItemsMap]=useState<Record<number,{categoria?:string}>>({});
  const [now,setNow]=useState<number>(Date.now());
  const [mostrarAntecipados, setMostrarAntecipados] = useState(false);
  const [mostrarResumoItens, setMostrarResumoItens] = useState(false);

  // novos controles
  const [viewMode, setViewMode] = useState<"kanban"|"lista">("kanban");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");

  // carrega tudo com paginação, SEM prefixar /api aqui
  const carregar = async ()=>{
    const [allOrders, itemsResp] = await Promise.all([
      fetchAllPaginated("orders/?ordering=created_at", 200),
      api.get("items/?all=1"),
    ]);

    const itemArr = itemsResp.data?.results || itemsResp.data || [];
    const map:Record<number,{categoria?:string}> = {};
    (Array.isArray(itemArr)? itemArr : []).forEach((it:any)=>{ map[it.id] = {categoria: it.categoria}; });
    setItemsMap(map);

    const arr = Array.isArray(allOrders) ? allOrders : [];
    arr.sort((a:any,b:any)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setDados(arr);
  };

  useEffect(()=>{
    carregar();
    // WebSocket no mesmo host/esquema
    const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${wsProto}://${window.location.host}/ws/orders`);
    const safeReload = debounce(carregar, 300);
    ws.onmessage = ()=> safeReload();
    ws.onerror = ()=>{};
    const t = setInterval(()=> setNow(Date.now()), 5000);
    return ()=> { ws.close(); clearInterval(t); }
  },[]);

  // ações
  const update = (id:number, status:string)=> api.patch(`orders/${id}/status/`,{status}).then(carregar);
  const toggleAntecipado = (id:number, value:boolean) =>
    api.patch(`orders/${id}/antecipado/`, { antecipado: value }).then(carregar);

  // filtros
  const categoriaDoItem = (item: any) => itemsMap?.[item.item]?.categoria || item.categoria || "Outros";
  const matchFiltro = (pedido: Pedido) => {
    if (!filtroTexto.trim()) return true;
    const q = filtroTexto.trim().toLowerCase();
    const idMatch = String(pedido.id).includes(q);
    const nomeMatch = (pedido.cliente_nome || pedido.cliente || "").toLowerCase().includes(q);
    return idMatch || nomeMatch;
  };
  const matchCategoria = (pedido: Pedido) => {
    if (!categoriaFiltro) return true;
    return (pedido.itens || []).some((item: any) => categoriaDoItem(item) === categoriaFiltro);
  };

  const fonte = dados.filter((pedido) => {
    if (!mostrarAntecipados && parseBoolean(pedido.antecipado)) return false;
    if (!matchFiltro(pedido)) return false;
    return matchCategoria(pedido);
  });

  // resumo itens
  const itensParaProduzir = useMemo(() => {
    const map = new Map<string, { nome: string; aPreparar: number; emProducao: number; pronto: number }>();
    for (const p of fonte) {
      for (const it of (p.itens || [])) {
        const nome = it.nome || "Item";
        if (!map.has(nome)) map.set(nome, { nome, aPreparar: 0, emProducao: 0, pronto: 0 });
        const rec = map.get(nome)!;
        if (p.status === "a preparar" || p.status === "pago") rec.aPreparar += it.qtd || 1;
        else if (p.status === "em produção") rec.emProducao += it.qtd || 1;
        else if (p.status === "pronto") rec.pronto += it.qtd || 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.aPreparar + b.emProducao + b.pronto) - (a.aPreparar + a.emProducao + a.pronto));
  }, [fonte]);

  const categoriasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const p of dados) {
      for (const it of (p.itens || [])) {
        set.add(categoriaDoItem(it));
      }
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [dados, itemsMap]);

  const totalItensAPreparar = itensParaProduzir.reduce((acc, item) => acc + item.aPreparar, 0);
  const totalItensEmProducao = itensParaProduzir.reduce((acc, item) => acc + item.emProducao, 0);
  const totalItensParaProduzir = totalItensAPreparar + totalItensEmProducao;
  const formatItensLabel = (valor: number) => (valor === 1 ? "item" : "itens");
  const resumoTexto = totalItensParaProduzir
    ? `A preparar x${totalItensAPreparar} • Em produção x${totalItensEmProducao} • Total x${totalItensParaProduzir} ${formatItensLabel(totalItensParaProduzir)}`
    : "Sem itens a produzir";

  // helpers
  const col = (s:string)=> fonte.filter(p=>p.status===s);
  const sortByCreated = (arr:any[]) =>
    [...arr].sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // =============================
  // Render
  // =============================
  return (
    <div className="p-3">
      {/* Controles */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          className={`px-3 py-1 rounded ${viewMode==="kanban" ? "bg-black text-white" : "bg-gray-200"}`}
          onClick={()=>setViewMode("kanban")}
        >Kanban</button>
        <button
          className={`px-3 py-1 rounded ${viewMode==="lista" ? "bg-black text-white" : "bg-gray-200"}`}
          onClick={()=>setViewMode("lista")}
        >Lista</button>

        <input
          className="input input-bordered input-sm"
          placeholder="Buscar por #pedido ou cliente"
          value={filtroTexto}
          onChange={(e)=>setFiltroTexto(e.target.value)}
        />
        <select
          className="select select-bordered select-sm"
          value={categoriaFiltro}
          onChange={(e)=>setCategoriaFiltro(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categoriasDisponiveis.map((c)=>(
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="label cursor-pointer gap-2">
          <input type="checkbox" className="checkbox checkbox-sm" checked={mostrarAntecipados} onChange={(e)=>setMostrarAntecipados(e.target.checked)} />
          <span className="label-text text-sm">Ocultar antecipados</span>
        </label>

        <button
          className="btn btn-ghost btn-sm inline-flex items-center gap-2"
          onClick={()=> setMostrarResumoItens(x=>!x)}
          title="Resumo por item"
        >
          <span className="rounded-full border border-slate-200 bg-slate-50 p-1 text-slate-500">
            {mostrarResumoItens ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="m6 15 6-6 6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </span>
          <span className="text-slate-600">{resumoTexto}</span>
        </button>

        <div className="ml-auto text-xs opacity-60">{new Date(now).toLocaleTimeString()}</div>
      </div>

      {/* Resumo de Itens */}
      {mostrarResumoItens && (
        itensParaProduzir.length ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {itensParaProduzir.map((item) => (
              <li
                key={item.nome}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="font-medium">{item.nome}</span>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  {item.aPreparar > 0 && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">
                      A preparar x{item.aPreparar}
                    </span>
                  )}
                  {item.emProducao > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                      Em produção x{item.emProducao}
                    </span>
                  )}
                  {item.pronto > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                      Pronto x{item.pronto}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            Nada a produzir no momento
          </div>
        )
      )}

      {/* Conteúdo */}
      {viewMode === "lista" ? (
        <ListaCozinha
          pedidos={fonte}
          onPrev={(p)=>update(p.id, prevOf[p.status])}
          onNext={(p)=>update(p.id, nextOf[p.status])}
          onToggleAntecipado={(p, v)=>toggleAntecipado(p.id, v)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border">
            <div className="flex items-center justify-between border-b p-3">
              <h3 className="font-semibold">A preparar</h3>
              <span className="text-xs opacity-60">{col("a preparar").length}</span>
            </div>
            <div className="p-2 space-y-2">
              {sortByCreated(col("a preparar")).map((p)=>(
                <OrderCard
                  key={p.id}
                  p={p}
                  itemsMap={itemsMap}
                  now={now}
                  onPrev={()=>update(p.id, prevOf[p.status])}
                  onNext={()=>update(p.id, nextOf[p.status])}
                  onToggleAntecipado={(value)=>toggleAntecipado(p.id, value)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border">
            <div className="flex items-center justify-between border-b p-3">
              <h3 className="font-semibold">Em produção</h3>
              <span className="text-xs opacity-60">{col("em produção").length}</span>
            </div>
            <div className="p-2 space-y-2">
              {sortByCreated(col("em produção")).map((p)=>(
                <OrderCard
                  key={p.id}
                  p={p}
                  itemsMap={itemsMap}
                  now={now}
                  onPrev={()=>update(p.id, prevOf[p.status])}
                  onNext={()=>update(p.id, nextOf[p.status])}
                  onToggleAntecipado={(value)=>toggleAntecipado(p.id, value)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border">
            <div className="flex items-center justify-between border-b p-3">
              <h3 className="font-semibold">Pronto</h3>
              <span className="text-xs opacity-60">{col("pronto").length}</span>
            </div>
            <div className="p-2 space-y-2">
              {sortByCreated(col("pronto")).map((p)=>(
                <OrderCard
                  key={p.id}
                  p={p}
                  itemsMap={itemsMap}
                  now={now}
                  onPrev={()=>update(p.id, prevOf[p.status])}
                  onNext={()=>update(p.id, nextOf[p.status])}
                  onToggleAntecipado={(value)=>toggleAntecipado(p.id, value)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}