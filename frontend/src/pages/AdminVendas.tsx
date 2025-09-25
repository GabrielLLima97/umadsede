import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useCart, useCartTotals } from "../store/cart";
import { brl } from "../utils/format";
import ProductCard from "../components/client/ProductCard";
import CartSidebar from "../components/client/CartSidebar";
import CategoryChips, { slugify } from "../components/client/CategoryChips";

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
  const [confirmId,setConfirmId]=useState<number|undefined>();

  useEffect(()=>{
    // usar apenas itens ativos e com estoque disponível
    api.get("/items/").then(r=>{
      const data = r.data?.results || r.data || [];
      const arr = Array.isArray(data) ? data : [];
      const filtered = arr.filter((it:any)=> (it.estoque_disponivel ?? 1) > 0);
      setItems(filtered);
      const uniq = Array.from(new Set(filtered.map((it:any)=> (it.categoria || "Outros") as string)));
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

  const finalizar = async ()=>{
    if(cart.items.length===0) return;
    if(!nome.trim()) { alert("O nome do cliente é obrigatório."); return; }
    // WhatsApp agora é opcional
    const payload = {
      cliente_nome: nome||"Balcão",
      cliente_waid: (waid||"").replace(/\D/g, ""),
      itens: cart.items.map(i=> ({ sku: i.sku, qtd: i.qtd })),
      meio_pagamento: metodo,
      observacoes: obs,
    };
    try{
      const p = await api.post("/orders/", payload);
      await api.patch(`/orders/${p.data.id}/status/`, { status: "pago" });
      cart.clear();
      setConfirmId(p.data.id);
    } catch(e:any){
      const detail = e?.response?.data?.detail || JSON.stringify(e?.response?.data || {});
      alert(`Não foi possível criar o pedido: ${detail}`);
    }
  };

  const resetar = ()=>{
    cart.clear();
    setNome("");
    setWaid("");
    setObs("");
    setMetodo("Dinheiro");
    setConfirmId(undefined);
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
                <ProductCard key={it.id} item={it} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div>
        {/* Resumo do carrinho como na página do cliente (sem sticky e sem botão) */}
        <CartSidebar onCheckout={finalizar} sticky={false} showButton={false} />
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
            <div className="flex items-center justify-between mt-2 text-lg font-black">
              <span>Total</span><span>{brl.format(total)}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={resetar}>Resetar pedido</button>
              <button className="btn btn-primary" onClick={finalizar} disabled={cart.items.length===0}>Finalizar e enviar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    {typeof confirmId!=="undefined" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={()=>setConfirmId(undefined)} />
        <div className="relative z-10 w-full max-w-md card">
          <div className="text-lg font-black">Pedido registrado!</div>
          <div className="mt-1 text-slate-700">Pedido #{confirmId} enviado à cozinha ({metodo}).</div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="btn btn-primary"
              onClick={()=>{ setConfirmId(undefined); setNome(""); setWaid(""); setObs(""); setMetodo("Dinheiro"); }}
            >
              Novo pedido
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
