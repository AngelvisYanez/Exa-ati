"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  FilePlus,
  BookOpen,
  FileCheck,
  MessageSquare,
  ShoppingCart,
  Truck,
  Shield,
} from "lucide-react";

interface Module {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  bgColor: string;
}

const MODULES: Module[] = [
  {
    id: "documentos",
    title: "Documentos",
    description: "Gestiona y sincroniza tus comprobantes electrónicos con el SRI",
    icon: FileText,
    href: "/documentos",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    id: "emitir",
    title: "Emisión Rápida",
    description: "Emite facturas, retenciones, notas de crédito y débito al SRI",
    icon: FilePlus,
    href: "/emitir",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    id: "contabilidad",
    title: "Contabilidad",
    description: "Plan de cuentas, impuestos y posiciones fiscales",
    icon: BookOpen,
    href: "/contabilidad",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    id: "declaraciones",
    title: "Declaraciones",
    description: "Presenta IVA, ATS y formularios 103/104 ante el SRI",
    icon: FileCheck,
    href: "/declaraciones/presentar",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    id: "chat",
    title: "Asistente IA",
    description: "Consulta tus obligaciones tributarias con inteligencia artificial",
    icon: MessageSquare,
    href: "/chat",
    color: "text-brand-navy",
    bgColor: "bg-brand-navy/5",
  },
  {
    id: "ecommerce",
    title: "eCommerce",
    description: "Administra ventas online y facturación electrónica",
    icon: ShoppingCart,
    href: "/ecommerce",
    color: "text-sky-600",
    bgColor: "bg-sky-50",
  },
  {
    id: "guias",
    title: "Guías de Remisión",
    description: "Crea y gestiona guías de remisión para tus envíos",
    icon: Truck,
    href: "/guias-remision",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    id: "auditoria",
    title: "Auditoría IA",
    description: "Auditoría inteligente de comprobantes y riesgos fiscales",
    icon: Shield,
    href: "/auditoria",
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
];

export default function FeaturedModules() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const updateScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollPos(el.scrollLeft);
    setMaxScroll(el.scrollWidth - el.clientWidth);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScroll();
    el.addEventListener("scroll", updateScroll);
    window.addEventListener("resize", updateScroll);
    return () => {
      el.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    intervalRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const cardWidth = 230 + 12;
      const next = el.scrollLeft + cardWidth;
      if (next >= el.scrollWidth - el.clientWidth) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollTo({ left: next, behavior: "smooth" });
      }
    }, 4000);
    return () => clearInterval(intervalRef.current);
  }, [isAutoPlaying]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 230 + 12;
    el.scrollBy({ left: dir === "left" ? -cardWidth : cardWidth, behavior: "smooth" });
  };

  const atStart = scrollPos <= 0;
  const atEnd = scrollPos >= maxScroll - 1;

  const totalSlides = MODULES.length;
  const slideIndex = maxScroll > 0
    ? Math.round(scrollPos / (230 + 12))
    : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Módulos Destacados</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Acceso rápido a las principales funcionalidades del sistema.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            disabled={atStart}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={atEnd}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
          className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.id}
                href={mod.href}
                className="snap-start shrink-0 w-[230px] bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 group"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${mod.bgColor} flex items-center justify-center ${mod.color} group-hover:scale-110 transition-transform duration-200`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-sm font-bold text-slate-900">
                    {mod.title}
                  </span>
                  <span className="text-[11px] text-slate-500 leading-relaxed">
                    {mod.description}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-navy group-hover:gap-2 transition-all">
                  Ir al módulo
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>

        {!atStart && (
          <div className="absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        )}
        {!atEnd && (
          <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-4">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              el.scrollTo({
                left: i * (230 + 12),
                behavior: "smooth",
              });
            }}
            className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
              i === slideIndex ? "bg-brand-navy w-4" : "bg-slate-300 hover:bg-slate-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
