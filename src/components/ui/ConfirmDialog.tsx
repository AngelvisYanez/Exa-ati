"use client";

import Dialog from "./Dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      closeOnOverlay={!loading}
      showClose={!loading}
    >
      <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-brand-gray-100 hover:bg-brand-gray-200 text-brand-gray-700 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 ${
            variant === "danger"
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-brand-navy hover:bg-brand-navy-light text-white"
          }`}
        >
          {loading ? "Procesando..." : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
