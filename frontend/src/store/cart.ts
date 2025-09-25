import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  id: number;
  sku: number;
  nome: string;
  preco: number;
  qtd: number;
  nota?: string;
  categoria?: string;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qtd">, dq?: number) => void;
  remove: (id: number, dq?: number) => void;
  setQty: (id: number, qtd: number) => void;
  setNote: (id: number, nota: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (it, dq = 1) => set(state => {
        const items = [...state.items];
        const idx = items.findIndex(x => x.id === it.id);
        if (idx >= 0) {
          // criar novo objeto para garantir mudança de referência e reatividade
          const cur = items[idx];
          items[idx] = { ...cur, qtd: cur.qtd + dq };
        } else {
          items.push({ ...it, qtd: dq });
        }
        return { items };
      }),
      remove: (id, dq = 1) => set(state => {
        const items = state.items.map(x => ({ ...x }));
        const idx = items.findIndex(x => x.id === id);
        if (idx >= 0) {
          items[idx].qtd -= dq;
          if (items[idx].qtd <= 0) items.splice(idx, 1);
        }
        return { items };
      }),
      setQty: (id, qtd) => set(state => {
        const items = state.items.map(x => x.id === id ? { ...x, qtd } : x);
        return { items };
      }),
      setNote: (id, nota) => set(state => {
        const items = state.items.map(x => x.id === id ? { ...x, nota } : x);
        return { items };
      }),
      clear: () => set({ items: [] }),
    }),
    { name: "umadsede-cart" }
  )
);

export const useCartTotals = () => {
  const items = useCart(s => s.items);
  const subtotal = items.reduce((s, it) => s + it.preco * it.qtd, 0);
  const taxas = 0; // configurável
  const total = subtotal + taxas;
  return { subtotal, taxas, total };
};
