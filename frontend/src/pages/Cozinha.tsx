import { useEffect, useState } from "react";
import { api } from "../api";
import { OrderCard } from "../components/Kanban";

export default function Cozinha(){
  const [dados,setDados]=useState<any[]>([]);
  const [itemsMap,setItemsMap]=useState<Record<number,{categoria?:string}>>({});
  const [now,setNow]=useState<number>(Date.now());

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

  const col = (s:string)=> dados.filter(p=>p.status===s);
  const sortByCreated = (arr:any[]) =>
    [...arr].sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const nextOf:any = {"pago":"a preparar","a preparar":"em produção","em produção":"pronto","pronto":"finalizado","finalizado":"finalizado"};
  const prevOf:any = {"finalizado":"pronto","pronto":"em produção","em produção":"a preparar","a preparar":"pago","pago":"pago"};

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-black">Cozinha</div>
        <button className="btn btn-ghost" onClick={carregar}>Atualizar</button>
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
              <OrderCard key={p.id} p={p} itemsMap={itemsMap} now={now} onPrev={()=>update(p.id, prevOf[p.status])} onNext={()=>update(p.id, nextOf[p.status])} />
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
              <OrderCard key={p.id} p={p} itemsMap={itemsMap} now={now} onPrev={()=>update(p.id, prevOf[p.status])} onNext={()=>update(p.id, nextOf[p.status])} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
