import { useCartTotals } from "../../store/cart";
import { brl } from "../../utils/format";

export default function MobileBar({ onCheckout }:{ onCheckout:()=>void }){
  const { total } = useCartTotals();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur px-4 py-2 flex items-center justify-between md:hidden">
      <div className="font-black">{brl.format(total)}</div>
      <button className="btn btn-primary" onClick={onCheckout} aria-label="Ir para pagamento">Ir para pagamento</button>
    </div>
  );
}

