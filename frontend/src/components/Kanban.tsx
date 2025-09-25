export function Badge({text, color}:{text:string, color:string}){
  return <span className={`px-2 py-1 rounded-full text-xs font-black ${color}`}>{text}</span>;
}

export function elapsedInfo(ts:string, now:number){
  const ms = now - new Date(ts).getTime();
  const m = Math.max(0, Math.floor(ms/60000));
  const s = Math.floor((ms%60000)/1000);
  return { text: `${m}m ${s}s`, overSla: m >= 15 };
}

// Novo card de pedido, com agrupamento por categoria e navegação prev/next/seleção direta
export function OrderCard({p, itemsMap, now, onPrev, onNext}:{
  p:any;
  itemsMap: Record<number, {categoria?:string}>;
  now: number;
  onPrev: ()=>void;
  onNext: ()=>void;
}){
  const ORDER = ["pago","a preparar","em produção","pronto","finalizado"] as const;
  const groups:Record<string, any[]> = {};
  (p.itens||[]).forEach((it:any)=>{
    const cat = itemsMap?.[it.item]?.categoria || "Outros";
    if(!groups[cat]) groups[cat]=[];
    groups[cat].push(it);
  });
  const cats = Object.keys(groups).sort((a,b)=> a.localeCompare(b));
  const { text, overSla } = elapsedInfo(p.created_at, now);
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-black">#{p.id}</div>
          <div className="text-xl font-extrabold">{p.cliente_nome}</div>
        </div>
        <div className={`text-sm font-black ${overSla?"text-rose-600":"text-slate-500"}`}>{text} {overSla?"• SLA":""}</div>
      </div>
      {typeof p.observacoes === 'string' && p.observacoes.trim() && (
        <div className="mt-2 rounded-xl bg-brand-cream border border-slate-200 p-2 text-sm">
          <div className="font-bold text-slate-700 mb-1">Observações</div>
          <div className="text-slate-800 whitespace-pre-wrap">{p.observacoes}</div>
        </div>
      )}
      <div className="mt-2 grid md:grid-cols-2 gap-2">
        {cats.map(cat=> (
          <div key={cat} className="rounded-xl border border-slate-200 p-2">
            <div className="text-xs font-bold text-slate-500 mb-1">{cat}</div>
            <ul className="text-sm">
              {groups[cat].map((i:any,idx:number)=> (
                <li key={idx} className="flex justify-between items-center gap-3">
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 font-black">x{i.qtd}</span>
                  <span className="flex-1">{i.nome}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button className="btn btn-ghost" onClick={onPrev}>← Voltar</button>
        <button className="btn btn-primary" onClick={onNext}>Avançar →</button>
      </div>
    </div>
  );
}
