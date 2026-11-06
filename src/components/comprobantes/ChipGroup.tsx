import { cn } from "@/lib/utils";
import { chip } from "./tokens";

interface ChipGroupProps {
  ariaLabel: string;
  opciones: readonly { value: string; label: string }[];
  valor: string;
  onChange: (value: string) => void;
}

export default function ChipGroup({ ariaLabel, opciones, valor, onChange }: ChipGroupProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {opciones.map((opcion) => {
        const activo = valor === opcion.value;
        return (
          <button
            key={opcion.value}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(opcion.value)}
            className={cn(chip.base, activo ? chip.activo : cn(chip.inactivo, "hover:bg-brand-gray-50"))}
          >
            {opcion.label}
          </button>
        );
      })}
    </div>
  );
}
