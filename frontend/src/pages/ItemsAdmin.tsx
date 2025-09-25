import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Item = {
  id?: number;
  sku: number;
  nome: string;
  descricao?: string;
  preco: string | number;
  categoria?: string;
  imagem_url?: string;
  ativo: boolean;
  estoque_inicial: number;
  vendidos: number;
};

const emptyItem: Item = {
  sku: 0,
  nome: "",
  descricao: "",
  preco: "0.00",
  categoria: "",
  imagem_url: "",
  ativo: true,
  estoque_inicial: 0,
  vendidos: 0,
};

export default function ItemsAdmin(){
  const [items,setItems]=useState<Item[]>([]);
  const [form,setForm]=useState<Item>({...emptyItem});
  const [editingId,setEditingId]=useState<number|null>(null);
  const [loading,setLoading]=useState(false);
  const [q,setQ]=useState("");
  const [catFilter,setCatFilter]=useState("");

  const carregar = async ()=>{
    const r = await api.get("/items/?all=1");
    const data = r.data?.results || r.data || [];
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(()=>{ carregar(); },[]);

  const onChange = (k:keyof Item, v:any)=> setForm(prev=> ({...prev, [k]: v}));

  const salvarNovo = async ()=>{
    if(!form.nome.trim() || !form.sku){ alert("Informe SKU e Nome"); return; }
    setLoading(true);
    try{
      const payload = { ...form, preco: Number(form.preco) };
      await api.post("/items/", payload);
      setForm({...emptyItem});
      await carregar();
    } catch(e:any){
      alert(e?.response?.data?.detail || "Erro ao salvar item");
    } finally{ setLoading(false); }
  };

  const iniciarEdicao = (it: Item)=>{ setEditingId(it.id!); setForm({...it}); };
  const cancelarEdicao = ()=>{ setEditingId(null); setForm({...emptyItem}); };
  const salvarEdicao = async ()=>{
    if(editingId==null) return;
    setLoading(true);
    try{
      const payload = {
        sku: form.sku,
        nome: form.nome,
        descricao: form.descricao,
        preco: Number(form.preco),
        categoria: form.categoria,
        imagem_url: form.imagem_url,
        ativo: form.ativo,
        estoque_inicial: form.estoque_inicial,
        vendidos: form.vendidos,
      };
      await api.patch(`/items/update_item/`, { id: editingId, ...payload });
      setEditingId(null); setForm({...emptyItem});
      await carregar();
    } catch(e:any){
      alert(e?.response?.data?.detail || "Erro ao salvar edição");
    } finally{ setLoading(false); }
  };

  const remover = async (id:number)=>{
    if(!confirm("Excluir este item?")) return;
    await api.delete(`/items/${id}/`);
    await carregar();
  };

  const categories = useMemo(()=> Array.from(new Set(items.map(i=> i.categoria||"Outros"))).sort(), [items]);
  const sorted = useMemo(()=>{
    const filtered = items.filter(it=>
      (!q || it.nome.toLowerCase().includes(q.toLowerCase()) || String(it.sku).includes(q)) &&
      (!catFilter || (it.categoria||"Outros")===catFilter)
    );
    return filtered.sort((a:any,b:any)=>{
      const c = String(a.categoria||"").localeCompare(String(b.categoria||""));
      if(c!==0) return c;
      return String(a.nome||"").localeCompare(String(b.nome||""));
    });
  },[items,q,catFilter]);

  const F = form;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-black">Cadastro de Itens</div>
        <div className="flex items-center gap-2">
          <input className="input" placeholder="Buscar por nome ou SKU" value={q} onChange={e=>setQ(e.target.value)} />
          <select className="input" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
            <option value="">Todas as categorias</option>
            {categories.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={carregar}>Atualizar</button>
        </div>
      </div>
      <div className="card grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-bold">SKU</label>
          <input type="number" className="input" value={F.sku} onChange={e=>onChange("sku", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-sm font-bold">Nome</label>
          <input className="input" value={F.nome} onChange={e=>onChange("nome", e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-bold">Preço</label>
          <input type="number" step="0.01" className="input" value={F.preco} onChange={e=>onChange("preco", e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-bold">Categoria</label>
          <input className="input" value={F.categoria||""} onChange={e=>onChange("categoria", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-bold">Descrição</label>
          <textarea className="input" value={F.descricao||""} onChange={e=>onChange("descricao", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-bold">Imagem URL</label>
          <input className="input" value={F.imagem_url||""} onChange={e=>onChange("imagem_url", e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-bold">Estoque inicial</label>
          <input type="number" className="input" value={F.estoque_inicial} onChange={e=>onChange("estoque_inicial", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-sm font-bold">Vendidos</label>
          <input type="number" className="input" value={F.vendidos} onChange={e=>onChange("vendidos", Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-2">
          <input id="ativo" type="checkbox" checked={!!F.ativo} onChange={e=>onChange("ativo", e.target.checked)} />
          <label htmlFor="ativo" className="text-sm font-bold">Ativo</label>
        </div>
        <div className="flex items-end gap-2">
          {editingId==null ? (
            <button className="btn btn-primary" disabled={loading} onClick={salvarNovo}>Salvar novo</button>
          ) : (
            <>
              <button className="btn btn-primary" disabled={loading} onClick={salvarEdicao}>Salvar edição</button>
              <button className="btn btn-ghost" onClick={cancelarEdicao}>Cancelar</button>
            </>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3">Nome</th>
              <th className="py-2 pr-3">Categoria</th>
              <th className="py-2 pr-3">Preço</th>
              <th className="py-2 pr-3">Estoque</th>
              <th className="py-2 pr-3">Vendidos</th>
              <th className="py-2 pr-3">Ativo</th>
              <th className="py-2 pr-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(it=> (
              <tr key={it.id} className="border-t border-slate-200">
                <td className="py-2 pr-3 font-mono">{it.sku}</td>
                <td className="py-2 pr-3">{it.nome}</td>
                <td className="py-2 pr-3">{it.categoria||"-"}</td>
                <td className="py-2 pr-3">R$ {Number(it.preco).toFixed(2).replace('.',',')}</td>
                <td className="py-2 pr-3">{it.estoque_inicial}</td>
                <td className="py-2 pr-3">{it.vendidos}</td>
                <td className="py-2 pr-3">{it.ativo?"Sim":"Não"}</td>
                <td className="py-2 pr-3 flex gap-2">
                  <button className="btn btn-ghost" onClick={()=>iniciarEdicao(it)}>Editar</button>
                  <button className={`btn ${it.ativo?"bg-rose-50 border-rose-200 text-rose-700":"btn-primary"}`}
                    onClick={async()=>{
                      const pk = Number(it.id);
                      if(!pk || Number.isNaN(pk)) { alert("ID do item inválido"); return; }
                      try{
                        await api.post(`/items/toggle_active/`, { id: pk, ativo: !it.ativo });
                        await carregar();
                      } catch(e:any){
                        const msg = e?.response?.data?.detail || e?.response?.data || "Erro ao atualizar status";
                        alert(String(msg));
                      }
                    }}>
                    {it.ativo?"Inativar":"Ativar"}
                  </button>
                  <button className="btn bg-rose-50 border-rose-200 text-rose-700" onClick={()=>remover(it.id!)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
