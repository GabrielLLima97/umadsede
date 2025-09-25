import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ClientOrderLayout from "../components/client/ClientOrderLayout";
import { useOrders } from "../store/orders";
import { api } from "../api";
import { brl } from "../utils/format";

export default function MyOrders(){
  const refs = useOrders(s=>s.orders);
  const [orders,setOrders]=useState<any[]>([]);
  const ids = useMemo(()=> refs.map(r=> r.id), [refs]);

  useEffect(()=>{
    const load = async ()=>{
      const out: any[] = [];
      for(const id of ids){
        try{
          const r = await api.get(`/orders/${id}/`);
          out.push(r.data);
        } catch{}
      }
      setOrders(out);
    };
    if(ids.length>0) load(); else setOrders([]);
  },[ids.join(",")]);

  if(ids.length===0) return (
    <ClientOrderLayout>
      <div className="max-w-3xl mx-auto">
        <div className="card">Você ainda não possui pedidos. <Link className="btn btn-ghost ml-2" to="/cliente">Fazer pedido</Link></div>
      </div>
    </ClientOrderLayout>
  );

  return (
    <ClientOrderLayout>
    <div className="max-w-3xl mx-auto flex flex-col gap-3">
      {orders.map(o=>{
        const isPago = o.status === "pago" || !!o.paid_at;
        return (
          <div key={o.id} className="card flex items-center justify-between">
            <div>
              <div className="font-black">Pedido #{o.id} — {o.cliente_nome}</div>
              <div className="text-slate-600 text-sm">{new Date(o.created_at || o.createdAt || Date.now()).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`rounded-full px-3 py-1 text-sm font-bold ${isPago?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{isPago?"Pago":"Aguardando"}</div>
              <Link to={`/status/${o.id}`} className="btn btn-ghost">Ver status</Link>
            </div>
          </div>
        );
      })}
    </div>
    </ClientOrderLayout>
  );
}
