import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Pedido = {
  id: number;
  cliente_nome: string;
  valor_total: string | number;
  status: string;
  paid_at?: string | null;
};

export default function PaymentsAdmin(){
  const [statusFiltro,setStatusFiltro]=useState<string>("aguardando pagamento");
  const [dados,setDados]=useState<Pedido[]>([]);
  const [loading,setLoading]=useState(false);
  const [pedidoId, setPedidoId] = useState("");
  const [msg,setMsg]=useState<string>("");

  const carregar = async ()=>{
    setLoading(true);
    try{
      const r = await api.get(`/orders/?status=${encodeURIComponent(statusFiltro)}`);
      const data = r.data?.results || r.data || [];
      setDados(Array.isArray(data) ? data : []);
    } finally{ setLoading(false); }
  };

  useEffect(()=>{ carregar(); },[statusFiltro]);

  const sync = async (id:number)=>{
    setMsg("");
    try {
      await api.post(`/payments/sync`, { pedido_id: id });
      setMsg(`Pedido #${id} sincronizado.`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Erro ao sincronizar pagamento.';
      setMsg(`Falha ao sincronizar pedido #${id}: ${detail}`);
    } finally {
      await carregar();
    }
  };

  const syncAll = async ()=>{
    if(dados.length===0) return;
    setMsg("Sincronizando pagamentos visíveis...");
    let falhas = 0;
    for (const p of dados) {
      try {
        await api.post(`/payments/sync`, { pedido_id: p.id });
      } catch (err) {
        falhas += 1;
        console.warn(`Falha ao sincronizar pedido #${p.id}`, err);
      }
    }
    await carregar();
    setMsg(falhas ? `Sincronização concluída com ${falhas} falha(s).` : "Concluído.");
  };

  const abrirStatus = (id:number)=> window.open(`/status/${id}`, "_blank");

  const tentarSyncPorId = async ()=>{
    const id = parseInt(pedidoId,10);
    if(!id) return;
    await sync(id);
  };

  const total = useMemo(()=> dados.length, [dados]);
  const pagos = useMemo(()=> (Array.isArray(dados) ? dados.filter(d=>d.status==="pago").length : 0), [dados]);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-2xl font-black">Verificação de Pagamentos</div>

      <div className="card flex flex-wrap items-center gap-3">
        <div>
          <label className="text-sm font-bold mr-2">Filtrar status</label>
          <select className="input" value={statusFiltro} onChange={e=>setStatusFiltro(e.target.value)}>
            <option>aguardando pagamento</option>
            <option>a preparar</option>
            <option>em produção</option>
            <option>pronto</option>
            <option>finalizado</option>
            <option>pago</option>
          </select>
        </div>
        <button className="btn btn-ghost" onClick={carregar} disabled={loading}>Atualizar</button>
        <button className="btn btn-primary" onClick={syncAll} disabled={loading || dados.length===0}>Sincronizar todos</button>
        {msg && <span className="text-slate-600">{msg}</span>}
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="text-sm font-bold">Sincronizar por Pedido ID</label>
          <input className="input" placeholder="Ex.: 123" value={pedidoId} onChange={e=>setPedidoId(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={tentarSyncPorId}>Sincronizar</button>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="font-black">Pedidos ({total})</div>
          <div className="text-sm text-slate-600">Pagos nesta lista: {pagos}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.map(p => (
                <tr key={p.id} className="border-t border-slate-200">
                  <td className="py-2 pr-3 font-mono">#{p.id}</td>
                  <td className="py-2 pr-3">{p.cliente_nome}</td>
                  <td className="py-2 pr-3">R$ {Number(p.valor_total||0).toFixed(2).replace('.',',')}</td>
                  <td className="py-2 pr-3">{p.status}</td>
                  <td className="py-2 pr-3 flex gap-2">
                    <button className="btn btn-ghost" onClick={()=>abrirStatus(p.id)}>Abrir status</button>
                    <button className="btn btn-primary" onClick={()=>sync(p.id)}>Sincronizar</button>
                  </td>
                </tr>
              ))}
              {dados.length===0 && (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={5}>Nenhum pedido encontrado para este status.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
