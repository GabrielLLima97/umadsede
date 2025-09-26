import { useEffect, useState } from "react";
import { api } from "../api";

export default function TV(){
  const [prontos,setProntos]=useState<any[]>([]);
  const [producao,setProducao]=useState<any[]>([]);
  const carregar = ()=> api.get("/orders/").then(r=>{
    const data = (r.data?.results || r.data || []) as any[];
    const arr = Array.isArray(data) ? data : [];
    const byCreated = (a:any,b:any)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    setProntos(arr.filter(p=>p.status==="pronto").sort(byCreated));
    setProducao(arr.filter(p=>p.status==="em produção").sort(byCreated));
  });
  useEffect(()=>{
    carregar();
    const t=setInterval(carregar, 5000);
    const host = window.location.hostname + (window.location.port === "5173" ? ":8000" : "");
    const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${wsProto}://${host}/ws/orders`);
    ws.onmessage = ()=> carregar();
    ws.onerror = ()=>{};
    return ()=>{ clearInterval(t); ws.close(); };
  },[]);
  return (
    <div className="w-full font-burger">
      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-1">
          <div className="text-4xl font-black mb-4">Em produção</div>
          <div className="flex flex-col gap-4">
            {producao.map(p=>(
              <div key={p.id} className="card flex items-center justify-between">
                <div className="font-black text-4xl">#{p.id} <span className="text-3xl">{p.cliente_nome}</span></div>
                <div className="rounded-full bg-amber-100 text-amber-800 px-4 py-2 text-lg font-extrabold">Produção</div>
              </div>
            ))}
            {producao.length===0 && <div className="card text-slate-500 text-lg">Sem pedidos em produção.</div>}
          </div>
        </div>
        <div className="col-span-3">
          <div className="text-5xl font-black mb-4">Prontos para retirada</div>
          <div className="flex flex-col gap-4">
            {prontos.map(p=>(
              <div key={p.id} className="card flex items-center justify-between">
                <div className="font-black text-6xl">#{p.id} <span className="text-5xl">{p.cliente_nome}</span></div>
                <div className="rounded-full bg-emerald-100 text-emerald-800 px-4 py-2 text-xl font-extrabold">Pronto</div>
              </div>
            ))}
            {prontos.length===0 && <div className="card text-slate-500 text-lg">Sem pedidos prontos no momento.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
