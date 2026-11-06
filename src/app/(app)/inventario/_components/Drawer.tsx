"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ENFOCABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  titulo: string;
  descripcion?: string;
  /** Contenido fijo bajo el encabezado (no se desplaza). */
  cabecera?: ReactNode;
  pie: ReactNode;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

export default function Drawer({ open, onClose, titulo, descripcion, cabecera, pie, children, initialFocusRef, className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previo = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      (initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>(ENFOCABLES))?.focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(ENFOCABLES));
      if (items.length === 0) return;
      const primero = items[0];
      const ultimo = items[items.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("overflow-hidden");
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("overflow-hidden");
      previo?.focus();
    };
  }, [open, initialFocusRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-[#1C1917]/45 animate-fade-in" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-titulo"
        aria-describedby={descripcion ? "drawer-descripcion" : undefined}
        className={cn(
          "relative flex h-dvh w-full max-w-[600px] flex-col bg-white text-pos-ink shadow-2xl animate-in slide-in-from-right duration-200",
          className,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-pos-line px-6 py-4">
          <div className="min-w-0">
            <h2 id="drawer-titulo" className="text-lg font-bold tracking-tight">{titulo}</h2>
            {descripcion && <p id="drawer-descripcion" className="mt-0.5 text-sm text-pos-muted">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-pos-muted transition-colors hover:bg-pos-bg hover:text-pos-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pos-brand/40"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        {cabecera}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
        <footer className="border-t border-pos-line bg-white px-6 py-4">{pie}</footer>
      </div>
    </div>,
    document.body,
  );
}
