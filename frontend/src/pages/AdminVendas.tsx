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
  const [successInfo,setSuccessInfo]=useState<{ id?: number; cliente?: string; pagamento?: string; embalagem?: boolean; total?: number }>({});

  useEffect(()=>{
    api.get("/items/").then(r=>{
      const data = r.data?.results || r.data || [];
      const arr = Array.isArray(data) ? data : [];
      const cleaned = arr.filter((it:any)=> it?.ativo !== false);
      const ordered = [...cleaned].sort((a:any, b:any)=>{
        const aSoldOut = (Number(a?.estoque_disponivel ?? 0) || 0) <= 0 ? 1 : 0;
        const bSoldOut = (Number(b?.estoque_disponivel ?? 0) || 0) <= 0 ? 1 : 0;
        if(aSoldOut !== bSoldOut) return aSoldOut - bSoldOut;
        return String(a?.nome || "").localeCompare(String(b?.nome || ""));
      });
      setItems(ordered);
      const uniq = Array.from(new Set(ordered.map((it:any)=> (it.categoria || "Outros") as string)));
      const desired = ["Hamburguer","Drink","Bebidas"];
      const score = (c:string)=>{
        const i = desired.findIndex(x=> x.toLowerCase() === c.toLowerCase());
        return i===-1 ? 999 : i;
      };
      const cats = uniq.sort((a,b)=> score(a)-score(b) || a.localeCompare(b));
      setCategories(cats);
      if(!activeCat && cats.length>0) setActiveCat(cats[0]);
    });
  },[]);

  const filteredByCat = useMemo(()=>{
    const map: Record<string, any[]> = {};
    (items||[]).forEach((it:any)=>{ const c = it.categoria || "Outros"; (map[c] ||= []).push(it); });
    return map;
  },[items]);

  const handleFinalizeClick = ()=>{
    if(cart.items.length===0) return;
    if(!nome.trim()) { alert("O nome do cliente é obrigatório."); return; }
    setConfirmOpen(true);
  };

  const confirmarEnvio = async ()=>{
    if(enviando) return;
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
      setSuccessInfo({ id: p.data.id, cliente: nome||"Balcão", pagamento: metodo, embalagem: precisaNormalizada, total });
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
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn" onClick={()=>setConfirmOpen(false)}>Cancelar</button>
            <button
              type="button"
              className={`btn btn-primary ${enviando?"loading":""}`}
              onClick={confirmarEnvio}
              disabled={enviando}
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
