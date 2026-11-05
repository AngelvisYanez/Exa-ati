"use client";

import { Loader2 } from "lucide-react";
import Dialog from "./Dialog";
import { Button } from "./button";

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
      <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      <div className="flex gap-2 mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={variant === "danger" ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={loading}
          className="flex-1"
        >
          {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {loading ? "Procesando..." : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
