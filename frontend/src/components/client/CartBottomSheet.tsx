import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useCart, useCartTotals } from "../../store/cart";
import { brl } from "../../utils/format";

type Props = {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
};

export default function CartBottomSheet({ open, onClose, onCheckout }: Props) {
  const items = useCart((s) => s.items);
  const remove = useCart((s) => s.remove);
  const totals = useCartTotals();
  const hasItems = items.length > 0;
  const dragState = useRef({ startY: 0, dragging: false });
  const [dragOffset, setDragOffset] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setExpanded(false);
      dragState.current.dragging = false;
    }
  }, [open]);

  const onDragStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!open) return;
    dragState.current.dragging = true;
    dragState.current.startY = event.touches[0]?.clientY ?? 0;
    setDragOffset(0);
  };

  const onDragMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!dragState.current.dragging) return;
    const currentY = event.touches[0]?.clientY ?? 0;
    const delta = currentY - dragState.current.startY;
    if (delta > 0) {
      event.preventDefault();
      setDragOffset(Math.min(delta, 200));
    } else if (delta < -48) {
      setExpanded(true);
    }
  };

  const onDragEnd = () => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    if (dragOffset > 90) {
      setDragOffset(0);
      onClose();
      return;
    }
    setDragOffset(0);
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter={prefersReducedMotion ? "duration-0" : "ease-out duration-200"}
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave={prefersReducedMotion ? "duration-0" : "ease-in duration-150"}
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-end justify-center">
          <Transition.Child
            as={Fragment}
            enter={prefersReducedMotion ? "duration-0" : "ease-out duration-200"}
            enterFrom="translate-y-full"
            enterTo="translate-y-0"
            leave={prefersReducedMotion ? "duration-0" : "ease-in duration-200"}
            leaveFrom="translate-y-0"
            leaveTo="translate-y-full"
          >
            <Dialog.Panel
              className={`w-full max-w-md md:hidden rounded-t-3xl bg-white shadow-2xl ${expanded ? "max-h-[85vh]" : "max-h-[70vh]"} ${dragState.current.dragging ? "cursor-grabbing" : "cursor-grab"}`}
              style={{
                transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
                transition: dragState.current.dragging || prefersReducedMotion ? "none" : "transform 0.2s ease",
              }}
            >
              <div
                className="flex flex-col items-center py-3 touch-none select-none"
                onTouchStart={onDragStart}
                onTouchMove={onDragMove}
                onTouchEnd={onDragEnd}
                onTouchCancel={onDragEnd}
              >
                <div className="h-1.5 w-12 rounded-full bg-slate-300" aria-hidden="true" />
              </div>
              <div className="px-5 pb-5 overflow-y-auto">
                <Dialog.Title className="text-lg font-black text-slate-900">Seu pedido</Dialog.Title>
                {!hasItems && (
                  <p className="mt-4 text-sm text-slate-500">Seu carrinho está vazio. Adicione produtos para continuar.</p>
                )}
                {hasItems && (
                  <ul className="mt-4 space-y-3">
                    {items.map((it) => (
                      <li key={it.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{it.nome}</p>
                          <p className="text-xs text-slate-500">{brl.format(it.preco)} • x{it.qtd}</p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost shrink-0"
                          onClick={() => remove(it.id, 1)}
                          aria-label={`Remover 1 unidade de ${it.nome}`}
                        >
                          -1
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <div className="flex justify-between"><span>Subtotal</span><span>{brl.format(totals.subtotal)}</span></div>
                  <div className="flex justify-between"><span>Taxas</span><span>{brl.format(totals.taxas)}</span></div>
                  <div className="flex justify-between text-base text-slate-900 font-black"><span>Total</span><span>{brl.format(totals.total)}</span></div>
                  <div className="text-xs text-slate-500">Tempo estimado de preparo: 20-30 minutos</div>
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={() => {
                      onClose();
                      if (hasItems) onCheckout();
                    }}
                    disabled={!hasItems}
                  >
                    Finalizar pedido
                  </button>
                  <button type="button" className="btn" onClick={onClose}>Continuar comprando</button>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
