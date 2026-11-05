"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle } from "lucide-react";
import {
  isPathAllowedWhenVencido,
  isPlanBlocked,
} from "@/lib/subscription-access";

/**
 * Banner + redirect cuando el plan está vencido o pendiente de pago.
 */
export default function SubscriptionGate() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname() || "/panel";
  const router = useRouter();

  const pendiente = user?.rol !== "SUPERADMIN" && user?.planEstado === "pendiente";

  const vencido =
    user?.rol !== "SUPERADMIN" &&
    user?.planOrigen === "payphone" &&
    (user?.planEstado === "vencido" ||
      (typeof user?.daysRemaining === "number" && user.daysRemaining < 0));

  const bloqueado = pendiente || vencido;

  const porVencer =
    !bloqueado &&
    user?.planOrigen === "payphone" &&
    typeof user?.daysRemaining === "number" &&
    user.daysRemaining >= 0 &&
    user.daysRemaining <= 7;

  useEffect(() => {
    if (isLoading || !bloqueado) return;
    if (!isPathAllowedWhenVencido(pathname)) {
      router.replace(
        pendiente ? "/suscripcion?motivo=pendiente" : "/suscripcion?motivo=vencido"
      );
    }
  }, [isLoading, bloqueado, pendiente, pathname, router]);

  if (isLoading || (!bloqueado && !porVencer)) return null;

  // Evita banner en el propio flujo de registro/pago
  if (pathname.startsWith("/registro")) return null;

  return (
    <div
      className={`px-4 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${
        bloqueado
          ? "bg-brand-red text-white"
          : "bg-brand-amber-pale text-brand-gray-800 border-b border-brand-amber/40"
      }`}
      role="status"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="size-3.5 shrink-0" />
        {pendiente
          ? "Completa el pago de tu plan para activar el panel."
          : vencido
            ? "Tu suscripción venció. Renueva para recuperar el acceso completo."
            : `Tu suscripción vence en ${user?.daysRemaining} día(s).`}
      </span>
      <Link
        href="/suscripcion"
        className={`underline underline-offset-2 font-bold ${
          bloqueado ? "text-white" : "text-brand-red"
        }`}
      >
        {pendiente ? "Pagar ahora" : "Renovar ahora"}
      </Link>
    </div>
  );
}

// re-export helper for callers that imported from this file historically
export { isPlanBlocked };
