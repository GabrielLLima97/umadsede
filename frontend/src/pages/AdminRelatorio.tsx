import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  antecipado?: boolean | string | number;
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
  const [antecipadoFiltro, setAntecipadoFiltro] = useState<"todos" | "apenas" | "sem">("todos");
  const [filtrosAbertos, setFiltrosAbertos] = useState<boolean>(false);

  const carregar = async ()=>{
    const [po, it] = await Promise.all([
      api.get("/orders/?limit=1000"),
      api.get("/items/?all=1&limit=1000"),
    ]);
    setOrders((po.data?.results || po.data || []) as Pedido[]);
    setItems((it.data?.results || it.data || []) as Item[]);
  };
  useEffect(()=>{ carregar(); },[]);

  const parseBoolean = (value: unknown) => {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return ["1", "true", "t", "sim", "yes"].includes(normalized);
    }
    return Boolean(value);
  };

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
    const byAntecipado = antecipadoFiltro === "todos" ? byOrigin : byOrigin.filter((pedido)=>{
      const isAntecipado = parseBoolean((pedido as Pedido).antecipado);
      if (antecipadoFiltro === "apenas") return isAntecipado;
      return !isAntecipado;
    });
    const qq = q.trim().toLowerCase();
    const bySearch = !qq ? byAntecipado : byAntecipado.filter((o:any)=>{
      const hay = [o.cliente_nome, o.cliente_waid, o.observacoes, String(o.id)]
        .concat((o.itens||[]).map((i:any)=> i.nome)).join(' ').toLowerCase();
      return hay.includes(qq);
    });
    // mais antigos primeiro
    return bySearch.sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },[orders, from, to, status, paidOnly, q, origem]);

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

  const vendasPorIntervalo = useMemo(() => {
    if (!filteredOrders.length) return [] as { timestamp: number; total: number; label: string }[];
    const bucketMs = 10 * 60 * 1000;
    const sorted = [...filteredOrders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const firstTs = Math.floor(new Date(sorted[0].created_at).getTime() / bucketMs) * bucketMs;
    const lastTs = Math.ceil(new Date(sorted[sorted.length - 1].created_at).getTime() / bucketMs) * bucketMs;
    const totals = new Map<number, number>();
    sorted.forEach((order) => {
      const bucket = Math.floor(new Date(order.created_at).getTime() / bucketMs) * bucketMs;
      const current = totals.get(bucket) || 0;
      totals.set(bucket, current + (Number(order.valor_total) || 0));
    });
    const result: { timestamp: number; total: number; label: string }[] = [];
    for (let ts = firstTs; ts <= lastTs; ts += bucketMs) {
      const labelDate = new Date(ts);
      const hours = String(labelDate.getHours()).padStart(2, "0");
      const minutes = String(labelDate.getMinutes()).padStart(2, "0");
      result.push({
        timestamp: ts,
        total: totals.get(ts) || 0,
        label: `${hours}:${minutes}`,
      });
    }
    return result;
  }, [filteredOrders]);

  const chartMax = useMemo(() => {
    const values = vendasPorIntervalo.map((d) => d.total);
    if (!values.length) return 0;
    return Math.max(...values);
  }, [vendasPorIntervalo]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-black">Relatórios</div>
        <button className="btn bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700" onClick={carregar}>Atualizar</button>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setFiltrosAbertos((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="m3 5 7 7-7 7" />
                <path d="m10 5 11 11" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-600">Filtros avançados</span>
              <span className="text-base font-black text-slate-900">Personalize o período e os dados exibidos</span>
            </div>
          </div>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500">
            {filtrosAbertos ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="m18 15-6-6-6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </span>
        </button>
        {filtrosAbertos && (
          <div className="border-t border-slate-100 px-4 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-600">Intervalo</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                    De
                    <input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                    Até
                    <input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} />
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-600">Status & Pagamento</span>
                <div className="grid grid-cols-1 gap-2">
                  <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
                    <option value="">Todos status</option>
                    <option>aguardando pagamento</option>
                    <option>pago</option>
                    <option>a preparar</option>
                    <option>em produção</option>
                    <option>pronto</option>
                    <option>finalizado</option>
                    <option>cancelado</option>
                  </select>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                    <input type="checkbox" checked={paidOnly} onChange={e=>setPaidOnly(e.target.checked)} />
                    Apenas pedidos pagos
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-600">Pesquisa</span>
                <input className="input" placeholder="Cliente, item, observação..." value={q} onChange={e=>setQ(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-600">Origem do pedido</span>
                <select className="input" value={origem} onChange={e=>setOrigem(e.target.value)}>
                  <option value="">Todas as origens</option>
                  <option value="cliente">Cliente (site)</option>
                  <option value="caixa">Vendas (caixa)</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-600">Pedidos antecipados</span>
                <select
                  className="input"
                  value={antecipadoFiltro}
                  onChange={(event)=>setAntecipadoFiltro(event.target.value as "todos" | "apenas" | "sem")}
                >
                  <option value="todos">Todos</option>
                  <option value="apenas">Somente antecipados</option>
                  <option value="sem">Sem antecipados</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          title="Vendas (R$)"
          value={brl.format(resumo.totalVendas||0)}
          variant="primary"
          icon={(<path d="M4 5h16v3l-8 4-8-4V5Zm0 14h16v-7l-8 4-8-4v7Z" />)}
        />
        <DashboardMetricCard
          title="Pedidos pagos"
          value={String(resumo.pedidosPago||0)}
          variant="emerald"
          icon={(<path d="m5 13 4 4L19 7" />)}
        />
        <DashboardMetricCard
          title="Itens vendidos"
          value={String(resumo.vendidosTotal||0)}
          variant="amber"
          icon={(<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>)}
        />
        <DashboardMetricCard
          title="Total pedidos"
          value={String(filteredOrders.length)}
          variant="slate"
          icon={(<><path d="M6 3h12l3 5-9 13-9-13 3-5Z" /><path d="M12 9v5" /><path d="M12 18h.01" /></>)}
        />
      </div>

      <div className="card shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-600">Vendas por intervalo</div>
            <div className="text-lg font-black text-slate-900">Total a cada 10 minutos</div>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
            {from && to ? `Período ${from} • ${to}` : "Período selecionado"}
          </div>
        </div>
        {vendasPorIntervalo.length ? (
          <LineChart
            data={vendasPorIntervalo}
            maxValue={chartMax}
          />
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
            Nenhuma venda encontrada para o período filtrado.
          </div>
        )}
      </div>

      {/* 4 pizzas lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {(() => {
          const mkPie = (entries: [string, number][], title: string) => {
            const total = entries.reduce((s, [,v])=> s + (v||0), 0) || 1;
            let acc = 0; const segs = entries.map(([k,v], idx)=>{
              const pct = (v||0)/total; const start = acc; acc += pct;
              const hue = (idx*67)%360;
              return { k, v, start, end: acc, color: `hsl(${hue} 70% 50%)` };
            });
            const grad = segs.map(s=> `${s.color} ${Math.round(s.start*360)}deg ${Math.round(s.end*360)}deg`).join(',');
            return (
              <div className="card">
                <div className="font-black mb-2">{title}</div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 rounded-full" style={{ background: `conic-gradient(${grad})` }}></div>
                  <div className="flex flex-col gap-1 text-sm">
                    {segs.map(s=> (
                      <div key={s.k} className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }}></span>
                        <span className="truncate max-w-[160px]" title={s.k}>{s.k}</span>
                        <span className="font-bold">{Math.round((s.v/total)*100)}%</span>
                        <span className="text-slate-600">({s.v})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          };
          const origemEntries: [string, number][] = [["Site", resumo.origem?.site||0],["Caixa", resumo.origem?.caixa||0]];
          const meioEntries = Object.entries(resumo.meio||{}).map(([k,v])=> [k, Number(v||0)]) as [string, number][];
          const statusEntries = Object.entries(resumo.porStatus||{}).map(([k,v])=> [k, Number(v||0)]) as [string, number][];
          const catEntries = Object.entries(resumo.porCategoria||{}).map(([k,v])=> [k, Number(v||0)]) as [string, number][];
          return <>
            {mkPie(origemEntries, 'Origem das vendas')}
            {mkPie(meioEntries, 'Meios de pagamento')}
            {mkPie(statusEntries, 'Pedidos por status')}
            {mkPie(catEntries, 'Vendas por categoria')}
          </>;
        })()}
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

type DashboardMetricVariant = "primary" | "emerald" | "amber" | "slate";

function DashboardMetricCard({
  title,
  value,
  variant,
  icon,
}: {
  title: string;
  value: string;
  variant: DashboardMetricVariant;
  icon: ReactNode;
}) {
  const variants: Record<DashboardMetricVariant, { iconBg: string; iconColor: string; accent: string }> = {
    primary: { iconBg: "bg-emerald-100", iconColor: "text-emerald-600", accent: "shadow-[0_12px_24px_rgba(16,185,129,0.12)]" },
    emerald: { iconBg: "bg-emerald-50", iconColor: "text-emerald-600", accent: "shadow-[0_10px_20px_rgba(16,185,129,0.08)]" },
    amber: { iconBg: "bg-amber-50", iconColor: "text-amber-600", accent: "shadow-[0_10px_20px_rgba(245,158,11,0.08)]" },
    slate: { iconBg: "bg-slate-100", iconColor: "text-slate-600", accent: "shadow-[0_10px_20px_rgba(148,163,184,0.08)]" },
  };
  const palette = variants[variant] || variants.primary;

  return (
    <div className={`card flex items-center justify-between gap-4 border border-slate-200 bg-white px-4 py-4 ${palette.accent}`}>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-slate-600">{title}</span>
        <span className="text-3xl font-black text-slate-900">{value}</span>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${palette.iconBg} ${palette.iconColor}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
          {icon}
        </svg>
      </div>
    </div>
  );
}

function LineChart({
  data,
  maxValue,
}: {
  data: { timestamp: number; total: number; label: string }[];
  maxValue: number;
}) {
  const width = 900;
  const height = 300;
  const paddingX = 60;
  const paddingTop = 24;
  const paddingBottom = 80;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;
  const baselineY = height - paddingBottom;
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const points = data.map((point, index) => {
    const x = paddingX + (data.length === 1 ? innerWidth / 2 : stepX * index);
    const ratio = maxValue > 0 ? point.total / maxValue : 0;
    const y = baselineY - ratio * innerHeight;
    return { ...point, x, y: maxValue > 0 ? y : baselineY };
  });

  const pathD = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");

  const areaD = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ") + ` L${points[points.length - 1]?.x ?? paddingX} ${baselineY} L${points[0]?.x ?? paddingX} ${baselineY} Z`;

  const gridStep = 100;
  const gridLines: { value: number; y: number }[] = [];
  if (maxValue > 0) {
    for (let value = gridStep; value < maxValue; value += gridStep) {
      const ratio = value / maxValue;
      const y = baselineY - ratio * innerHeight;
      gridLines.push({ value, y });
    }
  }

  return (
    <div className="mt-6 w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        className="h-64 w-full"
      >
        <defs>
          <linearGradient id="chart-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(16,185,129,0.35)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0.05)" />
          </linearGradient>
        </defs>
        {gridLines.map((line) => (
          <g key={line.value}>
            <line
              x1={paddingX}
              y1={line.y}
              x2={width - paddingX}
              y2={line.y}
              stroke="#e2e8f0"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={paddingX - 10}
              y={line.y + 4}
              textAnchor="end"
              fontSize={10}
              fill="#64748b"
            >
              {brl.format(line.value)}
            </text>
          </g>
        ))}
        <line x1={paddingX} y1={baselineY} x2={width - paddingX} y2={baselineY} stroke="#cbd5f5" strokeWidth={1} strokeDasharray="4 4" />
        <path d={areaD} fill="url(#chart-gradient)" opacity={0.6} />
        <path d={pathD} fill="none" stroke="#059669" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.timestamp}>
            {point.total > 0 && (
              <>
                <circle cx={point.x} cy={point.y} r={6} fill="#10b981" stroke="#ecfdf5" strokeWidth={3}>
                  <title>{`${point.label} • ${brl.format(point.total)}`}</title>
                </circle>
                <text
                  x={point.x}
                  y={point.y - 12}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="#0f172a"
                >
                  {brl.format(point.total)}
                </text>
              </>
            )}
            <text
              x={0}
              y={0}
              fontSize={11}
              fill="#64748b"
              textAnchor="middle"
              dominantBaseline="central"
              transform={`translate(${point.x}, ${baselineY + 20}) rotate(-90)`}
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
