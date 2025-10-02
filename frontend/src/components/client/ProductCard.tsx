import React, { useCallback, useMemo } from "react";
import { brl } from "../../utils/format";
import { useCart } from "../../store/cart";

type Props = {
  item: any;
};

const parseNumber = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const ProductCard: React.FC<Props> = ({ item }) => {
  const add = useCart((s) => s.add);
  const remove = useCart((s) => s.remove);
  const cartItem = useCart((s) => s.items.find((x) => x.id === item.id));
  const qty = cartItem?.qtd || 0;

  const estoqueDisponivel = useMemo(() => {
    const raw = item?.estoque_disponivel ?? item?.estoque_inicial ?? 0;
    return Math.max(parseNumber(raw), 0);
  }, [item]);

  const soldOut = estoqueDisponivel <= 0;
  const remaining = Math.max(estoqueDisponivel - qty, 0);
  const canAdd = !soldOut && remaining > 0;
  const canRemove = qty > 0;

  const addOne = useCallback(() => {
    if (!canAdd) return;
    add({ id: item.id, sku: item.sku, nome: item.nome, preco: Number(item.preco), categoria: item.categoria });
  }, [add, item, canAdd]);

  const remOne = useCallback(() => {
    if (!canRemove) return;
    remove(item.id, 1);
  }, [remove, item, canRemove]);

  const imageClass = soldOut
    ? "h-24 w-24 rounded-xl object-cover filter grayscale contrast-75 opacity-60"
    : "h-24 w-24 rounded-xl object-cover";

  return (
    <div className={`flex gap-3 rounded-2xl border border-slate-200 p-3 ${soldOut ? "bg-slate-100" : "bg-white"}`}>
      {item.imagem_url ? (
        <img src={item.imagem_url} loading="lazy" alt={item.nome} width={96} height={96} className={imageClass} />
      ) : (
        <div aria-label="sem imagem" className={`${imageClass} flex items-center justify-center bg-slate-100 border border-slate-200`}>
          <span className="text-xs text-slate-500">Sem imagem</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-extrabold text-slate-900 truncate" title={item.nome}>{item.nome}</div>
          {soldOut && (
            <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-rose-700">Esgotado</span>
          )}
        </div>
        <div className="font-extrabold">{brl.format(Number(item.preco))}</div>
        {item.descricao && <div className="text-slate-600 text-sm line-clamp-2">{item.descricao}</div>}
        {!soldOut && estoqueDisponivel > 0 && (
          <div className="mt-1 text-xs font-semibold text-emerald-700">Restam {estoqueDisponivel} unidades</div>
        )}
        {soldOut && qty === 0 && (
          <div className="mt-1 text-xs font-semibold text-rose-600">Este produto está indisponível no momento.</div>
        )}
        {soldOut && qty > 0 && (
          <div className="mt-1 text-xs font-semibold text-rose-600">Sem estoque adicional. Ajuste a quantidade se necessário.</div>
        )}
        <div className="mt-3 grid grid-cols-[1fr,80px,1fr] gap-2 items-center">
          <button
            aria-label="diminuir"
            onClick={remOne}
            disabled={!canRemove}
            className="btn disabled:opacity-40 disabled:cursor-not-allowed bg-white text-brand-primary border-brand-primary hover:bg-brand-cream"
          >
            ➖
          </button>
          <div className="rounded-xl border border-slate-200 text-center font-extrabold py-2 select-none bg-white">
            {qty}
          </div>
          <button
            aria-label="aumentar"
            onClick={addOne}
            disabled={!canAdd}
            className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ➕
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
