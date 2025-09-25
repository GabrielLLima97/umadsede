import { useEffect, useState } from "react";
import { api } from "../api";

export default function TV(){
  const [prontos,setProntos]=useState<any[]>([]);
  const [producao,setProducao]=useState<any[]>([]);
  const carregar = ()=> api.get("/orders/").then(r=>{
    const data = (r.data?.results || r.data || []) as any[];
    const arr = Array.isArray(data) ? data : [];
    setProntos(arr.filter(p=>p.status==="pronto"));
    setProducao(arr.filter(p=>p.status==="em produção"));
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
    <div className="w-full">
      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-1">
          <div className="text-3xl font-black mb-4">Em produção</div>
          <div className="flex flex-col gap-4">
            {producao.map(p=>(
              <div key={p.id} className="card flex items-center justify-between">
                <div className="font-black text-3xl">#{p.id} <span className="text-2xl">{p.cliente_nome}</span></div>
                <div className="rounded-full bg-amber-100 text-amber-800 px-4 py-2 font-extrabold">Produção</div>
              </div>
            ))}
            {producao.length===0 && <div className="card text-slate-500">Sem pedidos em produção.</div>}
          </div>
        </div>
        <div className="col-span-3">
          <div className="text-3xl font-black mb-4">Prontos para retirada</div>
          <div className="flex flex-col gap-4">
            {prontos.map(p=>(
              <div key={p.id} className="card flex items-center justify-between">
                <div className="font-black text-5xl">#{p.id} <span className="text-4xl">{p.cliente_nome}</span></div>
                <div className="rounded-full bg-emerald-100 text-emerald-800 px-4 py-2 font-extrabold">Pronto</div>
              </div>
            ))}
            {prontos.length===0 && <div className="card text-slate-500">Sem pedidos prontos no momento.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
