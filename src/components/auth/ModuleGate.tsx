"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { ModuleCode } from "@/lib/modules-catalog";

interface ModuleGateProps {
  module: ModuleCode | string;
  children: ReactNode;
  /** Si true, SUPERADMIN siempre pasa (default true). */
  allowSuperadmin?: boolean;
}

/**
 * Protege páginas del cliente: redirige a / si el rol no tiene el módulo.
 */
export function ModuleGate({
  module,
  children,
  allowSuperadmin = true,
}: ModuleGateProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const allowed =
    !!user &&
    ((allowSuperadmin && user.rol === "SUPERADMIN") ||
      (user.modulos?.includes(module) ?? false) ||
      // Fallback legacy mientras cargan módulos
      (!user.modulos &&
        (user.rol === "ADMIN" || user.rol === "SUPERADMIN")));

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowed) {
      router.replace("/");
    }
  }, [isLoading, user, allowed, router]);

  if (isLoading || !user || !allowed) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-xs text-brand-gray-400">
        Verificando acceso…
      </div>
    );
  }

  return <>{children}</>;
}
