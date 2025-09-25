type Props = {
  item: any; qty: number; onAdd:()=>void; onRem:()=>void; disableAdd?: boolean;
}
export default function ItemCard({item, qty, onAdd, onRem, disableAdd}:Props){
  return (
    <div className="card flex gap-3">
      {item.imagem_url && <img src={item.imagem_url} className="h-[90px] w-[90px] rounded-xl object-cover" />}
      <div className="flex-1">
        <div className="font-extrabold text-slate-900">{item.nome}</div>
        <div className="font-extrabold">{`R$ ${Number(item.preco).toFixed(2).replace(".",",")}`}</div>
        {item.descricao && <div className="text-slate-600 text-sm">{item.descricao}</div>}
        <div className="mt-2 grid grid-cols-[1fr,70px,1fr] gap-2">
          <button onClick={onRem} disabled={qty===0} className="btn btn-ghost disabled:opacity-40">➖</button>
          <div className="rounded-xl border border-slate-200 text-center font-extrabold py-2">{qty}</div>
          <button onClick={onAdd} disabled={disableAdd} className="btn border-sky-200 bg-sky-100 disabled:opacity-40">➕</button>
        </div>
      </div>
    </div>
  );
}
