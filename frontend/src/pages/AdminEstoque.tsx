import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Item = {
  id: number;
  nome: string;
  categoria?: string;
  estoque_inicial: number;
  vendidos: number;
};

export default function AdminEstoque(){
  const [items,setItems]=useState<Item[]>([]);
  const [loading,setLoading]=useState(true);
  const carregar = async ()=>{
    setLoading(true);
    try{
      const r = await api.get("/items/?all=1&limit=1000");
      const arr = (r.data?.results || r.data || []) as Item[];
      setItems(Array.isArray(arr)?arr:[]);
    } finally{ setLoading(false); }
  };
  useEffect(()=>{ carregar(); },[]);

  const groups = useMemo(()=>{
    const map: Record<string, Item[]> = {};
    items.forEach(it=>{ const c = it.categoria || "Outros"; (map[c] ||= []).push(it); });
    const desired = ["Hamburguer","Drink","Bebidas"];
    const score = (c:string)=>{ const i = desired.findIndex(x=> x.toLowerCase()===c.toLowerCase()); return i===-1?999:i; };
    const cats = Object.keys(map).sort((a,b)=> score(a)-score(b) || a.localeCompare(b));
    return { cats, map };
  },[items]);

  const ajustar = async (it: Item, delta: number)=>{
    const novo = Math.max(0, (it.estoque_inicial||0) + delta);
    await api.patch(`/items/${it.id}/`, { estoque_inicial: novo });
    await carregar();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-black">Estoque</div>
        <button className="btn btn-ghost" onClick={carregar}>Atualizar</button>
      </div>
      {loading && <div className="card">Carregando...</div>}
      {!loading && groups.cats.map(cat=> (
        <div key={cat} className="card">
          <div className="font-black mb-2">{cat}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(groups.map[cat]||[]).map(it=>{
              const disponivel = Math.max((it.estoque_inicial||0) - (it.vendidos||0), 0);
              const total = Math.max(it.estoque_inicial||0, 0);
              const pct = total>0 ? Math.round((disponivel/total)*100) : 0;
              const barColor = pct<=20 ? "bg-rose-500" : pct<=50 ? "bg-amber-500" : "bg-brand-primary";
              return (
                <div key={it.id} className="rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold mr-3 truncate" title={it.nome}>{it.nome}</div>
                    <div className="text-sm text-slate-600 whitespace-nowrap">{disponivel}/{total} un</div>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Vendidos: <b>{it.vendidos}</b></span>
                    <span>Disponível: <b>{pct}%</b></span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button className="btn" onClick={()=>ajustar(it, -1)}>-1</button>
                    <button className="btn btn-primary" onClick={()=>ajustar(it, +1)}>+1</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
