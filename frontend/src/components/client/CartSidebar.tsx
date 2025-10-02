import { useCartTotals } from "../../store/cart";
import { useCart } from "../../store/cart";
import { brl } from "../../utils/format";

type Props = { onCheckout: ()=>void; sticky?: boolean; showButton?: boolean };

export default function CartSidebar({ onCheckout, sticky=true, showButton=true }: Props){
  const items = useCart(s=>s.items);
  const { subtotal, taxas, total } = useCartTotals();
  // Edição no carrinho desabilitada conforme solicitado

  return (
    <div className={sticky ? "sticky top-20" : ""}>
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-black">Seu Pedido</div>
          {items.length > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {items.length} item{items.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {items.length === 0 ? (
          <div className="text-slate-500">Seu carrinho está vazio.</div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800" title={it.nome}>{it.nome}</div>
                    {it.nota && <div className="text-xs text-slate-500 truncate" title={it.nota}>{it.nota}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-500">x{it.qtd}</span>
                    <span className="w-20 text-right text-sm font-semibold text-slate-700">{brl.format(it.preco * it.qtd)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-3xl bg-slate-900 p-4 text-white">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Subtotal</span>
                <span>{brl.format(subtotal)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm font-semibold">
                <span>Taxas</span>
                <span>{brl.format(taxas)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-lg font-black">
                <span>Total</span>
                <span>{brl.format(total)}</span>
              </div>
              <div className="mt-2 text-xs text-slate-200/80">Tempo estimado de preparo: 3-7 minutos após pagamento.</div>
            </div>
            {showButton && (
              <button
                className="btn btn-primary min-h-[48px]"
                onClick={onCheckout}
                aria-label="Ir para pagamento"
              >
                Ir para pagamento
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
