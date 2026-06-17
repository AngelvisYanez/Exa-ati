"use client";

import type { ToastItem } from "@/contexts/ToastContext";

const variantStyles: Record<ToastItem["variant"], string> = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info: "bg-sky-50 border-sky-200 text-sky-800",
};

const variantIcons: Record<ToastItem["variant"], string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export default function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-2.5 border rounded-xl px-4 py-3 shadow-lg animate-fade-in text-sm font-medium ${variantStyles[item.variant]}`}
    >
      <span className="shrink-0 w-5 h-5 flex items-center justify-center text-xs font-bold rounded-full bg-white/60">
        {variantIcons[item.variant]}
      </span>
      <p className="flex-1 leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer text-xs"
        aria-label="Cerrar notificación"
      >
        ✕
      </button>
    </div>
  );
}
