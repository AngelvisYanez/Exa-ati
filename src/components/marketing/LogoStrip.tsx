import {
  Building2,
  Calculator,
  CreditCard,
  FileCheck2,
  Landmark,
  MapPin,
  ShieldCheck,
  Store,
} from "lucide-react";

const ITEMS = [
  { icon: Landmark, label: "Comprobantes SRI" },
  { icon: CreditCard, label: "Pagos con PayPhone" },
  { icon: FileCheck2, label: "ATS y anexos" },
  { icon: Calculator, label: "Contadores" },
  { icon: Store, label: "Emprendedores" },
  { icon: Building2, label: "Despachos contables" },
  { icon: MapPin, label: "Quito · Guayaquil · Cuenca" },
  { icon: ShieldCheck, label: "Firma electrónica" },
];

export default function LogoStrip() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <section aria-label="Cobertura y confianza" className="py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gray-400">
          Pensado para operar y cumplir en Ecuador
        </p>
        <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <ul className="flex w-max gap-3 animate-marquee">
            {row.map((it, i) => (
              <li
                key={`${it.label}-${i}`}
                aria-hidden={i >= ITEMS.length}
                className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-brand-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-gray-600"
              >
                <it.icon className="size-4 text-brand-red" strokeWidth={2} />
                {it.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
