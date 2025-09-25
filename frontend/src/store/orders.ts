import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OrderRef = {
  id: number;
  createdAt: string;
  total?: number;
  name?: string;
};

type OrdersState = {
  orders: OrderRef[];
  addOrder: (o: OrderRef) => void;
  clear: () => void;
};

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      addOrder: (o) => set((state) => {
        const exists = state.orders.some((x) => x.id === o.id);
        const orders = exists ? state.orders : [{ id: o.id, createdAt: o.createdAt, total: o.total, name: o.name }, ...state.orders].slice(0, 50);
        return { orders };
      }),
      clear: () => set({ orders: [] }),
    }),
    { name: "umadsede-orders" }
  )
);

