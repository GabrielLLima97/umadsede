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
      { rootMargin: "-64px 0px -60% 0px", threshold: [0, 0.5, 1] }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [categories, onActive]);

  const scrollTo = (c: string) => {
    const el = document.getElementById(`cat-${slugify(c)}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cats = categories ?? [];
  return (
    <div ref={containerRef} className="sticky top-[96px] z-20 bg-white border-b border-slate-200">
      <div className="flex gap-2 overflow-x-auto px-2 py-2">
        {cats.map((c) => (
          <button
            key={c}
            aria-label={`Filtrar pela categoria ${c}`}
            onClick={() => scrollTo(c)}
            className={classNames(
              "whitespace-nowrap rounded-full px-3 py-1 text-sm border",
              active === c ? "bg-brand-primary text-white border-brand-primary" : "bg-white text-slate-700 border-slate-200"
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

export const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
export const deslugify = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
