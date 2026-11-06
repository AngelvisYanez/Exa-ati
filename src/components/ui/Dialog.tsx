"use client";

import { useEffect, useRef, useCallback, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  closeOnOverlay?: boolean;
  showClose?: boolean;
  /** Elemento que recibe el foco al abrir; por defecto, el primero enfocable. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  panelClassName?: string;
}

const sizeClasses: Record<string, string> = {
  sm: "max-w-[calc(100vw-32px)] sm:max-w-sm",
  md: "max-w-[calc(100vw-32px)] sm:max-w-md",
  lg: "max-w-[calc(100vw-32px)] sm:max-w-lg",
  xl: "max-w-[calc(100vw-32px)] lg:max-w-4xl",
  "2xl": "max-w-[calc(100vw-32px)] lg:max-w-6xl",
};

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeOnOverlay = true,
  showClose = true,
  initialFocusRef,
  panelClassName = "",
}: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const descId = description ? "dialog-description" : undefined;

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const focusTrap = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => {
      const target =
        initialFocusRef?.current ??
        dialogRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
      target?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current?.();
      focusTrap(e);
    };
    document.addEventListener("keydown", handleKey);
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.classList.remove("overflow-hidden");
      // Solo al cerrar. Si esto dependiera de onClose, cada tecla
      // recrearía el callback, rerenderizaría el diálogo y devolvería
      // el foco al botón que lo abrió.
      previousFocusRef.current?.focus();
    };
  }, [open, focusTrap]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-brand-red/55 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in"
      onClick={(e) => {
        if (closeOnOverlay && e.target === overlayRef.current && onClose) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={descId}
    >
      <div
        ref={dialogRef}
        className={`bg-card border border-border rounded-2xl shadow-2xl w-full ${sizeClasses[size]} flex flex-col gap-4 text-left animate-scale-in ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!title && !showClose && (
          <h3 id="dialog-title" className="sr-only">
            Diálogo
          </h3>
        )}
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-3 p-6 pb-0">
            <div>
              {title ? (
                <h3 id="dialog-title" className="text-base font-extrabold text-foreground leading-none">
                  {title}
                </h3>
              ) : (
                <h3 id="dialog-title" className="sr-only">
                  Diálogo
                </h3>
              )}
              {description && (
                <p id={descId} className="text-[11px] text-muted-foreground mt-2">
                  {description}
                </p>
              )}
            </div>
            {showClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                aria-label="Cerrar diálogo"
              >
                <span aria-hidden>✕</span>
              </button>
            )}
          </div>
        )}
        <div className={title || showClose ? "px-6 pb-6" : "p-6"}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
