import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { brl } from "../utils/format";

type Pedido = {
  id:number;
  valor_total:number;
  status:string;
  created_at:string;
  cliente_nome?: string;
  cliente_waid?: string;
  observacoes?: string;
  paid_at?: string;
  itens?: { item:number; nome:string; preco:number; qtd:number }[];
  meio_pagamento?: string;
};
type Item = { id:number; nome:string; categoria?:string; vendidos:number; preco:number };

export default function AdminRelatorio(){
  const [orders,setOrders]=useState<Pedido[]>([]);
  const [items,setItems]=useState<Item[]>([]);
  const today = new Date().toISOString().slice(0,10);
  const [from,setFrom]=useState<string>(today);
  const [to,setTo]=useState<string>(today);
  const [status,setStatus]=useState<string>("");
  const [paidOnly,setPaidOnly]=useState<boolean>(false);
  const [q,setQ]=useState<string>("");
  const [origem,setOrigem]=useState<string>(""); // "cliente" | "caixa" | ""

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
    const base = orders.filter(o=>{
      const d = new Date(o.created_at);
      if(f && d < f) return false;
      if(t && d > new Date(t.getTime()+24*60*60*1000-1)) return false; // inclui o dia 'to'
      return true;
    });
    const byStatus = status ? base.filter(o=> o.status === status) : base;
    const byPaid = paidOnly ? byStatus.filter(o=> o.status==='pago' || !!o.paid_at) : byStatus;
    // filtro por origem: cliente (Mercado Pago) vs caixa (demais meios)
    const byOrigin = origem ? byPaid.filter((o:any)=> origem==='cliente' ? String(o.meio_pagamento||'').toLowerCase().includes('mercado') : !String(o.meio_pagamento||'').toLowerCase().includes('mercado')) : byPaid;
    const qq = q.trim().toLowerCase();
    const bySearch = !qq ? byOrigin : byOrigin.filter((o:any)=>{
      const hay = [o.cliente_nome, o.cliente_waid, o.observacoes, String(o.id)]
        .concat((o.itens||[]).map((i:any)=> i.nome)).join(' ').toLowerCase();
      return hay.includes(qq);
    });
    // mais antigos primeiro
    return bySearch.sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },[orders, from, to]);

  const itemsMap = useMemo(()=>{
    const m: Record<number, Item> = {};
    (items||[]).forEach(it=> { if(it && typeof it.id==='number') m[it.id]=it; });
    return m;
  },[items]);

  const resumo = useMemo(()=>{
    const totalVendas = filteredOrders.reduce((s,o)=> s + (Number(o.valor_total)||0), 0);
    const pedidosPago = filteredOrders.filter(o=> o.status === "pago" || !!o.paid_at).length;
    const porStatus: Record<string, number> = {};
    const origem: { site: number; caixa: number } = { site:0, caixa:0 };
    const meio: Record<string, number> = {};
    const porCategoria: Record<string, number> = {};
    const itensAgg: Record<string, number> = {};

    filteredOrders.forEach((o:any)=>{
      porStatus[o.status] = (porStatus[o.status]||0)+1;
      const mp = String(o.meio_pagamento||'').toLowerCase();
      if(mp.includes('mercado')) origem.site++; else origem.caixa++;
      const key = o.meio_pagamento || '—';
      meio[key] = (meio[key]||0)+1;
      (o.itens||[]).forEach((i:any)=>{
        const cat = itemsMap[i.item]?.categoria || 'Outros';
        porCategoria[cat] = (porCategoria[cat]||0) + Number(i.qtd||0);
        const nm = i.nome || `#${i.item}`;
        itensAgg[nm] = (itensAgg[nm]||0) + Number(i.qtd||0);
      });
    });

    const vendidosTotal = Object.values(porCategoria).reduce((a,b)=> a+b, 0);
    const topItens = Object.entries(itensAgg)
      .map(([nome, qtd])=> ({ id: nome, nome, vendidos: qtd as number }))
      .sort((a,b)=> (b.vendidos||0) - (a.vendidos||0))
      .slice(0,10);

    return { totalVendas, pedidosPago, porStatus, vendidosTotal, porCategoria, topItens, origem, meio };
  },[filteredOrders, itemsMap]);

  const cats = Object.keys(resumo.porCategoria||{});

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-black">Relatórios</div>
        <button className="btn bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700" onClick={carregar}>Atualizar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="card flex items-center gap-2">
          <label className="text-sm">De</label>
          <input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} />
          <label className="text-sm">Até</label>
          <input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <div className="card flex items-center gap-2">
          <label className="text-sm">Status</label>
          <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option>aguardando pagamento</option>
            <option>pago</option>
            <option>a preparar</option>
            <option>em produção</option>
            <option>pronto</option>
            <option>finalizado</option>
            <option>cancelado</option>
          </select>
          <label className="text-sm flex items-center gap-2 ml-2">
            <input type="checkbox" checked={paidOnly} onChange={e=>setPaidOnly(e.target.checked)} /> Somente pagos
          </label>
        </div>
        <div className="card flex items-center gap-2">
          <label className="text-sm">Busca</label>
          <input className="input" placeholder="Cliente, item, observação..." value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div className="card flex items-center gap-2">
          <label className="text-sm">Origem</label>
          <select className="input" value={origem} onChange={e=>setOrigem(e.target.value)}>
            <option value="">Todas</option>
            <option value="cliente">Cliente (site)</option>
            <option value="caixa">Vendas (Caixa)</option>
          </select>
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

      {/* Gráfico: origem das vendas (site vs caixa) */}
      <div className="card">
        <div className="font-black mb-2">Origem das vendas</div>
        {(()=>{
          const site = resumo.origem?.site||0; const caixa = resumo.origem?.caixa||0;
          const total = site+caixa || 1; const ps = Math.round(site/total*100); const pc = 100-ps;
          return (
            <div>
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-brand-primary" style={{ width: `${ps}%` }}></div>
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <div><span className="inline-block w-3 h-3 bg-brand-primary mr-2 rounded-sm"></span>Site: {site} ({ps}%)</div>
                <div><span className="inline-block w-3 h-3 bg-slate-400 mr-2 rounded-sm"></span>Caixa: {caixa} ({pc}%)</div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Gráfico: meios de pagamento (pizza simples) */}
      <div className="card">
        <div className="font-black mb-2">Meios de pagamento</div>
        {(()=>{
          const entries = Object.entries(resumo.meio||{});
          const total = entries.reduce((s, [_k,v])=> s + Number(v||0), 0) || 1;
          let acc = 0; const segs = entries.map(([k,v], idx)=>{
            const pct = Number(v)/total; const start = acc; acc += pct;
            const hue = (idx*67)%360; // paleta simples
            return { k, v: Number(v), start, end: acc, color: `hsl(${hue} 70% 50%)` };
          });
          const grad = segs.map(s=> `${s.color} ${Math.round(s.start*360)}deg ${Math.round(s.end*360)}deg`).join(',');
          return (
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 rounded-full" style={{ background: `conic-gradient(${grad})` }}></div>
              <div className="flex flex-col gap-1 text-sm">
                {segs.map(s=> (
                  <div key={s.k} className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }}></span>
                    <span>{s.k}</span>
                    <span className="font-bold">{Math.round((s.v/total)*100)}%</span>
                    <span className="text-slate-600">({s.v})</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
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

      {/* Relatório detalhado por pedido */}
      <div className="card overflow-x-auto">
        <div className="font-black mb-3">Relatório detalhado ({filteredOrders.length})</div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-3">Pedido</th>
              <th className="py-2 pr-3">Data</th>
              <th className="py-2 pr-3">Cliente</th>
              <th className="py-2 pr-3">WhatsApp</th>
              <th className="py-2 pr-3">Origem/Meio</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Itens</th>
              <th className="py-2 pr-3">Observações</th>
              <th className="py-2 pr-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o:any)=>{
              const isPago = o.status==='pago' || !!o.paid_at;
              const origemTxt = String(o.meio_pagamento||'').toLowerCase().includes('mercado')? 'Cliente (site)':'Vendas (Caixa)';
              const itensTxt = (o.itens||[]).map((i:any)=> `${i.qtd}× ${i.nome}`).join(', ');
              return (
                <tr key={o.id} className="border-t border-slate-200 align-top">
                  <td className="py-2 pr-3 font-bold">#{o.id}</td>
                  <td className="py-2 pr-3">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">{o.cliente_nome||'-'}</td>
                  <td className="py-2 pr-3">{o.cliente_waid||'-'}</td>
                  <td className="py-2 pr-3">{origemTxt} — {o.meio_pagamento||'-'}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-full px-2 py-1 ${isPago? 'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}`}>{o.status}</span>
                  </td>
                  <td className="py-2 pr-3">{itensTxt}</td>
                  <td className="py-2 pr-3">{o.observacoes||''}</td>
                  <td className="py-2 pr-3 font-black">{brl.format(Number(o.valor_total)||0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredOrders.length===0 && <div className="text-slate-500">Sem pedidos no filtro atual.</div>}
      </div>
    </div>
  );
}
