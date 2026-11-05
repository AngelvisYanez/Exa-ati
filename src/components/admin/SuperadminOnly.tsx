"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function SuperadminOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/iniciar-sesion");
      return;
    }
    if (user.rol !== "SUPERADMIN") router.replace("/panel");
  }, [isLoading, user, router]);

  if (isLoading || !user || user.rol !== "SUPERADMIN") {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-xs text-brand-gray-400">
        Verificando acceso…
      </div>
    );
  }

  return <>{children}</>;
}
