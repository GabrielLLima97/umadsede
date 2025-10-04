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
  const [mostrarResumoItens, setMostrarResumoItens] = useState(true);

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

  type StatusResumo = "a preparar" | "em produção";
  const itensParaProduzir = useMemo(() => {
    const map = new Map<string, { nome: string; aPreparar: number; emProducao: number }>();

    fonte.forEach((pedido: any) => {
      const status = pedido.status as StatusResumo;
      if (status !== "a preparar" && status !== "em produção") return;
      (pedido.itens || []).forEach((item: any) => {
        const nome = item.nome || `Item ${item.item}`;
        const quantidade = Number(item.qtd || 0);
        if (!Number.isFinite(quantidade)) return;
        const categoria = categoriaDoItem(item);
        if (categoriaFiltro && categoria !== categoriaFiltro) return;
        const atual = map.get(nome) || { nome, aPreparar: 0, emProducao: 0 };
        if (status === "a preparar") atual.aPreparar += quantidade;
        if (status === "em produção") atual.emProducao += quantidade;
        map.set(nome, atual);
      });
    });

    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [fonte, categoriaFiltro]);

  const totalItensAPreparar = itensParaProduzir.reduce((acc, item) => acc + item.aPreparar, 0);
  const totalItensEmProducao = itensParaProduzir.reduce((acc, item) => acc + item.emProducao, 0);
  const totalItensParaProduzir = totalItensAPreparar + totalItensEmProducao;

  const col = (s:string)=> fonte.filter(p=>p.status===s);
  const sortByCreated = (arr:any[]) =>
    [...arr].sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const nextOf:any = {"pago":"a preparar","a preparar":"em produção","em produção":"pronto","pronto":"finalizado","finalizado":"finalizado"};
  const prevOf:any = {"finalizado":"pronto","pronto":"em produção","em produção":"a preparar","a preparar":"pago","pago":"pago"};

  const formatItensLabel = (valor: number) => (valor === 1 ? "item" : "itens");
  const resumoTexto = totalItensParaProduzir
    ? `${totalItensParaProduzir} ${formatItensLabel(totalItensParaProduzir)} para produzir`
    : "Nenhum item pendente";

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-2xl font-black">Cozinha</div>
      </div>
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
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => setMostrarResumoItens((prev) => !prev)}
          className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M20 18v-5a1 1 0 0 0-.9-1l-7.1-1.4a1 1 0 0 1-.8-1V6a1 1 0 0 0-.6-.9L6 3" />
                <path d="M4 21v-9a1 1 0 0 1 .9-1l7.2-1.4a1 1 0 0 0 .8-1V6" />
              </svg>
            </div>
            <div>
              <div className="text-base font-black text-slate-700">Itens a produzir</div>
              <div className="text-xs font-medium text-slate-500">{resumoTexto}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            {totalItensAPreparar > 0 && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">
                A preparar x{totalItensAPreparar}
              </span>
            )}
            {totalItensEmProducao > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                Em produção x{totalItensEmProducao}
              </span>
            )}
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
          </div>
        </button>
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
                    <span className="rounded-full bg-white px-2 py-0.5 text-slate-600">
                      Total x{item.aPreparar + item.emProducao}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 text-sm text-slate-500">Nenhum item pendente para produzir.</div>
          )
        )}
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
