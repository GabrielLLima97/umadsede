import { useEffect, useState } from "react";
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
  const matchFiltro = (pedido: any) => {
    if (!filtroTexto.trim()) return true;
    const q = filtroTexto.trim().toLowerCase();
    const idMatch = String(pedido.id).includes(q);
    const nomeMatch = (pedido.cliente_nome || "").toLowerCase().includes(q);
    return idMatch || nomeMatch;
  };

  const fonte = dados.filter((pedido) => {
    if (!mostrarAntecipados && parseBoolean(pedido.antecipado)) return false;
    return matchFiltro(pedido);
  });

  const col = (s:string)=> fonte.filter(p=>p.status===s);
  const sortByCreated = (arr:any[]) =>
    [...arr].sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const nextOf:any = {"pago":"a preparar","a preparar":"em produção","em produção":"pronto","pronto":"finalizado","finalizado":"finalizado"};
  const prevOf:any = {"finalizado":"pronto","pronto":"em produção","em produção":"a preparar","a preparar":"pago","pago":"pago"};

  return (
    <div className="flex flex-col gap-4 w-full">
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
