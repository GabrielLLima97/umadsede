import { useEffect, useRef } from "react";
import classNames from "classnames";

type Props = {
  categories?: string[];
  active: string;
  onActive: (cat: string) => void;
};

export default function CategoryChips({ categories, active, onActive }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cats = categories ?? [];
    if (cats.length === 0) return;
    const sections = cats.map((c) => document.getElementById(`cat-${slugify(c)}`)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top));
        if (vis[0]) {
          const id = vis[0].target.id.replace("cat-", "");
          const name = deslugify(id);
          onActive(name);
        }
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: [0, 0.5, 1] }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [categories, onActive]);

  const scrollTo = (c: string) => {
    const el = document.getElementById(`cat-${slugify(c)}`);
    if (el) {
      const offset = 88;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
      onActive(c);
    }
  };

  const cats = categories ?? [];
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLButtonElement>(`button[data-cat="${slugify(active)}"]`);
    if (target) {
      target.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [active, categories]);

  return (
    <div ref={containerRef} className="sticky top-[88px] z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {cats.map((c) => {
          const isActive = active === c;
          return (
            <button
              key={c}
              data-cat={slugify(c)}
              aria-label={`Filtrar pela categoria ${c}`}
              onClick={() => scrollTo(c)}
              className={classNames(
                "transition-all whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold border",
                isActive
                  ? "bg-brand-primary text-white border-brand-primary shadow"
                  : "bg-white text-slate-600 border-slate-200 hover:border-brand-primary/60 hover:text-brand-primary"
              )}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
export const deslugify = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
