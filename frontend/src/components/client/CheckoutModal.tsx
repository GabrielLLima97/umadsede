import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { maskWhatsapp, brl } from "../../utils/format";
import { useToast } from "../../store/toast";
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
  const [pixQR,setPixQR]=useState<string|undefined>();
  const [pixCode,setPixCode]=useState<string|undefined>();
  const [loading,setLoading]=useState(false);
  const addOrderRef = useOrders(s=>s.addOrder);
  const pushToast = useToast(s=>s.push);
  const [verifying,setVerifying] = useState(false);
  const [copied,setCopied] = useState(false);
  const [orderInfo,setOrderInfo] = useState<{ id?: number; nome?: string; total?: number }>({});

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
      setOrderInfo({ id: p.data.id, nome, total });
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
      // Cria pagamento PIX direto e exibe QR/copia e cola
      try {
        const payer = { email: `${nome.replace(/\s+/g,'').toLowerCase()}@exemplo.com` };
        const pix = await api.post('/payments/pix', { pedido_id: p.data.id, payer });
        const t = pix.data?.point_of_interaction?.transaction_data || {};
        const base64 = t.qr_code_base64; const code = t.qr_code;
        if (base64) setPixQR(`data:image/png;base64,${base64}`);
        if (code) setPixCode(code);
      } catch (e:any) {
        console.error('Erro ao criar PIX', e?.response?.data || e);
      }
      setStep(2);
    } finally{ setLoading(false); }
  };

  const confirmPaid = async ()=>{
    if(!pedidoId) return;
    try{
      setVerifying(true);
      await api.post(`/payments/sync`, { pedido_id: pedidoId }).catch(()=>{});
      const r = await api.get(`/orders/${pedidoId}/`);
      if(r.data.status === "pago"){
        setStep(3);
        clear();
      } else {
        pushToast({ type:'info', message:'Pagamento ainda não confirmado. Tente novamente em instantes.' });
      }
    } catch(e:any){
      pushToast({ type:'error', message:'Não foi possível verificar agora.' });
    } finally{ setVerifying(false); }
  };

  // Polling seguro: apenas lê status; backend só aprova com webhook/payment approved
  useEffect(()=>{
    if(step!==2 || !pedidoId) return;
    let mounted = true; let tries = 0;
    const tick = async ()=>{
      if(!mounted) return;
      try{
        const r = await api.get(`/orders/${pedidoId}/`);
        if(r.data?.status==='pago'){
          setStep(3); clear(); return;
        }
        if(++tries < 45) setTimeout(tick, 4000); // ~3min
      } catch{}
    };
    // também verifica ao voltar o foco/visibilidade
    const onVis = ()=>{ if(document.visibilityState==='visible') confirmPaid(); };
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    setTimeout(tick, 4000);
    return ()=>{ mounted=false; window.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); };
  },[step,pedidoId,clear]);

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
                      <button type="button" className="btn btn-primary" disabled={!valid || loading} onClick={startPayment} aria-label="Continuar para pagamento">Continuar</button>
                    </div>
                  </div>
                )}
                {step===2 && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="text-sm text-slate-600">Pague via Pix dentro do site. O pedido é confirmado automaticamente quando o pagamento for aprovado.</div>
                    {pixQR && (
                      <div className="flex flex-col items-center gap-2">
                        <img src={pixQR} alt="QR Pix" className="w-56 h-56 rounded-lg border" />
                        {pixCode && (
                          <div className="w-full">
                            <div className="text-xs text-slate-600 mb-1">Copie o código Pix (copia e cola):</div>
                            <div className="flex gap-2">
                              <input className="input" value={pixCode} readOnly />
                              <button
                                type="button"
                                className={`btn ${copied? 'btn-primary' : ''}`}
                                onClick={()=>{ navigator.clipboard.writeText(pixCode!); setCopied(true); setTimeout(()=>setCopied(false), 1500); }}
                                aria-label="Copiar"
                              >
                                {copied? 'Copiado!' : 'Copiar'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!pixQR && prefId && (
                      <div className="text-sm">Carregando Pix...</div>
                    )}
                    {!pixQR && (
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" className="btn" onClick={confirmPaid} aria-label="Verificar pagamento">Verificar pagamento</button>
                        {/* Fallback desabilitado para evitar redirecionamentos indesejados */}
                      </div>
                    )}
                  </div>
                )}
                {step===3 && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="text-lg font-black">Pagamento confirmado!</div>
                    <div className="text-slate-600">Seu pedido foi recebido e está sendo preparado.</div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-brand-cream/40">
                      <div className="font-bold">Senha do pedido</div>
                      <div className="text-3xl font-black">#{orderInfo.id}</div>
                      <div className="text-sm text-slate-700 mt-2">Cliente: <span className="font-bold">{orderInfo.nome}</span></div>
                      <div className="text-sm text-slate-700">Total: <span className="font-bold">{brl.format(orderInfo.total||0)}</span></div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      {orderInfo.id && (
                        <Link to={`/status/${orderInfo.id}`} className="btn btn-primary">Ver status</Link>
                      )}
                      <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
                    </div>
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
