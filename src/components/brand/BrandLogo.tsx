import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Variantes de marca:
 * - onLight → logo rojo + gris oscuro (fondos claros / blancos)
 * - onDark  → logo claro / plateado (fondos oscuros)
 */
const VARIANTS = {
  onLight: {
    src: "/exa-ati-on-light.png",
    width: 1024,
    height: 202,
  },
  onDark: {
    src: "/exa-ati-on-dark.png",
    width: 1024,
    height: 202,
  },
} as const;

export type BrandLogoVariant = keyof typeof VARIANTS;

type BrandLogoProps = {
  variant: BrandLogoVariant;
  className?: string;
  priority?: boolean;
  alt?: string;
};

export default function BrandLogo({
  variant,
  className,
  priority = false,
  alt = "exa — Asistente Tributario Inteligente",
}: BrandLogoProps) {
  const asset = VARIANTS[variant];
  return (
    <Image
      src={asset.src}
      alt={alt}
      width={asset.width}
      height={asset.height}
      priority={priority}
      className={cn("h-8 w-auto", className)}
    />
  );
}
