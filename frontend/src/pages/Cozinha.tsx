import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { OrderCard } from "../components/Kanban";

const parseBoolean = (value: unknown) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "t", "sim", "yes"].includes(normalized);
  }
  return !!value;
};

export default function Cozinha(){
  const [dados,setDados]=useState<any[]>([]);
  const [itemsMap,setItemsMap]=useState<Record<number,{categoria?:string}>>({});
  const [now,setNow]=useState<number>(Date.now());
  const [mostrarAntecipados, setMostrarAntecipados] = useState(true);

  const carregar = async ()=>{
    const [orders, items] = await Promise.all([
      api.get("/orders/"),
      api.get("/items/?all=1"),
    ]);
    const arr = orders.data?.results || orders.data || [];
    setDados(Array.isArray(arr) ? arr : []);
    const map:Record<number,{categoria?:string}> = {};
    const itemArr = items.data?.results || items.data || [];
    (Array.isArray(itemArr)? itemArr : []).forEach((it:any)=>{ map[it.id] = {categoria: it.categoria}; });
    setItemsMap(map);
  }
  useEffect(()=>{
    carregar();
    // websocket realtime
    const host = window.location.hostname + (window.location.port === "5173" ? ":8000" : "");
    const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${wsProto}://${host}/ws/orders`);
    ws.onmessage = ()=> carregar();
    ws.onerror = ()=>{};
    const t = setInterval(()=> setNow(Date.now()), 5000);
    return ()=> { ws.close(); clearInterval(t); }
  },[]);

  const update = (id:number, status:string)=> api.patch(`/orders/${id}/status/`,{status}).then(carregar);
  const toggleAntecipado = (id:number, value:boolean) =>
    api.patch(`/orders/${id}/antecipado/`, { antecipado: value }).then(carregar);

  const [filtroTexto, setFiltroTexto] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const categoriaDoItem = (item: any) => itemsMap?.[item.item]?.categoria || item.categoria || "Outros";
  const matchFiltro = (pedido: any) => {
    if (!filtroTexto.trim()) return true;
    const q = filtroTexto.trim().toLowerCase();
    const idMatch = String(pedido.id).includes(q);
    const nomeMatch = (pedido.cliente_nome || "").toLowerCase().includes(q);
    return idMatch || nomeMatch;
  };
  const matchCategoria = (pedido: any) => {
    if (!categoriaFiltro) return true;
    return (pedido.itens || []).some((item: any) => categoriaDoItem(item) === categoriaFiltro);
  };

  const fonte = dados.filter((pedido) => {
    if (!mostrarAntecipados && parseBoolean(pedido.antecipado)) return false;
    if (!matchFiltro(pedido)) return false;
    return matchCategoria(pedido);
  });

  type StatusResumo = "a preparar" | "em produção";
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    dados.forEach((pedido: any) => {
      (pedido.itens || []).forEach((item: any) => {
        const categoria = categoriaDoItem(item);
        set.add(categoria);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dados, itemsMap]);

  useEffect(() => {
    if (categoriaFiltro && !categoriasDisponiveis.includes(categoriaFiltro)) {
      setCategoriaFiltro("");
    }
  }, [categoriaFiltro, categoriasDisponiveis]);

  const resumoItens = useMemo(() => {
    const map: Record<StatusResumo, Map<string, { nome: string; qtd: number }>> = {
      "a preparar": new Map(),
      "em produção": new Map(),
    };

    fonte.forEach((pedido: any) => {
      const statusKey = pedido.status as StatusResumo;
      if (statusKey !== "a preparar" && statusKey !== "em produção") return;
      (pedido.itens || []).forEach((item: any) => {
        const nome = item.nome || `Item ${item.item}`;
        const atual = map[statusKey].get(nome) || { nome, qtd: 0 };
        const quantidade = Number(item.qtd || 0);
        map[statusKey].set(nome, { nome, qtd: atual.qtd + (Number.isFinite(quantidade) ? quantidade : 0) });
      });
    });

    return {
      aPreparar: Array.from(map["a preparar"].values()).sort((a, b) => a.nome.localeCompare(b.nome)),
      emProducao: Array.from(map["em produção"].values()).sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  }, [fonte]);

  const totalItensAPreparar = resumoItens.aPreparar.reduce((acc, item) => acc + item.qtd, 0);
  const totalItensEmProducao = resumoItens.emProducao.reduce((acc, item) => acc + item.qtd, 0);

  const col = (s:string)=> fonte.filter(p=>p.status===s);
  const sortByCreated = (arr:any[]) =>
    [...arr].sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const nextOf:any = {"pago":"a preparar","a preparar":"em produção","em produção":"pronto","pronto":"finalizado","finalizado":"finalizado"};
  const prevOf:any = {"finalizado":"pronto","pronto":"em produção","em produção":"a preparar","a preparar":"pago","pago":"pago"};

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between text-sky-700">
            <div className="flex items-center gap-2 font-black">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M3 13h18" />
                <path d="M5 8h14l1 5-1 7H5l-1-7 1-5Z" />
                <path d="M8 4h8" />
              </svg>
              <span>A preparar</span>
            </div>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-sky-600">
              {totalItensAPreparar === 1 ? "1 item" : `${totalItensAPreparar} itens`}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-sky-700">
            {resumoItens.aPreparar.length ? (
              resumoItens.aPreparar.map((item) => (
                <li key={item.nome} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                  <span className="font-medium">{item.nome}</span>
                  <span className="font-black text-sky-800">x{item.qtd}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500">Nenhum item pendente</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between text-amber-700">
            <div className="flex items-center gap-2 font-black">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M4 7h16l-1.3 11.2a2 2 0 0 1-2 1.8H7.3a2 2 0 0 1-2-1.8L4 7Z" />
                <path d="M9 7V5a3 3 0 1 1 6 0v2" />
              </svg>
              <span>Em produção</span>
            </div>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-amber-600">
              {totalItensEmProducao === 1 ? "1 item" : `${totalItensEmProducao} itens`}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
            {resumoItens.emProducao.length ? (
              resumoItens.emProducao.map((item) => (
                <li key={item.nome} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                  <span className="font-medium">{item.nome}</span>
                  <span className="font-black text-amber-800">x{item.qtd}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500">Nenhum item pendente</li>
            )}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-2xl font-black">Cozinha</div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="m10.5 14.5-3 4.5h9l-3-4.5m-6-4a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z" />
            </svg>
            <input
              value={filtroTexto}
              onChange={(event) => setFiltroTexto(event.target.value)}
              placeholder="Buscar por código ou nome"
              className="bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 7h16" />
              <path d="M6 4v3" />
              <path d="M12 4v3" />
              <path d="M18 4v3" />
              <path d="M6 11h12l1.5 6.5a2 2 0 0 1-2 2.5H6a2 2 0 0 1-2-2.5L6 11Z" />
            </svg>
            <select
              value={categoriaFiltro}
              onChange={(event) => setCategoriaFiltro(event.target.value)}
              className="bg-transparent text-sm text-slate-600 outline-none"
            >
              <option value="">Todas as categorias</option>
              {categoriasDisponiveis.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-ghost inline-flex items-center gap-2"
            onClick={() => setMostrarAntecipados((prev) => !prev)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M5 5h14l1.4 3.5a4 4 0 0 1 .1 2.8l-1.6 4.1a4 4 0 0 1-3.7 2.6H8.8a4 4 0 0 1-3.8-2.7L3.7 11a4 4 0 0 1 .1-2.9L5 5Zm7 9v5" />
              <path d="M9 19h6" />
            </svg>
            {mostrarAntecipados ? "Ocultar antecipados" : "Mostrar antecipados"}
          </button>
          <button className="btn btn-ghost inline-flex items-center gap-2" onClick={carregar}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 4v6h6" />
              <path d="M20 20v-6h-6" />
              <path d="M5 13a7 7 0 0 0 12 3l2 2" />
              <path d="M19 11a7 7 0 0 0-12-3L5 6" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <div className="rounded-2xl border bg-sky-50 text-sky-700 border-sky-200 px-4 py-3 flex items-center justify-between mb-2">
            <div className="font-black">Pago / A preparar</div>
            <span className="px-2 py-1 rounded-full text-xs font-black bg-white/70">{String(col("pago").length + col("a preparar").length)}</span>
          </div>
          <div className="flex flex-col gap-3">
            {sortByCreated(col("pago").concat(col("a preparar"))).map(p=>(
              <OrderCard
                key={p.id}
                p={p}
                itemsMap={itemsMap}
                now={now}
                onPrev={()=>update(p.id, prevOf[p.status])}
                // Avança diretamente de "pago" ou "a preparar" para "em produção" com um clique
                onNext={()=>update(p.id, "em produção")}
                onToggleAntecipado={(value)=>toggleAntecipado(p.id, value)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="rounded-2xl border bg-amber-50 text-amber-700 border-amber-200 px-4 py-3 flex items-center justify-between mb-2">
            <div className="font-black">Em produção</div>
            <span className="px-2 py-1 rounded-full text-xs font-black bg-white/70">{String(col("em produção").length)}</span>
          </div>
          <div className="flex flex-col gap-3">
            {sortByCreated(col("em produção")).map(p=>(
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

        <div>
          <div className="rounded-2xl border bg-emerald-50 text-emerald-700 border-emerald-200 px-4 py-3 flex items-center justify-between mb-2">
            <div className="font-black">Pronto</div>
            <span className="px-2 py-1 rounded-full text-xs font-black bg-white/70">{String(col("pronto").length)}</span>
          </div>
          <div className="flex flex-col gap-3">
            {sortByCreated(col("pronto")).map(p=>(
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
    </div>
  );
}
