import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, Transition } from "@headlessui/react";
import ClientOrderLayout from "../components/client/ClientOrderLayout";
import { useOrders } from "../store/orders";
import { api } from "../api";
import { brl } from "../utils/format";
import { useToast } from "../store/toast";
import { useClientPresence } from "../hooks/useClientPresence";

type PixData = {
  ticketUrl?: string;
  qrBase64?: string;
  qrCode?: string;
  expiresAt?: string;
  amount?: number;
};

type PixModalState = {
  open: boolean;
  loading: boolean;
  order?: any;
  data?: PixData | null;
  error?: string | null;
};

export default function MyOrders(){
  useClientPresence(true);

  const refs = useOrders(s=>s.orders);
  const [orders,setOrders]=useState<any[]>([]);
  const [loading,setLoading] = useState(false);
  const ids = useMemo(()=> refs.map(r=> r.id), [refs]);
  const pushToast = useToast(s=>s.push);
  const [syncingId, setSyncingId] = useState<number|null>(null);
  const [pixModal, setPixModal] = useState<PixModalState>({ open: false, loading: false, data: null, error: null });

  const refreshOrders = useCallback(async () => {
    if (ids.length === 0) {
      setOrders([]);
      return;
    }
    setLoading(true);
    try {
      const out: any[] = [];
      for(const id of ids){
        try{
          const r = await api.get(`/orders/${id}/`);
          out.push(r.data);
        } catch (err) {
          console.warn("Falha ao carregar pedido", id, err);
        }
      }
      setOrders(out);
    } finally {
      setLoading(false);
    }
  },[ids]);

  useEffect(()=>{
    refreshOrders();
  },[refreshOrders]);

  const handleSync = async (id: number) => {
    setSyncingId(id);
    try {
      await api.post(`/payments/sync`, { pedido_id: id });
      pushToast({ type: "success", message: `Pedido #${id} sincronizado.` });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Não foi possível sincronizar o pagamento.";
      pushToast({ type: "error", message: String(detail) });
    } finally {
      setSyncingId(null);
      refreshOrders();
    }
  };

  const openPixModal = async (order: any) => {
    setPixModal({ open: true, loading: true, order, data: null, error: null });
    try {
      const resp = await api.post("/payments/pix", { pedido_id: order.id });
      const tx = resp.data?.point_of_interaction?.transaction_data || {};
      const data: PixData = {
        ticketUrl: tx.ticket_url || resp.data?.init_point || order.payment_link,
        qrBase64: tx.qr_code_base64,
        qrCode: tx.qr_code,
        expiresAt: tx.expires_at || resp.data?.date_of_expiration,
        amount: order.valor_total,
      };
      setPixModal({ open: true, loading: false, order, data, error: null });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Não foi possível carregar os dados do Pix.";
      setPixModal({ open: true, loading: false, order, data: null, error: String(detail) });
    }
  };

  const closePixModal = () => setPixModal({ open: false, loading: false, data: null, error: null });

  const copyPix = (code: string) => {
    try {
      navigator.clipboard.writeText(code);
      pushToast({ type: "success", message: "Código Pix copiado." });
    } catch {
      pushToast({ type: "error", message: "Não foi possível copiar agora." });
    }
  };

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
        {loading && <div className="card">Carregando pedidos...</div>}
        {orders.map(o=>{
          const isPago = o.status === "pago" || !!o.paid_at;
          const aguardando = !isPago;
          return (
            <div key={o.id} className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-black">Pedido #{o.id} — {o.cliente_nome}</div>
                <div className="text-slate-600 text-sm">{new Date(o.created_at || o.createdAt || Date.now()).toLocaleString()}</div>
                <div className="text-slate-600 text-sm">Total: {brl.format(Number(o.valor_total || 0))}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`rounded-full px-3 py-1 text-sm font-bold ${isPago?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{isPago?"Pago":"Aguardando"}</div>
                {aguardando && (
                  <>
                    <button type="button" className="btn btn-primary min-h-[40px]" onClick={()=>openPixModal(o)}>
                      Ver PIX
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost min-h-[40px]"
                      onClick={()=>handleSync(o.id)}
                      disabled={syncingId === o.id}
                    >
                      {syncingId === o.id ? "Sincronizando..." : "Forçar sincronização"}
                    </button>
                  </>
                )}
                <Link to={`/status/${o.id}`} className="btn btn-ghost min-h-[40px]">Ver status</Link>
              </div>
            </div>
          );
        })}
      </div>
      <PixPaymentModal
        open={pixModal.open}
        loading={pixModal.loading}
        data={pixModal.data}
        order={pixModal.order}
        error={pixModal.error}
        onClose={closePixModal}
        onCopy={copyPix}
        onSync={handleSync}
        syncingId={syncingId}
      />
    </ClientOrderLayout>
  );
}

type PixModalProps = {
  open: boolean;
  loading: boolean;
  data?: PixData | null;
  order?: any;
  error?: string | null;
  onClose: () => void;
  onCopy: (code: string) => void;
  onSync: (orderId: number) => void;
  syncingId: number | null;
};

function PixPaymentModal({ open, loading, data, order, error, onClose, onCopy, onSync, syncingId }: PixModalProps) {
  const code = data?.qrCode || "";
  const ticketUrl = data?.ticketUrl;
  const expires = data?.expiresAt ? new Date(data.expiresAt).toLocaleString() : null;
  const amount = data?.amount ?? order?.valor_total;
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center md:items-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4 md:scale-95"
              enterTo="opacity-100 translate-y-0 md:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 md:scale-100"
              leaveTo="opacity-0 translate-y-4 md:scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Dialog.Title className="text-lg font-black text-slate-900">Pagamento do pedido #{order?.id}</Dialog.Title>
                    {amount != null && (
                      <p className="text-sm text-slate-600">Total: {brl.format(Number(amount || 0))}</p>
                    )}
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={onClose}>
                    Fechar
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  {loading && <p className="text-sm text-slate-600">Gerando informações do Pix...</p>}
                  {!loading && error && (
                    <p className="text-sm font-semibold text-rose-600">{error}</p>
                  )}
                  {!loading && !error && data && (
                    <>
                      {data.qrBase64 && (
                        <div className="flex justify-center">
                          <img src={`data:image/png;base64,${data.qrBase64}`} alt="QR Code Pix" className="h-56 w-56 rounded-xl border border-slate-200" />
                        </div>
                      )}
                      {code && (
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-slate-600">Pix copia e cola:</span>
                          <div className="flex items-center gap-2">
                            <input className="input flex-1" value={code} readOnly />
                            <button type="button" className="btn" onClick={() => onCopy(code)}>
                              Copiar
                            </button>
                          </div>
                        </div>
                      )}
                      {ticketUrl && (
                        <a
                          href={ticketUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary w-full"
                        >
                          Abrir no app bancário
                        </a>
                      )}
                      {expires && (
                        <p className="text-xs text-slate-500">Válido até: {expires}</p>
                      )}
                    </>
                  )}
                </div>
                {!loading && order && (
                  <div className="mt-4 flex items-center justify-end">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onSync(order.id)}
                      disabled={syncingId === order.id}
                    >
                      {syncingId === order.id ? "Sincronizando..." : "Forçar sincronização"}
                    </button>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
