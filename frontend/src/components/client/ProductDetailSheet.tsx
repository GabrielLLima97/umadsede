import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { brl } from "../../utils/format";

type Props = {
  item: any | null;
  open: boolean;
  onClose: () => void;
};

export default function ProductDetailSheet({ item, open, onClose }: Props) {
  if (!item) return null;
  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-40" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
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
            <Dialog.Panel className="w-full max-w-lg rounded-t-3xl md:rounded-3xl bg-white shadow-2xl overflow-hidden">
              <div className="relative aspect-video bg-slate-100">
                {item.imagem_url ? (
                  <img
                    src={item.imagem_url}
                    alt={item.nome}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">Sem imagem</div>
                )}
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white"
                  onClick={onClose}
                  aria-label="Fechar detalhes"
                >
                  Fechar
                </button>
              </div>
              <div className="p-5 space-y-3">
                <Dialog.Title className="text-xl font-black text-slate-900">{item.nome}</Dialog.Title>
                <p className="text-lg font-extrabold text-slate-900">{brl.format(Number(item.preco))}</p>
                {item.descricao && (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{item.descricao}</p>
                )}
                {item.estoque_disponivel > 0 ? (
                  <p className="text-xs font-semibold text-emerald-700">Disponibilidade: {item.estoque_disponivel} unidade(s)</p>
                ) : (
                  <p className="text-xs font-semibold text-rose-600">Sem estoque disponível.</p>
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
