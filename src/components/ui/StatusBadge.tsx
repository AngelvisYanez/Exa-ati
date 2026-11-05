import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  AUTORIZADO: { bg: "bg-success-pale/80", text: "text-success", border: "border-success-light/40", dot: "bg-success" },
  PROCESADO: { bg: "bg-success-pale/80", text: "text-success", border: "border-success-light/40", dot: "bg-success" },
  EN_PROCESO: { bg: "bg-brand-amber-pale/80", text: "text-amber-800", border: "border-brand-amber/30", dot: "bg-brand-amber" },
  PPR: { bg: "bg-brand-amber-pale/80", text: "text-amber-800", border: "border-brand-amber/30", dot: "bg-brand-amber" },
  DUPLICADO: { bg: "bg-brand-gray-100/80", text: "text-brand-gray-700", border: "border-brand-gray-200", dot: "bg-brand-gray-500" },
  DOCUMENTO_INVALIDO: { bg: "bg-brand-red-subtle/80", text: "text-brand-red", border: "border-brand-red-pale", dot: "bg-brand-red" },
  TIMEOUT_SRI: { bg: "bg-brand-amber-pale/80", text: "text-amber-800", border: "border-brand-amber/30", dot: "bg-brand-amber" },
  RECHAZADO: { bg: "bg-brand-red-subtle/80", text: "text-brand-red", border: "border-brand-red-pale", dot: "bg-brand-red" },
  FIRMADO: { bg: "bg-sky-50/80", text: "text-brand-sky", border: "border-sky-200", dot: "bg-brand-sky" },
  PENDIENTE: { bg: "bg-brand-gray-100/70", text: "text-brand-gray-700", border: "border-brand-gray-200", dot: "bg-brand-gray-400" },
}

const STATUS_LABELS: Record<string, string> = {
  PPR: "EN PROCESO",
  DOCUMENTO_INVALIDO: "DOC. INVÁLIDO",
  TIMEOUT_SRI: "TIMEOUT SRI",
}

export function statusClass(estado: string): string {
  const style = STATUS_STYLES[estado] ?? STATUS_STYLES.PENDIENTE
  return `${style.bg} ${style.text} ${style.border}`
}

export function statusLabel(estado: string): string {
  return STATUS_LABELS[estado] ?? estado
}

function StatusBadge({ estado, className }: { estado: string; className?: string }) {
  const style = STATUS_STYLES[estado] ?? STATUS_STYLES.PENDIENTE
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[10.5px] font-bold border transition-colors",
        style.bg,
        style.text,
        style.border,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
      {statusLabel(estado)}
    </span>
  )
}

export { StatusBadge }
