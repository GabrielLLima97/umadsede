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

type CategoryOrder = {
  id: number;
  nome: string;
  ordem: number;
};

const DEFAULT_CATEGORY_PRIORITY: Record<string, number> = {
  hamburguer: 0,
  drink: 1,
  bebidas: 2,
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
  const [categoryOrders,setCategoryOrders] = useState<CategoryOrder[]>([]);
  const [orderDraft,setOrderDraft] = useState<Record<string,string>>({});
  const [savingCategory,setSavingCategory] = useState<string|null>(null);

  const loadCategoryOrders = async ()=>{
    const r = await api.get("/category-order/");
    const data = r.data?.results || r.data || [];
    setCategoryOrders(Array.isArray(data) ? data : []);
  };

  const carregar = async ()=>{
    const [ri, rc] = await Promise.all([
      api.get("/items/?all=1"),
      api.get("/category-order/"),
    ]);
    const dataItems = ri.data?.results || ri.data || [];
    setItems(Array.isArray(dataItems) ? dataItems : []);
    const dataCat = rc.data?.results || rc.data || [];
    setCategoryOrders(Array.isArray(dataCat) ? dataCat : []);
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

  const handleOrderChange = (nome: string, valor: string)=>{
    setOrderDraft(prev=> ({ ...prev, [nome]: valor }));
  };

  const saveCategoryOrder = async (nome: string)=>{
    const key = nome.toLowerCase();
    const current = orderDraft[nome] ?? (orderMap[key] !== undefined ? String(orderMap[key]) : "");
    if(current === ""){
      alert("Informe um número para definir a ordem.");
      return;
    }
    const ordem = Number(current);
    if(!Number.isFinite(ordem)){
      alert("A ordem precisa ser um número válido.");
      return;
    }
    setSavingCategory(nome);
    try{
      const existing = categoryOrders.find(co => (co?.nome || "").toLowerCase() === key);
      if(existing){
        await api.patch(`/category-order/${existing.id}/`, { ordem });
      } else {
        await api.post("/category-order/", { nome, ordem });
      }
      setOrderDraft(prev=> {
        const next = { ...prev };
        delete next[nome];
        return next;
      });
      await loadCategoryOrders();
    } catch(e:any){
      const detail = e?.response?.data?.detail || JSON.stringify(e?.response?.data || {});
      alert(`Não foi possível salvar a ordem: ${detail}`);
    } finally {
      setSavingCategory(null);
    }
  };

  const clearCategoryOrder = async (nome: string)=>{
    const key = nome.toLowerCase();
    const existing = categoryOrders.find(co => (co?.nome || "").toLowerCase() === key);
    setSavingCategory(nome);
    try{
      setOrderDraft(prev=> {
        const next = { ...prev };
        delete next[nome];
        return next;
      });
      if(existing){
        await api.delete(`/category-order/${existing.id}/`);
        await loadCategoryOrders();
      }
    } catch(e:any){
      const detail = e?.response?.data?.detail || JSON.stringify(e?.response?.data || {});
      alert(`Não foi possível limpar a ordem: ${detail}`);
    } finally {
      setSavingCategory(null);
    }
  };

  const orderMap = useMemo(()=>{
    const map: Record<string, number> = {};
    categoryOrders.forEach(co => {
      const key = (co.nome || "").toLowerCase();
      if (key) map[key] = Number(co.ordem ?? 0);
    });
    return map;
  }, [categoryOrders]);

  const categories = useMemo(()=> {
    const uniqSet = new Set<string>();
    items.forEach(i => uniqSet.add(i.categoria || "Outros"));
    categoryOrders.forEach(co => {
      const nome = co?.nome ? String(co.nome) : "";
      if(nome) uniqSet.add(nome);
    });
    const uniq = Array.from(uniqSet);
    const sorted = uniq.sort((a,b)=>{
      const aKey = (a || "Outros").toLowerCase();
      const bKey = (b || "Outros").toLowerCase();
      const aScore = orderMap[aKey] ?? DEFAULT_CATEGORY_PRIORITY[aKey] ?? 999;
      const bScore = orderMap[bKey] ?? DEFAULT_CATEGORY_PRIORITY[bKey] ?? 999;
      return aScore - bScore || a.localeCompare(b);
    });
    return sorted;
  }, [items, orderMap, categoryOrders]);
  const sorted = useMemo(()=>{
    const filtered = items.filter(it=>
      (!q || it.nome.toLowerCase().includes(q.toLowerCase()) || String(it.sku).includes(q)) &&
      (!catFilter || (it.categoria||"Outros")===catFilter)
    );
    return filtered.sort((a:any,b:any)=>{
      const aKey = (a.categoria || "Outros").toLowerCase();
      const bKey = (b.categoria || "Outros").toLowerCase();
      const scoreA = orderMap[aKey] ?? DEFAULT_CATEGORY_PRIORITY[aKey] ?? 999;
      const scoreB = orderMap[bKey] ?? DEFAULT_CATEGORY_PRIORITY[bKey] ?? 999;
      if(scoreA !== scoreB) return scoreA - scoreB;
      const c = String(a.categoria||"").localeCompare(String(b.categoria||""));
      if(c!==0) return c;
      return String(a.nome||"").localeCompare(String(b.nome||""));
    });
  },[items,q,catFilter, orderMap]);

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

      <div className="card">
        <div className="font-black mb-2">Ordem das categorias</div>
        <div className="text-sm text-slate-600 mb-3">Defina a sequência em que as categorias aparecem nas páginas de venda (cliente e caixa). Números menores aparecem primeiro.</div>
        <div className="flex flex-col gap-2">
          {categories.map(cat=> {
            const key = (cat || "Outros").toLowerCase();
            const rawDraft = orderDraft.hasOwnProperty(cat) ? orderDraft[cat] : undefined;
            const current = rawDraft !== undefined ? rawDraft : (orderMap[key] !== undefined ? String(orderMap[key]) : "");
            const saving = savingCategory === cat;
            const hasCustom = orderMap[key] !== undefined || rawDraft !== undefined;
            return (
              <div key={cat} className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[160px] font-bold">{cat}</div>
                <input
                  type="number"
                  className="input w-28"
                  value={current}
                  onChange={e=>handleOrderChange(cat, e.target.value)}
                  placeholder="Ordem"
                  aria-label={`Ordem da categoria ${cat}`}
                />
                <button
                  type="button"
                  className={`btn btn-primary ${saving?"loading":""}`}
                  onClick={()=>saveCategoryOrder(cat)}
                  disabled={saving}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={()=>clearCategoryOrder(cat)}
                  disabled={saving || !hasCustom}
                >
                  Limpar
                </button>
              </div>
            );
          })}
          {categories.length === 0 && (
            <div className="text-sm text-slate-500">Nenhuma categoria cadastrada no momento.</div>
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
