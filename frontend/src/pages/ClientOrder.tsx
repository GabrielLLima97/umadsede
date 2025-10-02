import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import ClientOrderLayout from "../components/client/ClientOrderLayout";
import CategoryChips, { slugify } from "../components/client/CategoryChips";
import ProductCard from "../components/client/ProductCard";
import CartSidebar from "../components/client/CartSidebar";
import CartBottomSheet from "../components/client/CartBottomSheet";
import ProductDetailSheet from "../components/client/ProductDetailSheet";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useOrders } from "../store/orders";
import { useCartTotals } from "../store/cart";
import CheckoutModal from "../components/client/CheckoutModal";
import { brl } from "../utils/format";

const DEFAULT_CATEGORY_PRIORITY: Record<string, number> = {
  hamburguer: 0,
  drink: 1,
  bebidas: 2,
};

export default function ClientOrder(){
  const [sp] = useSearchParams();
  const highlightOrderId = sp.get("pedido");
  const [activeCat,setActiveCat]=useState<string>("");
  const [dialog,setDialog]=useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const totals = useCartTotals();

  // categorias
  const { data: rawCats } = useQuery({
    queryKey: ["categories"],
    queryFn: async ()=> (await api.get("/categories")).data as string[],
  });
  const { data: categoryOrderData } = useQuery({
    queryKey: ["category-order"],
    queryFn: async ()=> (await api.get("/category-order/"))?.data,
  });
  const categories = useMemo(()=>{
    const cats = (rawCats||[]).filter(Boolean);
    const orderEntries = Array.isArray(categoryOrderData?.results)
      ? categoryOrderData.results
      : Array.isArray(categoryOrderData)
        ? categoryOrderData
        : [];
    const map: Record<string, number> = {};
    orderEntries.forEach((co: any)=>{
      if(!co) return;
      const key = String(co.nome || "").toLowerCase();
      if(key) map[key] = Number(co.ordem ?? 0);
    });
    const score = (c:string)=>{
      const key = (c || "Outros").toLowerCase();
      return map[key] ?? DEFAULT_CATEGORY_PRIORITY[key] ?? 999;
    };
    return [...cats].sort((a,b)=> score(a)-score(b) || a.localeCompare(b));
  },[rawCats, categoryOrderData]);
  useEffect(()=>{
    if(!activeCat && (categories?.length||0) > 0){
      setActiveCat(categories[0]);
    }
  },[categories, activeCat]);

  useEffect(() => {
    const handler = () => {
      setCompactView(window.scrollY > 280);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // itens com paginação infinita + filtros
  const itemsQuery = useInfiniteQuery({
    queryKey: ["items"],
    queryFn: async ({ pageParam }) => {
      const params: any = { limit: 20 };
      if(pageParam) params.offset = pageParam;
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
    retry: 2,
  });
  const {
    data: pages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    error,
    refetch,
    isLoading,
  } = itemsQuery;
  const items = (pages?.pages || []).flatMap((p:any)=> p.results || p) as any[];

  const filteredByCat = useMemo(()=>{
    const map: Record<string, any[]> = {};
    const ordered = [...(items||[])].sort((a:any, b:any)=>{
      const aSoldOut = (Number(a?.estoque_disponivel ?? 0) || 0) <= 0 ? 1 : 0;
      const bSoldOut = (Number(b?.estoque_disponivel ?? 0) || 0) <= 0 ? 1 : 0;
      if(aSoldOut !== bSoldOut) return aSoldOut - bSoldOut;
      return String(a?.nome || "").localeCompare(String(b?.nome || ""));
    });
    ordered.forEach((it:any)=>{
      const c = it.categoria || "Outros";
      (map[c] ||= []).push(it);
    });
    return map;
  },[items]);

  const handleFetchMore = useCallback(() => {
    setLoadError(false);
    fetchNextPage().catch(() => setLoadError(true));
  }, [fetchNextPage]);

  const handleRetry = useCallback(() => {
    setLoadError(false);
    refetch();
  }, [refetch]);

  const networkMessage = isError
    ? error instanceof Error
      ? error.message
      : "Tente novamente em instantes."
    : "";

  const handleOpenDetails = useCallback((item: any) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailOpen(false);
    setTimeout(() => setDetailItem(null), 200);
  }, []);

  return (
    <ClientOrderLayout>
      {highlightOrderId && (
        <OrderBanner id={highlightOrderId} />
      )}

      {isError && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="font-semibold">Não conseguimos carregar o cardápio agora.</div>
          <p className="mt-1 text-rose-700/80">{networkMessage}</p>
          <button
            type="button"
            className="btn btn-ghost mt-3"
            onClick={handleRetry}
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Link
          to="/cliente/pedidos"
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60"
        >
          <span className="flex h-4 w-4 items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M7 4h10l.8 2.4A4 4 0 0 1 22 10v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a4 4 0 0 1 4.2-3.6L7 4Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 14h6" strokeLinecap="round" />
              <circle cx="9" cy="18" r=".8" fill="currentColor" />
              <circle cx="15" cy="18" r=".8" fill="currentColor" />
            </svg>
          </span>
          Meus pedidos
        </Link>
      </div>

      <CategoryChips categories={categories} active={activeCat} onActive={setActiveCat} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        <div className="md:col-span-2 flex flex-col gap-6">
          {isLoading && (
            <div className="space-y-4">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="animate-pulse space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="h-40 rounded-2xl bg-slate-200" />
                  <div className="h-4 w-2/3 rounded-full bg-slate-200" />
                  <div className="h-4 w-1/3 rounded-full bg-slate-200" />
                  <div className="h-3 w-1/2 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          )}
          {(categories||[]).map(cat => (
            <section key={cat} id={`cat-${slugify(cat)}`} className="scroll-mt-[120px]">
              <div className="text-lg font-black mb-2">{cat}</div>
              <div className="flex flex-col gap-3">
                {(filteredByCat[cat]||[]).map((it:any)=> (
                  <ProductCard
                    key={it.id}
                    item={it}
                    compact={compactView}
                    onDetails={handleOpenDetails}
                  />
                ))}
                {(!filteredByCat[cat] || filteredByCat[cat].length===0) && (
                  <div className="text-slate-500">Nenhum item nesta categoria.</div>
                )}
              </div>
            </section>
          ))}
          {hasNextPage && (
            <div className="flex justify-center">
              <button
                className="btn btn-ghost"
                onClick={handleFetchMore}
                disabled={isFetchingNextPage}
                aria-label="Carregar mais"
              >
                {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
              </button>
            </div>
          )}
          {loadError && (
            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              Não foi possível carregar mais itens agora.
              <button type="button" className="btn btn-ghost ml-2" onClick={handleFetchMore}>Tentar novamente</button>
            </div>
          )}
        </div>
        <div className="hidden md:block">
          <CartSidebar onCheckout={()=>setDialog(true)} />
        </div>
      </div>

      <CartFloatingButton total={totals.total} onClick={() => setCartOpen(true)} />

      <CartBottomSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => setDialog(true)}
      />
      <CheckoutModal open={dialog} onClose={()=>setDialog(false)} />
      <ProductDetailSheet item={detailItem} open={detailOpen} onClose={handleCloseDetails} />
    </ClientOrderLayout>
  );
}

function CartFloatingButton({ total, onClick }: { total: number; onClick: () => void }) {
  return (
    <div className="pointer-events-none md:hidden">
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-brand-primary px-5 py-3 text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[0.99]"
        aria-label="Abrir resumo do carrinho"
      >
        <span className="flex h-5 w-5 items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M3 5h2l1 10h12l2-6H7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="19" r="1.5" />
            <circle cx="17" cy="19" r="1.5" />
          </svg>
        </span>
        <span className="text-sm font-semibold uppercase tracking-wide">Seu pedido</span>
        <span className="text-base font-black">{brl.format(total)}</span>
      </button>
    </div>
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
