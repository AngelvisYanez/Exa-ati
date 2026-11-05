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
  HandCoins,
  Package,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Module {
  id: string;
  moduleCode: string;
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
    moduleCode: "documentos",
    title: "Documentos",
    description: "Consulta y organiza tus comprobantes electrónicos",
    icon: FileText,
    href: "/documentos",
    color: "text-brand-sky",
    bgColor: "bg-sky-50",
  },
  {
    id: "emitir",
    moduleCode: "emitir",
    title: "Emitir",
    description: "Facturas, retenciones y notas en minutos",
    icon: FilePlus,
    href: "/emitir",
    color: "text-success",
    bgColor: "bg-success-pale",
  },
  {
    id: "cxc",
    moduleCode: "cuentas-por-cobrar",
    title: "Cuentas por Cobrar",
    description: "Quién te debe y qué está por vencer",
    icon: HandCoins,
    href: "/cuentas-por-cobrar",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
  },
  {
    id: "inventario",
    moduleCode: "inventario",
    title: "Inventario",
    description: "Stock y productos para facturar",
    icon: Package,
    href: "/inventario",
    color: "text-brand-gray-700",
    bgColor: "bg-brand-gray-100",
  },
  {
    id: "contabilidad",
    moduleCode: "contabilidad",
    title: "Contabilidad",
    description: "Plan de cuentas, impuestos y posiciones fiscales",
    icon: BookOpen,
    href: "/contabilidad",
    color: "text-brand-sky",
    bgColor: "bg-sky-50",
  },
  {
    id: "declaraciones",
    moduleCode: "declaraciones",
    title: "Declaraciones",
    description: "Presenta IVA, ATS y formularios 103/104 ante el SRI",
    icon: FileCheck,
    href: "/declaraciones/presentar",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    id: "chat",
    moduleCode: "chat",
    title: "Asistente IA",
    description: "Pregunta por ventas, cobros u obligaciones",
    icon: MessageSquare,
    href: "/asistente",
    color: "text-brand-red",
    bgColor: "bg-brand-red-subtle",
  },
  {
    id: "ecommerce",
    moduleCode: "ecommerce",
    title: "eCommerce",
    description: "Ventas online con facturación electrónica",
    icon: ShoppingCart,
    href: "/comercio",
    color: "text-sky-600",
    bgColor: "bg-sky-50",
  },
  {
    id: "guias",
    moduleCode: "guias-remision",
    title: "Guías de Remisión",
    description: "Crea y gestiona guías para tus envíos",
    icon: Truck,
    href: "/guias-remision",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    id: "auditoria",
    moduleCode: "auditoria-ia",
    title: "Auditoría IA",
    description: "Riesgos fiscales en tus comprobantes",
    icon: Shield,
    href: "/auditoria",
    color: "text-brand-red",
    bgColor: "bg-brand-red-subtle",
  },
];

export default function FeaturedModules() {
  const { hasModule, user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const visible = MODULES.filter((m) => hasModule(m.moduleCode));
  const isEmprendedor = (user?.planCodigo || "emprendedor") === "emprendedor";

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
  }, [visible.length]);

  useEffect(() => {
    if (!isAutoPlaying || visible.length <= 1) return;
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
  }, [isAutoPlaying, visible.length]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 230 + 12;
    el.scrollBy({ left: dir === "left" ? -cardWidth : cardWidth, behavior: "smooth" });
  };

  const atStart = scrollPos <= 0;
  const atEnd = scrollPos >= maxScroll - 1;
  const totalSlides = visible.length;
  const slideIndex = maxScroll > 0 ? Math.round(scrollPos / (230 + 12)) : 0;

  if (visible.length === 0) return null;

  return (
    <div className="bg-white border border-brand-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {isEmprendedor ? "Atajos de tu negocio" : "Módulos destacados"}
          </h3>
          <p className="text-xs text-brand-gray-500 mt-0.5">
            {isEmprendedor
              ? "Factura, cobra y consulta tu actividad del día."
              : "Acceso rápido según tu plan y permisos."}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scroll("left")}
            disabled={atStart}
            aria-label="Anterior"
            className="w-8 h-8 rounded-lg border border-brand-gray-200 flex items-center justify-center text-brand-gray-500 hover:bg-brand-gray-50 hover:text-brand-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            disabled={atEnd}
            aria-label="Siguiente"
            className="w-8 h-8 rounded-lg border border-brand-gray-200 flex items-center justify-center text-brand-gray-500 hover:bg-brand-gray-50 hover:text-brand-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
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
          {visible.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.id}
                href={mod.href}
                className="snap-start shrink-0 w-[230px] bg-brand-gray-50 hover:bg-white border border-brand-gray-200 hover:border-brand-gray-300 rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 group"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${mod.bgColor} flex items-center justify-center ${mod.color} group-hover:scale-110 transition-transform duration-200`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-sm font-bold text-brand-gray-900">{mod.title}</span>
                  <span className="text-[11px] text-brand-gray-500 leading-relaxed">
                    {mod.description}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-red group-hover:gap-2 transition-all">
                  Ir
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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

      {totalSlides > 1 ? (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir al módulo ${i + 1}`}
              onClick={() => {
                const el = scrollRef.current;
                if (!el) return;
                el.scrollTo({ left: i * (230 + 12), behavior: "smooth" });
              }}
              className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                i === slideIndex ? "bg-brand-red w-4" : "bg-brand-gray-300 hover:bg-brand-gray-400"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
