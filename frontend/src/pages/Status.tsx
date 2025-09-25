import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

// Jornada simplificada para o cliente
const STEPS = [
  { label: "Pagamento", keys: ["aguardando pagamento", "pago"] },
  { label: "Em preparo", keys: ["a preparar", "em produção"] },
  { label: "Pronto", keys: ["pronto"] },
  { label: "Finalizado", keys: ["finalizado"] },
];

export default function Status(){
  const { id } = useParams();
  const [pedido,setPedido]=useState<any>(null);
  const [loading,setLoading]=useState(true);

  const carregar = async ()=>{
    if(!id) return;
    setLoading(true);
    try{
      const r = await api.get(`/orders/${id}/`);
      setPedido(r.data);
    } finally{ setLoading(false); }
  };

  useEffect(()=>{ carregar(); const t = setInterval(carregar, 4000); return ()=>clearInterval(t); },[id]);

  if(loading && !pedido) return <div className="card">Carregando...</div>;
  if(!pedido) return <div className="card">Pedido não encontrado. <Link to="/cliente/pedidos" className="btn btn-ghost ml-2">Voltar</Link></div>;

  const isPago = pedido.status === "pago" || !!pedido.paid_at;
  const steps = STEPS;
  const currentIndex = (()=>{
    const idx = steps.findIndex(s => (s.keys||[]).includes(pedido.status));
    if (idx >= 0) return idx;
    return isPago ? 1 : 0;
  })();
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-xl font-black">Status do Pedido #{pedido.id}</div>
          <div className="text-slate-600">{pedido.cliente_nome}</div>
        </div>
        <div className={`rounded-full px-4 py-2 font-black ${isPago?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>
          {isPago?"Pago":"Aguardando pagamento"}
        </div>
      </div>
      <div className="flex justify-end">
        <Link className="btn btn-primary" to="/cliente/pedidos">Voltar aos meus pedidos</Link>
      </div>
      {!isPago && pedido.payment_link && (
        <div className="card">
          <div className="mb-2 font-bold">Finalize seu pagamento</div>
          <a href={pedido.payment_link} className="btn btn-primary" target="_blank">Ir para o Mercado Pago</a>
          <button className="btn btn-ghost ml-2" onClick={async ()=>{ await api.post(`/payments/sync`, { pedido_id: id }); await carregar(); }}>Forçar sincronização</button>
        </div>
      )}
      {/* Etapas do pedido - visual vertical (mobile-first) */}
      <div className="card">
        <div className="font-black mb-3 text-center">Status do pedido</div>
        <div className="flex flex-col gap-3">
          {steps.map((s, i)=>{
            const done = i <= currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div key={s.label} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border shrink-0 ${done?"bg-brand-primary text-white border-brand-primary": "bg-white text-slate-700 border-slate-300"}`}>{i+1}</div>
                <div className={`text-base font-bold ${isCurrent?"text-brand-primary":"text-slate-700"}`}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="font-black mb-2">Itens</div>
        <ul className="list-disc pl-5">
          {pedido.itens?.map((i:any)=> (
            <li key={i.item}>{i.qtd} × {i.nome}</li>
          ))}
        </ul>
      </div>
      <div className="text-sm text-slate-600">
        Esta página atualiza automaticamente a cada alguns segundos.
      </div>
    </div>
  );
}
