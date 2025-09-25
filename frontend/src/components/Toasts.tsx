import { useToast } from "../store/toast";

export default function Toasts(){
  const toasts = useToast(s=>s.toasts);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t=> (
        <div key={t.id} className={`rounded-xl px-3 py-2 shadow border ${t.type==='error'?'bg-rose-50 border-rose-200 text-rose-800': t.type==='success'?'bg-emerald-50 border-emerald-200 text-emerald-800':'bg-slate-50 border-slate-200 text-slate-800'}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

