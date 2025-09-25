import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { brl } from "../utils/format";

type Pedido = { id:number; valor_total:number; status:string; created_at:string };
type Item = { id:number; nome:string; categoria?:string; vendidos:number; preco:number };

export default function AdminRelatorio(){
  const [orders,setOrders]=useState<Pedido[]>([]);
  const [items,setItems]=useState<Item[]>([]);
  const today = new Date().toISOString().slice(0,10);
  const [from,setFrom]=useState<string>(today);
  const [to,setTo]=useState<string>(today);

  const carregar = async ()=>{
    const [po, it] = await Promise.all([
      api.get("/orders/?limit=1000"),
      api.get("/items/?all=1&limit=1000"),
    ]);
    setOrders((po.data?.results || po.data || []) as Pedido[]);
    setItems((it.data?.results || it.data || []) as Item[]);
  };
  useEffect(()=>{ carregar(); },[]);

  const filteredOrders = useMemo(()=>{
    const f = from ? new Date(from) : undefined;
    const t = to ? new Date(to) : undefined;
    return orders.filter(o=>{
      const d = new Date(o.created_at);
      if(f && d < f) return false;
      if(t && d > new Date(t.getTime()+24*60*60*1000-1)) return false; // inclui o dia 'to'
      return true;
    });
  },[orders, from, to]);

  const resumo = useMemo(()=>{
    const totalVendas = filteredOrders.reduce((s,o)=> s + (Number(o.valor_total)||0), 0);
    const pedidosPago = filteredOrders.filter(o=> o.status === "pago" || !!(o as any).paid_at).length;
    const porStatus: Record<string, number> = {};
    filteredOrders.forEach(o=>{ porStatus[o.status] = (porStatus[o.status]||0)+1; });
    const vendidosTotal = items.reduce((s,it)=> s + (it.vendidos||0), 0);
    const porCategoria: Record<string, number> = {};
    items.forEach(it=>{ const c = it.categoria || "Outros"; porCategoria[c]=(porCategoria[c]||0)+it.vendidos; });
    const topItens = [...items].sort((a,b)=> (b.vendidos||0) - (a.vendidos||0)).slice(0,10);
    return { totalVendas, pedidosPago, porStatus, vendidosTotal, porCategoria, topItens };
  },[filteredOrders, items]);

  const cats = Object.keys(resumo.porCategoria||{});

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-black">Relatórios</div>
        <button className="btn btn-ghost" onClick={carregar}>Atualizar</button>
      </div>
      <div className="flex items-center gap-2">
        <div className="card flex items-center gap-2">
          <label className="text-sm">De</label>
          <input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} />
          <label className="text-sm">Até</label>
          <input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card bg-brand-cream">
          <div className="text-sm text-slate-600">Vendas (R$)</div>
          <div className="text-3xl font-black">{brl.format(resumo.totalVendas||0)}</div>
        </div>
        <div className="card bg-brand-cream">
          <div className="text-sm text-slate-600">Pedidos pagos</div>
          <div className="text-3xl font-black">{resumo.pedidosPago||0}</div>
        </div>
        <div className="card bg-brand-cream">
          <div className="text-sm text-slate-600">Itens vendidos</div>
          <div className="text-3xl font-black">{resumo.vendidosTotal||0}</div>
        </div>
        <div className="card bg-brand-cream">
          <div className="text-sm text-slate-600">Total pedidos</div>
          <div className="text-3xl font-black">{filteredOrders.length}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card">
          <div className="font-black mb-3">Pedidos por status</div>
          <div className="flex flex-col gap-2">
            {Object.entries(resumo.porStatus||{}).map(([k,v])=>{
              const total = orders.length || 1;
              const pct = Math.round((Number(v)/total)*100);
              const color = k === 'pago' ? 'bg-emerald-500' : k === 'pronto' ? 'bg-brand-primary' : 'bg-amber-500';
              return (
                <div key={k} className="flex items-center gap-3">
                  <div className="w-24 text-sm capitalize">{k}</div>
                  <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="w-12 text-right text-sm font-bold">{v}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="font-black mb-3">Vendas por categoria (qtd)</div>
          <div className="flex flex-col gap-2">
            {cats.map(c=>{
              const total = (resumo.vendidosTotal||1);
              const val = resumo.porCategoria[c]||0;
              const pct = Math.round((val/total)*100);
              return (
                <div key={c} className="flex items-center gap-3">
                  <div className="w-24 text-sm">{c}</div>
                  <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-primary" style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="w-12 text-right text-sm font-bold">{val}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="font-black mb-2">Top itens vendidos</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {resumo.topItens?.map(it=>{
            const max = Math.max(...resumo.topItens.map(t=> t.vendidos||0), 1);
            const pct = Math.round(((it.vendidos||0)/max)*100);
            return (
              <div key={it.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold mr-3 truncate" title={it.nome}>{it.nome}</div>
                  <div className="text-sm">{it.vendidos} un.</div>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-primary" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
