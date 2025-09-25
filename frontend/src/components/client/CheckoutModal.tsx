import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { maskWhatsapp, brl } from "../../utils/format";
import { useCart, useCartTotals } from "../../store/cart";
import { useOrders } from "../../store/orders";
import { api } from "../../api";

type Props = { open: boolean; onClose: ()=>void };

export default function CheckoutModal({ open, onClose }: Props){
  const items = useCart(s=>s.items);
  const clear = useCart(s=>s.clear);
  const { total } = useCartTotals();
  const [step,setStep]=useState<1|2|3>(1);
  const [nome,setNome]=useState("");
  const [waid,setWaid]=useState("");
  const [obs,setObs]=useState("");
  const [pedidoId,setPedidoId]=useState<number|undefined>();
  const [payUrl,setPayUrl]=useState<string|undefined>();
  const [prefId,setPrefId]=useState<string|undefined>();
  const [loading,setLoading]=useState(false);
  const addOrderRef = useOrders(s=>s.addOrder);

  const valid = nome.trim().length>1 && waid.replace(/\D/g, "").length>=10;

  const startPayment = async ()=>{
    if(!valid || items.length===0) return;
    setLoading(true);
    try{
      const payload = {
        cliente_nome:nome,
        cliente_waid: waid.replace(/\D/g, ""),
        itens: items.map(i=> ({ sku: i.sku, qtd: i.qtd })),
        observacoes: obs,
      };
      const p = await api.post("/orders/", payload);
      setPedidoId(p.data.id);
      // Guarda referência do pedido para o histórico local
      try{
        addOrderRef({ id: p.data.id, createdAt: new Date().toISOString(), total, name: nome });
      } catch { /* noop */ }
      // Mantemos preferência para fallback, porém usaremos Payment Brick (Pix)
      try{
        const pref = await api.post(`/payments/preference?pedido_id=${p.data.id}`, { pedido_id: p.data.id });
        setPayUrl(pref.data?.init_point);
        setPrefId(pref.data?.preference_id);
      } catch {}
      setStep(2);
    } finally{ setLoading(false); }
  };

  const confirmPaid = async ()=>{
    if(!pedidoId) return;
    await api.post(`/payments/sync`, { pedido_id: pedidoId });
    const r = await api.get(`/orders/${pedidoId}/`);
    if(r.data.status === "pago"){
      setStep(3);
      clear();
    }
  };

  // Mercado Pago Payment Brick (Pix) dentro do modal
  declare const MercadoPago: any;
  useEffect(() => {
    if (step !== 2 || !open) return;
    const pk = (import.meta as any).env?.VITE_MP_PUBLIC_KEY;
    if (!pk || typeof (window as any).MercadoPago === 'undefined') return;
    try {
      const mp = new MercadoPago(pk, { locale: 'pt-BR' });
      const bricks = mp.bricks();
      const mount = document.getElementById('mp-payment');
      if (mount) mount.innerHTML = '';
      bricks.create('payment', 'mp-payment', {
        initialization: { amount: Number(total) },
        customization: {
          paymentMethods: {
            creditCard: 'disabled',
            debitCard: 'disabled',
            ticket: 'disabled',
            bankTransfer: 'enabled', // exibe Pix no BR
          },
        },
        callbacks: {
          onReady: () => {},
          onSubmit: async ({ formData }: any) => {
            // envia para backend criar pagamento PIX, retorna paymentId para o Brick
            const payer = { email: `${nome.replace(/\s+/g,'').toLowerCase()}@exemplo.com` };
            const resp = await api.post('/payments/pix', { pedido_id: pedidoId, payer, form: formData });
            return { paymentId: resp.data?.id };
          },
          onPaymentApproved: () => { setStep(3); clear(); },
          onError: () => {},
        },
      });
    } catch {}
  }, [step, open, total, nome, pedidoId]);

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="min-h-full p-4 flex items-center justify-center">
            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-4 shadow">
                <Dialog.Title className="text-lg font-black">Finalizar pedido</Dialog.Title>
                {step===1 && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div>
                      <label className="text-sm font-bold">Nome</label>
                      <input className="input" value={nome} onChange={e=>setNome(e.target.value)} aria-label="Seu nome" />
                    </div>
                    <div>
                      <label className="text-sm font-bold">WhatsApp</label>
                      <input className="input" value={waid} onChange={e=>setWaid(maskWhatsapp(e.target.value))} placeholder="(11) 99999-9999" aria-label="Seu WhatsApp" />
                    </div>
                    <div>
                      <label className="text-sm font-bold">Observações</label>
                      <textarea className="input" rows={3} value={obs} onChange={e=>setObs(e.target.value)} aria-label="Observações do pedido" />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="font-black">Total: {brl.format(total)}</div>
                      <button className="btn btn-primary" disabled={!valid || loading} onClick={startPayment} aria-label="Continuar para pagamento">Continuar</button>
                    </div>
                  </div>
                )}
                {step===2 && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="text-sm text-slate-600">Pague via Pix dentro do site. O pedido é confirmado automaticamente quando o pagamento for aprovado.</div>
                    <div id="mp-payment" className="w-full"></div>
                    {!prefId && payUrl && (
                      <a className="btn btn-primary" href={payUrl} target="_self" rel="noreferrer" aria-label="Abrir pagamento">Abrir pagamento (fallback)</a>
                    )}
                  </div>
                )}
                {step===3 && (
                  <div className="mt-3">
                    <div className="text-lg font-black">Pagamento confirmado!</div>
                    <div className="text-slate-600">Seu pedido foi recebido e está sendo preparado.</div>
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
