import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useCart, useCartTotals } from "../store/cart";
import { brl } from "../utils/format";
import ProductCard from "../components/client/ProductCard";
import CartSidebar from "../components/client/CartSidebar";
import CategoryChips, { slugify } from "../components/client/CategoryChips";

const parseBoolean = (value: unknown) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1","true","t","sim","yes"].includes(normalized);
  }
  return !!value;
};

const DEFAULT_CATEGORY_PRIORITY: Record<string, number> = {
  hamburguer: 0,
  drink: 1,
  bebidas: 2,
};

const parseCurrencyInput = (value: string): number => {
  if (!value) return 0;
  const normalized = value.replace(/[^0-9,\.]/g, "").replace(/,(?=\d{3}(?:\D|$))/g, "");
  const withDot = normalized.replace(",", ".");
  const num = Number(withDot);
  return Number.isFinite(num) ? num : 0;
};

export default function AdminVendas(){
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCat,setActiveCat]=useState<string>("");
  const [nome,setNome]=useState("");
  const [waid,setWaid]=useState("");
  const [metodo,setMetodo]=useState("Dinheiro");
  const [obs,setObs]=useState("");
  const cart = useCart();
  const { total } = useCartTotals();
  const [precisaEmbalagem,setPrecisaEmbalagem]=useState(false);
  const [confirmOpen,setConfirmOpen]=useState(false);
  const [enviando,setEnviando]=useState(false);
  const [valorRecebido, setValorRecebido] = useState<string>("");
  const [successInfo,setSuccessInfo]=useState<{
    id?: number;
    cliente?: string;
    pagamento?: string;
    embalagem?: boolean;
    total?: number;
    recebido?: number;
    troco?: number;
  }>({});

  useEffect(()=>{
    const load = async ()=>{
      const [itemsRes, orderRes] = await Promise.all([
        api.get("/items/"),
        api.get("/category-order/"),
      ]);
      const data = itemsRes.data?.results || itemsRes.data || [];
      const arr = Array.isArray(data) ? data : [];
      const cleaned = arr.filter((it:any)=> it?.ativo !== false);
      const orderedItems = [...cleaned].sort((a:any, b:any)=>{
        const aSoldOut = (Number(a?.estoque_disponivel ?? 0) || 0) <= 0 ? 1 : 0;
        const bSoldOut = (Number(b?.estoque_disponivel ?? 0) || 0) <= 0 ? 1 : 0;
        if(aSoldOut !== bSoldOut) return aSoldOut - bSoldOut;
        return String(a?.nome || "").localeCompare(String(b?.nome || ""));
      });
      setItems(orderedItems);

      const ordersData = orderRes.data?.results || orderRes.data || [];
      const map: Record<string, number> = {};
      (Array.isArray(ordersData) ? ordersData : []).forEach((co: any)=>{
        if(!co) return;
        const key = String(co.nome || "").toLowerCase();
        if(key) map[key] = Number(co.ordem ?? 0);
      });
      const uniq = Array.from(new Set(orderedItems.map((it:any)=> (it.categoria || "Outros") as string)));
      const score = (c:string)=>{
        const key = (c || "Outros").toLowerCase();
        return map[key] ?? DEFAULT_CATEGORY_PRIORITY[key] ?? 999;
      };
      const cats = uniq.sort((a,b)=> score(a)-score(b) || a.localeCompare(b));
      setCategories(cats);
      if(cats.length>0) setActiveCat(prev => prev || cats[0]);
    };
    load();
  },[]);

  const filteredByCat = useMemo(()=>{
    const map: Record<string, any[]> = {};
    (items||[]).forEach((it:any)=>{ const c = it.categoria || "Outros"; (map[c] ||= []).push(it); });
    return map;
  },[items]);

  const handleFinalizeClick = ()=>{
    if(cart.items.length===0) return;
    if(!nome.trim()) { alert("O nome do cliente é obrigatório."); return; }
    if (metodo === "Dinheiro" && !valorRecebido) {
      setValorRecebido(total > 0 ? total.toFixed(2) : "");
    }
    setConfirmOpen(true);
  };

  const confirmarEnvio = async ()=>{
    if(enviando) return;
    const recebidoValor = metodo === "Dinheiro" ? parseCurrencyInput(valorRecebido || "0") : total;
    const troco = metodo === "Dinheiro" ? Math.max(recebidoValor - total, 0) : 0;
    const payload = {
      cliente_nome: nome||"Balcão",
      cliente_waid: (waid||"").replace(/\D/g, ""),
      itens: cart.items.map(i=> ({ sku: i.sku, qtd: i.qtd })),
      meio_pagamento: metodo,
      observacoes: obs,
      precisa_embalagem: precisaEmbalagem,
    };
    try{
      setEnviando(true);
      const p = await api.post("/orders/", payload);
      await api.patch(`/orders/${p.data.id}/status/`, { status: "pago" });
      cart.clear();
      const precisaFromResponse = p.data?.precisa_embalagem;
      const precisaNormalizada = typeof precisaFromResponse === "undefined" ? precisaEmbalagem : parseBoolean(precisaFromResponse);
      setSuccessInfo({
        id: p.data.id,
        cliente: nome||"Balcão",
        pagamento: metodo,
        embalagem: precisaNormalizada,
        total,
        recebido: recebidoValor,
        troco,
      });
      setConfirmOpen(false);
      setPrecisaEmbalagem(false);
    } catch(e:any){
      const detail = e?.response?.data?.detail || JSON.stringify(e?.response?.data || {});
      alert(`Não foi possível criar o pedido: ${detail}`);
    } finally {
      setEnviando(false);
    }
  };

  const resetar = ()=>{
    cart.clear();
    setNome("");
    setWaid("");
    setObs("");
    setMetodo("Dinheiro");
    setPrecisaEmbalagem(false);
    setSuccessInfo({});
    setConfirmOpen(false);
    setEnviando(false);
    setValorRecebido("");
  };

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 flex flex-col gap-3">
        <div className="text-2xl font-black">Vendas no Caixa</div>
        <CategoryChips categories={categories} active={activeCat} onActive={setActiveCat} />
        {(categories||[]).map(cat=> (
          <section key={cat} id={`cat-${slugify(cat)}`} className="scroll-mt-[120px]">
            <div className="text-lg font-black mb-2">{cat}</div>
            <div className="flex flex-col gap-3">
              {(filteredByCat[cat]||[]).map((it:any)=> (
                <ProductCard key={it.id} item={it} showExactStock />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div>
        <CartSidebar onCheckout={handleFinalizeClick} sticky={false} showButton={false} />
        <div className="card mt-4">
          <div className="font-black mb-2">Resumo</div>
          <div className="text-sm text-slate-600 mb-2">Selecione abaixo o método de pagamento recebido no caixa.</div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold">Cliente</label>
            <input className="input" placeholder="Nome" value={nome} onChange={e=>setNome(e.target.value)} />
            <input className="input" placeholder="WhatsApp" value={waid} onChange={e=>setWaid(e.target.value)} />
            <label className="text-sm font-bold">Método</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                "Dinheiro",
                "Cartão de Crédito",
                "Cartão de Débito",
                "Pix",
              ].map(m => (
                <button key={m} type="button" onClick={()=>setMetodo(m)} className={`btn ${metodo===m?"btn-primary":"btn-ghost"}`}>{m}</button>
              ))}
            </div>
            <label className="text-sm font-bold">Observações</label>
            <textarea className="input" rows={3} placeholder="Observações (opcional)" value={obs} onChange={e=>setObs(e.target.value)} />
            <label className="text-sm font-bold">Embalagem para entrega?</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn ${!precisaEmbalagem?"btn-primary":"btn-ghost"}`}
                onClick={()=>setPrecisaEmbalagem(false)}
                aria-pressed={!precisaEmbalagem}
              >
                Não
              </button>
              <button
                type="button"
                className={`btn ${precisaEmbalagem?"btn-primary":"btn-ghost"}`}
                onClick={()=>setPrecisaEmbalagem(true)}
                aria-pressed={precisaEmbalagem}
              >
                Sim
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-lg font-black">
              <span>Total</span><span>{brl.format(total)}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={resetar}>Resetar pedido</button>
              <button className="btn btn-primary" onClick={handleFinalizeClick} disabled={cart.items.length===0}>Finalizar e enviar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    {confirmOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={()=>setConfirmOpen(false)} />
        <div className="relative z-10 w-full max-w-md card">
          <div className="text-lg font-black">Confirmar envio?</div>
          <div className="text-slate-600 text-sm">Revise os dados abaixo antes de enviar o pedido para a cozinha.</div>
          <div className="mt-4 flex flex-col gap-2 text-sm text-slate-700">
            <div><span className="font-bold">Cliente:</span> {nome || "Balcão"}</div>
            <div><span className="font-bold">Pagamento:</span> {metodo}</div>
            <div><span className="font-bold">Embalagem:</span> {precisaEmbalagem ? "Sim" : "Não"}</div>
            <div><span className="font-bold">Total:</span> {brl.format(total)}</div>
            {metodo === "Dinheiro" && (
              <div className="mt-2 space-y-2">
                <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                  Valor recebido (R$)
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                  />
                </label>
                <div className="text-xs text-slate-500">
                  Troco: <span className="font-bold text-emerald-700">{brl.format(Math.max(parseCurrencyInput(valorRecebido || "0") - total, 0))}</span>
                </div>
                {parseCurrencyInput(valorRecebido || "0") < total && (
                  <div className="text-xs font-semibold text-rose-600">O valor recebido está abaixo do total.</div>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn" onClick={()=>setConfirmOpen(false)}>Cancelar</button>
            <button
              type="button"
              className={`btn btn-primary ${enviando?"loading":""}`}
              onClick={confirmarEnvio}
              disabled={
                enviando || (metodo === "Dinheiro" && parseCurrencyInput(valorRecebido || "0") < total)
              }
            >
              Confirmar e enviar
            </button>
          </div>
        </div>
      </div>
    )}
    {successInfo.id && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 w-full max-w-md card items-center text-center">
          <div className="text-lg font-black">Pedido registrado!</div>
          <div className="mt-1 text-slate-700">Pedido #{successInfo.id} enviado à cozinha.</div>
          <div className="mt-4 text-xs font-bold uppercase text-slate-500 tracking-wide">Código do pedido</div>
          <div className="text-5xl font-black text-slate-900 mt-2">#{successInfo.id}</div>
          <div className="mt-3 text-sm text-slate-700">Cliente: <span className="font-bold">{successInfo.cliente}</span></div>
         <div className="text-sm text-slate-700">Pagamento: <span className="font-bold">{successInfo.pagamento}</span></div>
         <div className="text-sm text-slate-700">Total: <span className="font-bold">{brl.format(successInfo.total || 0)}</span></div>
          {successInfo.pagamento === "Dinheiro" && (
            <div className="text-sm text-slate-700">
              Troco: <span className="font-bold">{brl.format(successInfo.troco || 0)}</span>
            </div>
          )}
          <div className="text-sm text-slate-700">Embalagem: <span className="font-bold">{successInfo.embalagem ? "Sim" : "Não"}</span></div>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn btn-primary" onClick={resetar}>Novo pedido</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
  useEffect(() => {
    if (metodo !== "Dinheiro") {
      setValorRecebido("");
    }
  }, [metodo]);
