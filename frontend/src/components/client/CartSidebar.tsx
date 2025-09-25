import { useCartTotals } from "../../store/cart";
import { useCart } from "../../store/cart";
import { brl } from "../../utils/format";

type Props = { onCheckout: ()=>void; sticky?: boolean; showButton?: boolean };

export default function CartSidebar({ onCheckout, sticky=true, showButton=true }: Props){
  const items = useCart(s=>s.items);
  const { subtotal, taxas, total } = useCartTotals();
  // Edição no carrinho desabilitada conforme solicitado

  return (
    <div className={sticky?"sticky top-20":""}>
      <div className="card">
        <div className="font-black mb-2">Seu Pedido</div>
        {items.length===0 ? (
          <div className="text-slate-500">Seu carrinho está vazio.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(it=> (
              <div key={it.id} className="flex items-center justify-between border-b border-dashed py-1">
                <div className="min-w-0">
                  <div className="font-bold truncate" title={it.nome}>{it.nome}</div>
                  {it.nota && <div className="text-xs text-slate-500 truncate" title={it.nota}>{it.nota}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 font-black">x{it.qtd}</div>
                  <div className="font-bold w-20 text-right">{brl.format(it.preco*it.qtd)}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between mt-2 text-sm"><span>Subtotal</span><span className="font-bold">{brl.format(subtotal)}</span></div>
            <div className="flex items-center justify-between text-sm"><span>Taxas</span><span className="font-bold">{brl.format(taxas)}</span></div>
            <div className="flex items-center justify-between text-lg font-black"><span>Total</span><span>{brl.format(total)}</span></div>
            {showButton && (
              <button className="btn btn-primary mt-2" onClick={onCheckout} aria-label="Ir para pagamento">Ir para pagamento</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
