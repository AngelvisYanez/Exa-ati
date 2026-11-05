"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";

export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-red">
              <span className="size-1.5 rounded-full bg-brand-red" /> FAQ
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-gray-900 sm:text-4xl">
              Preguntas{" "}
              <span className="mk-serif-accent text-brand-red">frecuentes</span>
            </h2>
            <p className="mt-3 text-sm text-brand-gray-500">
              Respuestas para quien busca software de facturación y SRI en
              Ecuador. ¿Otra duda? Escríbenos desde el formulario.
            </p>
          </Reveal>

          <dl className="lg:col-span-8 divide-y divide-brand-gray-200 rounded-[1.75rem] bg-white px-6 ring-1 ring-brand-gray-200 sm:px-8">
            {items.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={f.q} className="py-1">
                  <dt>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${i}`}
                      id={`faq-btn-${i}`}
                      className="flex w-full items-center justify-between gap-4 py-4 text-left cursor-pointer"
                    >
                      <span className={cn("text-[15px] font-bold transition-colors", isOpen ? "text-brand-red" : "text-brand-gray-900")}>
                        {f.q}
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={{ duration: 0.25 }}
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                          isOpen ? "bg-brand-red text-white" : "bg-brand-gray-100 text-brand-gray-700",
                        )}
                      >
                        <Plus className="size-4" strokeWidth={2.5} />
                      </motion.span>
                    </button>
                  </dt>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.dd
                        id={`faq-panel-${i}`}
                        aria-labelledby={`faq-btn-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="pb-5 text-sm leading-relaxed text-brand-gray-500">{f.a}</p>
                      </motion.dd>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </section>
  );
}
