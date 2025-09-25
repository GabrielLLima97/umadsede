import React, { useCallback } from "react";
import { brl } from "../../utils/format";
import { useCart } from "../../store/cart";

type Props = {
  item: any;
};

const ProductCard: React.FC<Props> = ({ item }) => {
  const add = useCart((s) => s.add);
  const remove = useCart((s) => s.remove);
  const cartItem = useCart((s) => s.items.find((x) => x.id === item.id));
  const qty = cartItem?.qtd || 0;

  const addOne = useCallback(() => add({ id: item.id, sku: item.sku, nome: item.nome, preco: Number(item.preco), categoria: item.categoria }), [add, item]);
  const remOne = useCallback(() => remove(item.id, 1), [remove, item]);

  return (
    <div className="flex gap-3">
      {item.imagem_url ? (
        <img src={item.imagem_url} loading="lazy" alt={item.nome} width={96} height={96} className="h-24 w-24 rounded-xl object-cover" />
      ) : (
        <div aria-label="sem imagem" className="h-24 w-24 rounded-xl bg-slate-100 border border-slate-200" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-slate-900 truncate" title={item.nome}>{item.nome}</div>
        <div className="font-extrabold">{brl.format(Number(item.preco))}</div>
        {item.descricao && <div className="text-slate-600 text-sm line-clamp-2">{item.descricao}</div>}
        <div className="mt-2 grid grid-cols-[1fr,80px,1fr] gap-2 items-center">
          <button
            aria-label="diminuir"
            onClick={remOne}
            disabled={qty === 0}
            className="btn disabled:opacity-40 bg-white text-brand-primary border-brand-primary hover:bg-brand-cream"
          >
            ➖
          </button>
          <div className="rounded-xl border border-slate-200 text-center font-extrabold py-2 select-none bg-white">
            {qty}
          </div>
          <button
            aria-label="aumentar"
            onClick={addOne}
            className="btn btn-primary"
          >
            ➕
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
