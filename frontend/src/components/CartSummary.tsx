export default function CartSummary({cart,total,onRemove, onPay, disablePay}:{cart:any[],total:number,onRemove:(i:number)=>void,onPay:()=>void, disablePay?:boolean}){
  return (
    <div className="card">
      <div className="font-black mb-2">Resumo do Pedido</div>
      {cart.length===0 ? <div className="text-slate-500">Seu carrinho está vazio.</div> :
        <>
          <div className="flex flex-col gap-2">
            {cart.map((it:any)=>(
              <div key={it.item} className="flex items-center justify-between border-b border-dashed py-1">
                <div className="text-sm">{it.nome}</div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-black">x{it.qtd}</span>
                  <button className="btn bg-rose-50 border-rose-200 text-rose-700" onClick={()=>onRemove(it.item)}>✖</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 font-black">
            <div>Total</div><div>{`R$ ${total.toFixed(2).replace(".",",")}`}</div>
          </div>
          <button className="btn btn-primary mt-3 w-full disabled:opacity-40" onClick={onPay} disabled={disablePay}>Ir para pagamento</button>
        </>
      }
    </div>
  )
}
