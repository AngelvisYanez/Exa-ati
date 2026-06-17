"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
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
}: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-brand-navy/55 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in p-4"
      onClick={(e) => {
        if (closeOnOverlay && e.target === overlayRef.current && onClose) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
    >
      <div
        className={`bg-white border border-brand-gray-200 rounded-2xl shadow-2xl w-full ${sizeClasses[size]} flex flex-col gap-4 text-left max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-3 p-6 pb-0">
            <div>
              {title && (
                <h3 id="dialog-title" className="text-base font-extrabold text-brand-navy leading-none">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-[11px] text-brand-gray-400 mt-2">{description}</p>
              )}
            </div>
            {showClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                ✕
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
