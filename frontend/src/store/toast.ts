import { create } from "zustand";

type Toast = { id: string; type?: "success"|"error"|"info"; message: string };
type ToastState = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
};

export const useToast = create<ToastState>((set,get)=>({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2);
    set(s=>({ toasts: [...s.toasts, { id, ...t }] }));
    setTimeout(()=> get().remove(id), 2500);
  },
  remove: (id) => set(s=>({ toasts: s.toasts.filter(x=>x.id!==id) })),
}));

