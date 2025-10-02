import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { brl } from "../../utils/format";
import { useCart } from "../../store/cart";

type Props = {
  item: any;
  showExactStock?: boolean;
  onDetails?: (item: any) => void;
  compact?: boolean;
};

const parseNumber = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const ProductCard: React.FC<Props> = ({ item, showExactStock = false, onDetails, compact = false }) => {
  const add = useCart((s) => s.add);
  const remove = useCart((s) => s.remove);
  const cartItem = useCart((s) => s.items.find((x) => x.id === item.id));
  const qty = cartItem?.qtd || 0;
  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const estoqueDisponivel = useMemo(() => {
    const raw = item?.estoque_disponivel ?? item?.estoque_inicial ?? 0;
    return Math.max(parseNumber(raw), 0);
  }, [item]);

  const soldOut = estoqueDisponivel <= 0;
  const remaining = Math.max(estoqueDisponivel - qty, 0);
  const canAdd = !soldOut && remaining > 0;
  const canRemove = qty > 0;

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const addOne = useCallback(() => {
    if (!canAdd) return;
    add({ id: item.id, sku: item.sku, nome: item.nome, preco: Number(item.preco), categoria: item.categoria });
    setJustAdded(true);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(15);
      }
    } catch {
      /* noop: vibração não suportada */
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setJustAdded(false), 420);
  }, [add, item, canAdd]);

  const remOne = useCallback(() => {
    if (!canRemove) return;
    remove(item.id, 1);
  }, [remove, item, canRemove]);

  const imageClasses = soldOut
    ? "h-full w-full object-cover filter grayscale contrast-75 opacity-60"
    : "h-full w-full object-cover";
  const showDetailsButton = !!item.descricao && (compact || String(item.descricao).length > 96);
  const descriptionClass = compact ? "mt-2 text-sm text-slate-600 line-clamp-1" : "mt-2 text-sm text-slate-600 line-clamp-2";

  return (
    <article
      className={`flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-lg focus-within:shadow-lg ${soldOut ? "opacity-90" : ""}`}
      data-soldout={soldOut}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 md:h-28 md:w-28">
        {item.imagem_url ? (
          <img
            src={item.imagem_url}
            alt={item.nome}
            loading="lazy"
            decoding="async"
            sizes="96px"
            className={imageClasses}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">Sem imagem</div>
        )}
        {soldOut && (
          <span className="absolute left-2 top-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-600 shadow">
            Esgotado
          </span>
        )}
      </div>
      <div className="flex w-full flex-col gap-3">
        <div>
          <h3 className="text-lg font-black leading-tight text-slate-900">{item.nome}</h3>
          <p className="mt-1 text-base font-extrabold text-slate-900">{brl.format(Number(item.preco))}</p>
          {item.descricao && (
            <p className={descriptionClass}>{item.descricao}</p>
          )}
          {!soldOut && estoqueDisponivel > 0 && (
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              {showExactStock ? `Disponíveis: ${estoqueDisponivel}` : remaining <= 3 ? "Últimas unidades" : "Restam algumas unidades"}
            </p>
          )}
          {soldOut && qty === 0 && (
            <p className="mt-1 text-xs font-semibold text-rose-600">Este produto está indisponível no momento.</p>
          )}
          {soldOut && qty > 0 && (
            <p className="mt-1 text-xs font-semibold text-rose-600">Sem estoque adicional. Você já adicionou o limite disponível.</p>
          )}
        </div>

        {showDetailsButton && (
          <button
            type="button"
            className="self-start rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-primary/60 hover:text-brand-primary"
            onClick={() => onDetails?.(item)}
          >
            Detalhes
          </button>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Diminuir quantidade"
              onClick={remOne}
              disabled={!canRemove}
              className="btn bg-white text-brand-primary border-brand-primary hover:bg-brand-cream disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary/50 min-h-[48px] min-w-[48px]"
            >
              −
            </button>
            <div className="min-w-[56px] rounded-xl border border-slate-200 bg-white py-2 text-center font-extrabold" aria-live="polite">
              {qty}
            </div>
          </div>
          {!soldOut && (
            <button
              type="button"
              aria-label="Adicionar ao carrinho"
              onClick={addOne}
              disabled={!canAdd}
              className={`btn btn-primary flex-1 min-h-[48px] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed ${justAdded ? "ring-2 ring-white ring-offset-2 ring-offset-brand-primary" : ""}`}
              aria-pressed={qty > 0}
              data-state={justAdded ? "added" : qty > 0 ? "selected" : "default"}
            >
              {qty > 0 ? "Adicionar mais" : "Adicionar"}
              {justAdded && (
                <span className="sr-only" role="status">Produto adicionado ao carrinho</span>
              )}
            </button>
          )}
        </div>
        {soldOut && !qty && (
          <div className="text-xs font-semibold text-slate-500">Volte em instantes — estamos repondo o estoque.</div>
        )}
      </div>
    </article>
  );
};

export default ProductCard;
