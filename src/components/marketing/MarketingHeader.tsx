"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Menu, Phone, X } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#servicios", label: "Servicios" },
  { href: "/#proceso", label: "Proceso" },
  { href: "/precios", label: "Precios" },
  { href: "/#contacto", label: "Contacto" },
];

export default function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 pointer-events-none">
      <div className="mx-auto max-w-7xl px-3 sm:px-5 pt-3 sm:pt-4">
        <motion.div
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "pointer-events-auto flex h-14 items-center justify-between gap-3 rounded-full border px-2.5 pl-4 sm:pl-5 transition-all duration-300",
            scrolled
              ? "border-brand-gray-200/80 bg-white/92 shadow-[0_8px_30px_-12px_rgba(26,26,24,0.25)] backdrop-blur-md"
              : "border-white/15 bg-white/90 shadow-[0_10px_40px_-14px_rgba(0,0,0,0.35)] backdrop-blur-md",
          )}
        >
          <Link href="/" className="flex items-center shrink-0" aria-label="EXA ATI — inicio">
            <BrandLogo
              variant="onLight"
              priority
              className="h-7 sm:h-8 w-auto"
            />
          </Link>

          <nav
            className="hidden lg:flex items-center gap-0.5 text-[13px] font-semibold"
            aria-label="Principal"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative px-3 py-1.5 rounded-full text-brand-gray-600 hover:text-brand-red hover:bg-brand-red-subtle transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/#contacto"
              className="hidden md:flex items-center gap-2 pr-2 text-left"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-red-subtle text-brand-red">
                <Phone className="size-4" strokeWidth={2.2} />
              </span>
              <span className="leading-tight">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-gray-400">
                  Habla con un asesor
                </span>
                <span className="block text-[12.5px] font-bold text-brand-gray-800">
                  Ecuador · en español
                </span>
              </span>
            </Link>
            <Link
              href="/iniciar-sesion"
              className="hidden sm:inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold text-brand-gray-700 hover:text-brand-red hover:bg-brand-red-subtle transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-red pl-4 pr-1.5 text-[13px] font-bold text-white hover:bg-brand-red-bright transition-colors"
            >
              Empezar
              <span className="flex size-6 items-center justify-center rounded-full bg-white text-brand-red transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRight className="size-3.5" strokeWidth={2.5} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              className="lg:hidden flex size-9 items-center justify-center rounded-full text-brand-gray-800 hover:bg-brand-gray-100 transition-colors cursor-pointer"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar menú"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="pointer-events-auto fixed inset-0 z-40 bg-brand-gray-900/40 backdrop-blur-sm lg:hidden cursor-default"
            />
            <motion.div
              id="mobile-nav"
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="pointer-events-auto relative z-50 mx-3 sm:mx-5 mt-2 rounded-3xl border border-brand-gray-200 bg-white p-3 shadow-2xl lg:hidden"
            >
              <nav aria-label="Principal móvil" className="flex flex-col">
                {NAV.map((item, i) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-semibold text-brand-gray-800 hover:bg-brand-red-subtle hover:text-brand-red transition-colors"
                    >
                      {item.label}
                      <ArrowUpRight className="size-4 text-brand-gray-300" />
                    </Link>
                  </motion.div>
                ))}
              </nav>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-brand-gray-100 pt-3">
                <Link
                  href="/iniciar-sesion"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-brand-gray-200 text-sm font-bold text-brand-gray-800"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/registro"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white"
                >
                  Crear cuenta
                </Link>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
