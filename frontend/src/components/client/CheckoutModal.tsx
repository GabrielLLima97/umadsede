import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { maskWhatsapp, brl } from "../../utils/format";
import { useToast } from "../../store/toast";
import { useCart, useCartTotals } from "../../store/cart";
import { useOrders } from "../../store/orders";
import { api } from "../../api";

type Props = { open: boolean; onClose: () => void };
type Step = 1 | 2 | 3;

type OrderInfo = { id?: number; nome?: string; total?: number; precisa_embalagem?: boolean };

const steps: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Identificação" },
  { id: 2, label: "Pagamento" },
  { id: 3, label: "Confirmação" },
];

const parseBoolean = (value: unknown) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "t", "sim", "yes"].includes(normalized);
  }
  return !!value;
};

export default function CheckoutModal({ open, onClose }: Props) {
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const totals = useCartTotals();
  const { subtotal, taxas, total } = totals;
  const [step, setStep] = useState<Step>(1);
  const [nome, setNome] = useState("");
  const [waid, setWaid] = useState("");
  const [obs, setObs] = useState("");
  const [pedidoId, setPedidoId] = useState<number | undefined>();
  const [payUrl, setPayUrl] = useState<string | undefined>();
  const [pixQR, setPixQR] = useState<string | undefined>();
  const [pixCode, setPixCode] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const addOrderRef = useOrders((s) => s.addOrder);
  const pushToast = useToast((s) => s.push);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [orderInfo, setOrderInfo] = useState<OrderInfo>({});
  const [precisaEmbalagem, setPrecisaEmbalagem] = useState(false);
  const [touchedName, setTouchedName] = useState(false);
  const [touchedWaid, setTouchedWaid] = useState(false);

  const waidDigits = useMemo(() => waid.replace(/\D/g, ""), [waid]);
  const validName = nome.trim().length > 1;
  const validWhats = waidDigits.length >= 10;
  const valid = validName && validWhats;
  const nameError = touchedName && !validName ? "Informe seu nome completo." : "";
  const whatsError = touchedWaid && !validWhats ? "Digite um número de WhatsApp válido." : "";
  const canSubmit = valid && items.length > 0 && !loading;

  const resetState = () => {
    setStep(1);
    setNome("");
    setWaid("");
    setObs("");
    setPedidoId(undefined);
    setPayUrl(undefined);
    setPixQR(undefined);
    setPixCode(undefined);
    setLoading(false);
    setVerifying(false);
    setCopied(false);
    setOrderInfo({});
    setPrecisaEmbalagem(false);
    setTouchedName(false);
    setTouchedWaid(false);
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const handleBack = () => {
    if (step === 1) {
      onClose();
      return;
    }
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const handleCopyPix = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      pushToast({ type: "error", message: "Não foi possível copiar o código Pix." });
    }
  };

  const startPayment = async () => {
    setTouchedName(true);
    setTouchedWaid(true);
    if (!valid || items.length === 0) return;
    setLoading(true);
    try {
      const payload = {
        cliente_nome: nome,
        cliente_waid: waidDigits,
        itens: items.map((i) => ({ sku: i.sku, qtd: i.qtd })),
        observacoes: obs,
        precisa_embalagem: precisaEmbalagem,
      };
      const p = await api.post("/orders/", payload);
      setPedidoId(p.data.id);
      const precisaFromResponse = p.data?.precisa_embalagem;
      const precisaNormalizada = typeof precisaFromResponse === "undefined" ? precisaEmbalagem : parseBoolean(precisaFromResponse);
      setOrderInfo({ id: p.data.id, nome, total, precisa_embalagem: precisaNormalizada });
      try {
        addOrderRef({ id: p.data.id, createdAt: new Date().toISOString(), total, name: nome });
      } catch {
        /* noop */
      }
      try {
        const pref = await api.post(`/payments/preference?pedido_id=${p.data.id}`, { pedido_id: p.data.id });
        setPayUrl(pref.data?.init_point);
      } catch (err) {
        console.error("Erro ao criar preferência", err);
      }
      try {
        const payer = { email: `${nome.replace(/\s+/g, "").toLowerCase()}@exemplo.com` };
        const pix = await api.post("/payments/pix", { pedido_id: p.data.id, payer });
        const t = pix.data?.point_of_interaction?.transaction_data || {};
        const base64 = t.qr_code_base64;
        const code = t.qr_code;
        if (base64) setPixQR(`data:image/png;base64,${base64}`);
        if (code) setPixCode(code);
      } catch (err) {
        console.error("Erro ao criar PIX", err);
      }
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const confirmPaid = async () => {
    if (!pedidoId) return;
    try {
      setVerifying(true);
      try {
        await api.post(`/payments/sync`, { pedido_id: pedidoId });
      } catch (err) {
        console.warn('Falha ao sincronizar pagamento manualmente', err);
      }
      const r = await api.get(`/orders/${pedidoId}/`);
      if (r.data.status === "pago") {
        setStep(3);
        clear();
        setPrecisaEmbalagem(false);
        setOrderInfo((prev) => ({ ...prev, precisa_embalagem: parseBoolean(r.data?.precisa_embalagem) }));
      } else {
        pushToast({ type: "info", message: "Pagamento ainda não confirmado. Tente novamente em instantes." });
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message;
      pushToast({ type: "error", message: detail ? String(detail) : "Não foi possível verificar agora." });
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (step !== 2 || !pedidoId) return;
    let mounted = true;
    let tries = 0;
    const tick = async () => {
      if (!mounted) return;
      try {
        if (tries % 3 === 0) {
          try {
            await api.post(`/payments/sync`, { pedido_id: pedidoId });
          } catch (err) {
            console.warn('Falha ao sincronizar pagamento automaticamente', err);
          }
        }
        const r = await api.get(`/orders/${pedidoId}/`);
        if (r.data?.status === "pago") {
          setStep(3);
          clear();
          setPrecisaEmbalagem(false);
          setOrderInfo((prev) => ({ ...prev, precisa_embalagem: parseBoolean(r.data?.precisa_embalagem) }));
          return;
        }
        tries += 1;
        if (tries < 45) setTimeout(tick, 4000);
      } catch (err) {
        console.warn('Falha ao consultar status do pedido', err);
        tries += 1;
        if (tries < 45) setTimeout(tick, 6000);
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") confirmPaid();
    };
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    setTimeout(tick, 4000);
    return () => {
      mounted = false;
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [step, pedidoId, clear]);

  const summaryItems = (
    <div className="rounded-3xl bg-slate-900 text-white p-4 space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>Subtotal</span>
        <span>{brl.format(subtotal)}</span>
      </div>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>Taxas</span>
        <span>{brl.format(taxas)}</span>
      </div>
      <div className="flex items-center justify-between text-lg font-black">
        <span>Total</span>
        <span>{brl.format(total)}</span>
      </div>
      <div className="text-xs text-slate-200/80">Tempo estimado de preparo: 3-7 minutos após confirmação.</div>
    </div>
  );

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
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>
        <div className="fixed inset-0">
          <div className="flex h-full items-center justify-center p-0 md:p-6">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-6 md:scale-95"
              enterTo="opacity-100 translate-y-0 md:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 md:scale-100"
              leaveTo="opacity-0 translate-y-6 md:scale-95"
            >
              <Dialog.Panel className="relative flex h-full w-full flex-col bg-white md:h-auto md:max-w-3xl md:rounded-3xl md:shadow-xl">
                <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4 md:rounded-t-3xl">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="btn btn-ghost min-h-[40px] px-3 text-sm font-semibold"
                    aria-label="Voltar"
                  >
                    Voltar
                  </button>
                  <div className="flex flex-col items-center">
                    <Dialog.Title className="text-base font-black text-slate-900 md:text-lg">Finalizar pedido</Dialog.Title>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      {steps.map(({ id, label }) => (
                        <span key={id} className={id === step ? "font-semibold text-brand-primary" : "text-slate-400"}>
                          {id === step ? label : id}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-ghost min-h-[40px] px-3 text-sm font-semibold"
                    aria-label="Fechar"
                  >
                    Fechar
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto px-4 pb-6 md:px-6">
                  {step === 1 && (
                    <div className="space-y-4 pt-4">
                      <div className="grid gap-3">
                        <label className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-slate-700">Nome</span>
                          <input
                            className={`input ${nameError ? "input-error" : ""}`}
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            onBlur={() => setTouchedName(true)}
                            aria-label="Seu nome"
                            aria-invalid={Boolean(nameError)}
                            autoComplete="name"
                            inputMode="text"
                            placeholder="Como podemos te chamar?"
                          />
                          {nameError && <span className="text-xs font-semibold text-rose-600">{nameError}</span>}
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-slate-700">WhatsApp</span>
                          <input
                            className={`input ${whatsError ? "input-error" : ""}`}
                            value={waid}
                            onChange={(e) => setWaid(maskWhatsapp(e.target.value))}
                            onBlur={() => setTouchedWaid(true)}
                            placeholder="(11) 99999-9999"
                            aria-label="Seu WhatsApp"
                            aria-invalid={Boolean(whatsError)}
                            inputMode="tel"
                            autoComplete="tel"
                          />
                          {whatsError && <span className="text-xs font-semibold text-rose-600">{whatsError}</span>}
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-slate-700">Observações</span>
                          <textarea
                            className="input min-h-[96px]"
                            rows={3}
                            value={obs}
                            onChange={(e) => setObs(e.target.value)}
                            aria-label="Observações do pedido"
                            placeholder="Ponto do hambúrguer, retirada, alergias..."
                          />
                        </label>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-700">Embalagem para entrega?</span>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className={`btn min-h-[44px] flex-1 ${!precisaEmbalagem ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => setPrecisaEmbalagem(false)}
                            aria-pressed={!precisaEmbalagem}
                            aria-label="Sem embalagem para entrega"
                          >
                            Não preciso
                          </button>
                          <button
                            type="button"
                            className={`btn min-h-[44px] flex-1 ${precisaEmbalagem ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => setPrecisaEmbalagem(true)}
                            aria-pressed={precisaEmbalagem}
                            aria-label="Precisa de embalagem para entrega"
                          >
                            Preciso
                          </button>
                        </div>
                      </div>
                      {summaryItems}
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm text-slate-600">Revise seus dados antes de continuar.</p>
                        <button
                          type="button"
                          className="btn btn-primary min-h-[48px] md:min-w-[180px]"
                          onClick={startPayment}
                          disabled={!canSubmit}
                          aria-label="Continuar para pagamento"
                        >
                          {loading ? "Preparando..." : "Continuar"}
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4 pt-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        Use o Pix abaixo. Assim que o pagamento for confirmado, seguimos para preparar o seu pedido.
                      </div>
                      {pixQR && (
                        <div className="flex flex-col items-center gap-3">
                          <img src={pixQR} alt="QR Code Pix" className="h-56 w-56 rounded-xl border border-slate-200" />
                          {pixCode && (
                            <div className="w-full space-y-1">
                              <span className="text-xs font-semibold text-slate-600">Código Pix (copia e cola):</span>
                              <div className="flex items-center gap-2">
                                <input className="input flex-1" value={pixCode} readOnly />
                                <button
                                  type="button"
                                  className={`btn min-h-[44px] ${copied ? "btn-primary" : "btn-ghost"}`}
                                  onClick={() => handleCopyPix(pixCode)}
                                >
                                  {copied ? "Copiado" : "Copiar"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {!pixQR && (
                        <div className="text-sm text-slate-600">Carregando informações de pagamento...</div>
                      )}
                      {summaryItems}
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                        <button
                          type="button"
                          className="btn btn-ghost min-h-[44px]"
                          onClick={confirmPaid}
                          disabled={verifying}
                        >
                          {verifying ? "Verificando..." : "Verificar pagamento"}
                        </button>
                        {payUrl && (
                          <a
                            href={payUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary min-h-[44px]"
                          >
                            Abrir no app bancário
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4 pt-4">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-lg font-black text-emerald-800">Pagamento confirmado!</div>
                        <p className="mt-1 text-sm text-emerald-900">Seu pedido foi recebido e já está na fila de preparo.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-sm font-semibold text-slate-600">Senha do pedido</div>
                        <div className="text-3xl font-black text-slate-900">#{orderInfo.id}</div>
                        <div className="mt-3 space-y-1 text-sm text-slate-700">
                          <div>Cliente: <span className="font-bold">{orderInfo.nome}</span></div>
                          <div>Total: <span className="font-bold">{brl.format(orderInfo.total || 0)}</span></div>
                          {typeof orderInfo.precisa_embalagem !== "undefined" && (
                            <div>Embalagem: <span className="font-bold">{orderInfo.precisa_embalagem ? "Sim" : "Não"}</span></div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                        {orderInfo.id && (
                          <Link to={`/status/${orderInfo.id}`} className="btn btn-primary min-h-[44px]">
                            Acompanhar status
                          </Link>
                        )}
                        <button type="button" className="btn btn-ghost min-h-[44px]" onClick={onClose}>
                          Fechar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
