import { Dialog, Transition } from "@headlessui/react";
import classNames from "classnames";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  categories?: string[];
  active: string;
  onActive: (cat: string) => void;
};

export default function CategoryChips({ categories, active, onActive }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
      { rootMargin: "-80px 0px -60% 0px", threshold: [0, 0.5, 1] }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [categories, onActive]);

  const scrollTo = (c: string) => {
    const el = document.getElementById(`cat-${slugify(c)}`);
    if (el) {
      const offset = 72;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
      onActive(c);
    }
  };

  const cats = categories ?? [];
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLButtonElement>(`button[data-cat="${slugify(active)}"]`);
    if (target) {
      target.scrollIntoView({ inline: "center", block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [active, categories, reduceMotion]);

  const allCategories = useMemo(() => cats.map((c) => ({
    label: c,
    icon: iconForCategory(c),
  })), [cats]);

  return (
    <>
      <div
        ref={containerRef}
        className="md:sticky md:top-16 z-30 bg-white/95 backdrop-blur transition-shadow shadow-sm"
      >
        <div className="flex gap-2 overflow-x-auto px-4 py-3 scroll-smooth snap-x snap-mandatory" role="tablist" aria-label="Categorias de produtos">
          {cats.map((c) => {
            const isActive = active === c;
            return (
              <button
                key={c}
                data-cat={slugify(c)}
                aria-label={`Filtrar pela categoria ${c}`}
                onClick={() => scrollTo(c)}
                className={classNames(
                  "group snap-start inline-flex min-h-[48px] items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-slate-900 text-white border-slate-900 shadow"
                    : "bg-white text-slate-600 border-slate-200 hover:border-brand-primary/60 hover:text-brand-primary"
                )}
                role="tab"
                aria-selected={isActive}
              >
                <span aria-hidden className="text-base">{iconForCategory(c)}</span>
                <span>{c}</span>
              </button>
            );
          })}
          {cats.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="snap-start inline-flex min-h-[48px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-primary/60 hover:text-brand-primary"
              aria-label="Abrir todas as categorias"
            >
              <span aria-hidden className="text-base">🗂️</span>
              Todas
            </button>
          )}
        </div>
      </div>
      <Transition show={showAll} as={Fragment}>
        <Dialog as="div" className="relative z-40" onClose={() => setShowAll(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-end justify-center md:items-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="translate-y-full md:translate-y-0 md:scale-95"
              enterTo="translate-y-0 md:translate-y-0 md:scale-100"
              leave="ease-in duration-200"
              leaveFrom="translate-y-0 md:translate-y-0 md:scale-100"
              leaveTo="translate-y-full md:translate-y-0 md:scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg rounded-t-3xl md:rounded-3xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <Dialog.Title className="text-lg font-black text-slate-900">Todas as categorias</Dialog.Title>
                  <button
                    type="button"
                    onClick={() => setShowAll(false)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:border-brand-primary/60 hover:text-brand-primary"
                  >
                    Fechar
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3" role="list">
                  {allCategories.map(({ label, icon }) => {
                    const isActive = active === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setShowAll(false);
                          scrollTo(label);
                        }}
                        className={classNames(
                          "flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-brand-primary/60 hover:text-brand-primary"
                        )}
                        role="listitem"
                      >
                        <span aria-hidden className="text-lg">{icon}</span>
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

export const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
export const deslugify = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const iconForCategory = (value: string) => {
  const key = value.toLowerCase();
  if (key.includes("hamb")) return "🍔";
  if (key.includes("veg")) return "🥗";
  if (key.includes("drink") || key.includes("beb")) return "🥤";
  if (key.includes("combo")) return "🍱";
  if (key.includes("sobrem")) return "🍰";
  if (key.includes("lanche")) return "🥪";
  if (key.includes("porção") || key.includes("snack")) return "🍟";
  return "✨";
};
