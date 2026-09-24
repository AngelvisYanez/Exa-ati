"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuthToken } from "@/lib/sriClient";
import { apiFetch } from "@/lib/apiFetch";

function MobileRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const legacyToken = searchParams.get("token");

    if (code) {
      (async () => {
        try {
          const res = await apiFetch("/api/sri/mobile-exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.message || "Código inválido o expirado");
            return;
          }
          const token = data.accessToken || data.token;
          if (token) setAuthToken(token);
          router.replace("/configuracion?tab=integraciones&logged=1");
        } catch {
          setError("No se pudo vincular la sesión móvil");
        }
      })();
      return;
    }

    if (legacyToken) {
      setAuthToken(legacyToken);
      router.replace("/configuracion?tab=integraciones&logged=1");
      return;
    }

    router.replace("/configuracion?tab=integraciones");
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gray-50">
      <div className="text-center px-6">
        {error ? (
          <p className="text-sm text-brand-red">{error}</p>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-brand-gray-500">Vinculando sesión móvil…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function MobileRedirectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-brand-gray-50 text-sm text-brand-gray-500">
        Cargando…
      </div>
    }>
      <MobileRedirectContent />
    </Suspense>
  );
}
