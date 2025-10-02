import { Dialog, Transition } from "@headlessui/react";
import classNames from "classnames";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  categories?: string[];
  active: string;
  onActive: (cat: string) => void;
};

export default function CategoryChips({ categories, active, onActive }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
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
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const target = scroller.querySelector<HTMLButtonElement>(`button[data-cat="${slugify(active)}"]`);
    if (!target) return;
    const targetRect = target.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const centered = targetRect.left - scrollerRect.left + scroller.scrollLeft - scrollerRect.width / 2 + targetRect.width / 2;
    const maxScroll = scroller.scrollWidth - scrollerRect.width;
    const nextLeft = Math.max(0, Math.min(maxScroll, centered));
    scroller.scrollTo({ left: nextLeft, behavior: reduceMotion ? "auto" : "smooth" });
  }, [active, categories, reduceMotion]);

  const allCategories = useMemo(() => cats.map((c) => ({
    label: c,
    icon: iconForCategory(c),
  })), [cats]);

  return (
    <>
      <div className="md:sticky md:top-16 z-30 bg-white/95 backdrop-blur transition-shadow shadow-sm">
        <div
          ref={scrollerRef}
          className="flex gap-2 overflow-x-auto px-4 py-3 scroll-smooth snap-x snap-mandatory"
          role="tablist"
          aria-label="Categorias de produtos"
        >
          {cats.map((c) => {
            const isActive = active === c;
            const icon = iconForCategory(c);
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
                <span
                  aria-hidden
                  className={classNames(
                    "text-base transition-colors",
                    isActive ? "text-white" : "text-slate-500 group-hover:text-brand-primary"
                  )}
                >
                  {icon}
                </span>
                <span>{c}</span>
              </button>
            );
          })}
          {cats.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="group snap-start inline-flex min-h-[48px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-primary/60 hover:text-brand-primary"
              aria-label="Abrir todas as categorias"
            >
              <span aria-hidden className="text-base text-slate-500 group-hover:text-brand-primary">{genericIcon}</span>
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
                          "group flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-brand-primary/60 hover:text-brand-primary"
                        )}
                        role="listitem"
                      >
                        <span aria-hidden className="text-lg text-slate-500 group-hover:text-brand-primary">
                          {icon}
                        </span>
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
  if (key.includes("hamb")) return burgerIcon;
  if (key.includes("frango")) return chickenIcon;
  if (key.includes("drink") || key.includes("beb")) return drinkIcon;
  if (key.includes("combo")) return comboIcon;
  if (key.includes("sobrem")) return dessertIcon;
  if (key.includes("lanche")) return snackIcon;
  if (key.includes("veg")) return leafIcon;
  return genericIcon;
};

const iconBase = "h-4 w-4";

const burgerIcon = (
  <svg className={iconBase} viewBox="0 0 24 24" fill="none" stroke="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 9c0-2.2 3.1-4 7-4s7 1.8 7 4v1H5V9Z" fill="currentColor" opacity={0.95} />
    <rect x="4" y="11" width="16" height="3" rx="1.5" fill="currentColor" opacity={0.9} />
    <path d="M5 15h14v1c0 1.7-3.1 3-7 3s-7-1.3-7-3v-1Z" fill="currentColor" opacity={0.85} />
  </svg>
);

const chickenIcon = (
  <svg className={iconBase} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M14 5a5 5 0 0 0-5 5c0 1 .3 1.9.8 2.7l-2 2a2 2 0 1 0 2.8 2.8l.4-.4a1.5 1.5 0 0 0 2.1 2.1l.4-.4a2 2 0 1 0 2.8-2.8l2-2a5 5 0 0 0 2.7.8 5 5 0 1 0-5-5c0 .5.1 1 .3 1.4l-2.1 2.1A4 4 0 0 1 14 5Z"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
    />
  </svg>
);

const drinkIcon = (
  <svg className={iconBase} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6h12l-1.2 11.6A3.8 3.8 0 0 1 13 21h-2a3.8 3.8 0 0 1-3.8-3.4L6 6Z" fill="currentColor" opacity={0.85} />
    <path d="M8 6 7.5 2.5h9L16 6H8Z" fill="currentColor" opacity={0.45} />
    <path d="M7.2 10h9.6l-.3 3H7.5l-.3-3Z" fill="#ffffff" opacity={0.25} />
  </svg>
);

const comboIcon = (
  <svg className={iconBase} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="11" width="16" height="9" rx="2.5" fill="currentColor" opacity={0.85} />
    <path d="M7 8.5C7 6.6 9.7 5 12 5s5 1.6 5 3.5V11H7V8.5Z" fill="currentColor" opacity={0.55} />
    <path d="M9 6.5 10 3h4l1 3.5H9Z" fill="currentColor" opacity={0.35} />
  </svg>
);

const dessertIcon = (
  <svg className={iconBase} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 10c0-2.8 2.7-5 6-5s6 2.2 6 5l-1.5 6.5a3 3 0 0 1-2.9 2.3h-4.2a3 3 0 0 1-2.9-2.3L6 10Z" fill="currentColor" opacity={0.85} />
    <path d="M10.5 6.5c0-1 .8-1.8 1.8-1.8s1.7.8 1.7 1.8-.8 1.7-1.7 1.7-1.8-.8-1.8-1.7Z" fill="currentColor" opacity={0.5} />
  </svg>
);

const snackIcon = (
  <svg className={iconBase} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="7" width="14" height="10" rx="3" fill="currentColor" opacity={0.85} />
    <path d="M7 9.5h10" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity={0.4} />
    <path d="M7 12.5h10" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity={0.25} />
  </svg>
);

const leafIcon = (
  <svg className={iconBase} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 5c-5.5 0-10 4.5-10 10 0 1.7.4 3.3 1.2 4.7-2.8-.4-5.2-2.5-5.2-5.6 0-6.4 5.1-9.1 14-9.1Z" fill="currentColor" opacity={0.6} />
    <path d="M9 15c2.3.2 4.6 1 6.5 2.4" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity={0.4} />
  </svg>
);

const genericIcon = (
  <svg className={iconBase} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="8" fill="currentColor" opacity={0.4} />
  </svg>
);
