export const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const maskWhatsapp = (v: string) => {
  const num = v.replace(/\D/g, "");
  if (num.length <= 10) return num.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return num.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

export const debounce = <T extends (...args: any[]) => any>(fn: T, wait = 300) => {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

