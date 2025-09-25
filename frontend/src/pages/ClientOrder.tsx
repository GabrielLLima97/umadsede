import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import ClientOrderLayout from "../components/client/ClientOrderLayout";
import CategoryChips, { slugify } from "../components/client/CategoryChips";
import ProductCard from "../components/client/ProductCard";
import CartSidebar from "../components/client/CartSidebar";
import MobileBar from "../components/client/MobileBar";
import CheckoutModal from "../components/client/CheckoutModal";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { debounce } from "../utils/format";

export default function ClientOrder(){
  const [sp] = useSearchParams();
  const highlightOrderId = sp.get("pedido");
  const [activeCat,setActiveCat]=useState<string>("");
  const [search,setSearch]=useState("");
  const [dialog,setDialog]=useState(false);
  const [query,setQuery]=useState("");
  const debounced = useCallback(debounce((v:string)=> setQuery(v), 300),[]);

  // categorias
  const { data: rawCats } = useQuery({
    queryKey: ["categories"],
    queryFn: async ()=> (await api.get("/categories")).data as string[],
  });
  const categories = useMemo(()=>{
    const cats = (rawCats||[]).filter(Boolean);
    const order = ["Hamburguer","Drink","Bebidas"];
    const score = (c:string)=>{
      const i = order.findIndex(x=> x.toLowerCase() === (c||"").toLowerCase());
      return i===-1 ? 999 : i;
    };
    const sorted = cats.sort((a,b)=> score(a)-score(b) || a.localeCompare(b));
    return sorted;
  },[rawCats]);
  useEffect(()=>{
    if(!activeCat && (categories?.length||0) > 0){
      setActiveCat(categories[0]);
    }
  },[categories]);

  // itens com paginação infinita + filtros
  const {
    data: pages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status
  } = useInfiniteQuery({
    // Busca apenas por texto (categorias servem como seções e âncoras)
    queryKey: ["items", { q: query }],
    queryFn: async ({ pageParam }) => {
      const params: any = { limit: 20 };
      if(pageParam) params.offset = pageParam;
      if(query) params.q = query;
      // Não filtrar por categoria no fetch; agrupamos por categoria no cliente
      const r = await api.get("/items/", { params });
      return r.data; // DRF: {count,next,previous,results}
    },
    getNextPageParam: (lastPage) => {
      const next: string | undefined = lastPage?.next;
      if(!next) return undefined;
      const url = new URL(next, window.location.origin);
      const off = url.searchParams.get("offset");
      return off ? Number(off) : undefined;
    },
    initialPageParam: 0,
  });
  const items = (pages?.pages || []).flatMap((p:any)=> p.results || p) as any[];

  const filteredByCat = useMemo(()=>{
    const q = (query||"").toLowerCase();
    const map: Record<string, any[]> = {};
    (items||[])
      // somente itens com estoque disponível
      .filter((it:any)=> (it.estoque_disponivel ?? 1) > 0)
      .filter((it:any)=> !q || it.nome.toLowerCase().includes(q) || (it.descricao||"").toLowerCase().includes(q))
      .forEach((it:any)=>{
        const c = it.categoria || "Outros";
        (map[c] ||= []).push(it);
      });
    return map;
  },[items, query]);

  return (
    <ClientOrderLayout>
      {highlightOrderId && (
        <OrderBanner id={highlightOrderId} />
      )}
      <div className="sticky top-[96px] z-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-0 py-2 flex items-center gap-2 border-b border-slate-200">
          <div className="flex-1">
            <input aria-label="Buscar" placeholder="Buscar" className="input" onChange={(e)=>{ setSearch(e.target.value); debounced(e.target.value); }} />
          </div>
        </div>
      </div>
      <CategoryChips categories={categories} active={activeCat} onActive={setActiveCat} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        <div className="md:col-span-2 flex flex-col gap-6">
          {(categories||[]).map(cat => (
            <section key={cat} id={`cat-${slugify(cat)}`} className="scroll-mt-[120px]">
              <div className="text-lg font-black mb-2">{cat}</div>
              <div className="flex flex-col gap-3">
                {(filteredByCat[cat]||[]).map((it:any)=> (
                  <ProductCard key={it.id} item={it} />
                ))}
                {(!filteredByCat[cat] || filteredByCat[cat].length===0) && (
                  <div className="text-slate-500">Nenhum item nesta categoria.</div>
                )}
              </div>
            </section>
          ))}
          {hasNextPage && (
            <div className="flex justify-center">
              <button className="btn btn-ghost" onClick={()=>fetchNextPage()} disabled={isFetchingNextPage} aria-label="Carregar mais">{isFetchingNextPage?"Carregando...":"Carregar mais"}</button>
            </div>
          )}
        </div>
        <div className="hidden md:block">
          <CartSidebar onCheckout={()=>setDialog(true)} />
        </div>
      </div>

      <MobileBar onCheckout={()=>setDialog(true)} />
      <CheckoutModal open={dialog} onClose={()=>setDialog(false)} />
    </ClientOrderLayout>
  );
}

function OrderBanner({ id }: { id: string }){
  const [pedido,setPedido]=useState<any>();
  const addOrderRef = useOrders(s=> s.addOrder);
  useEffect(()=>{
    let mounted = true;
    api.get(`/orders/${id}/`).then(r=>{ if(mounted) { setPedido(r.data); try { addOrderRef({ id: Number(id), createdAt: r.data?.created_at || new Date().toISOString(), total: r.data?.valor_total, name: r.data?.cliente_nome }); } catch{} } }).catch(()=>{});
    return ()=>{ mounted = false };
  },[id]);
  const isPago = pedido?.status === "pago" || !!pedido?.paid_at;
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-2">
      <div className="card flex items-center justify-between">
        <div>
          <div className="font-bold">Bem-vindo de volta! Pedido #{id}</div>
          <div className="text-sm text-slate-600">{isPago?"Pagamento confirmado.":"Você pode acompanhar o status ou concluir o pagamento."}</div>
        </div>
        <div className="flex items-center gap-2">
          {!isPago && pedido?.payment_link && (
            <a className="btn btn-primary" href={pedido.payment_link} target="_blank" rel="noreferrer">Pagar</a>
          )}
          <Link className="btn btn-ghost" to={`/status/${id}`}>Ver status</Link>
        </div>
      </div>
    </div>
  );
}
import { useOrders } from "../store/orders";
