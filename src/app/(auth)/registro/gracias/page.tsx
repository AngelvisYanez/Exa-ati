"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Home } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";

const REDIRECT_SECONDS = 8;

function GraciasContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { refreshUserModules, isAuthenticated } = useAuth();
  const status = params.get("status") || "canceled";
  const plan = params.get("plan") || "";
  const periodo = params.get("periodo") || "";
  const orden = params.get("orden") || params.get("pagoId") || "";
  const message = params.get("message") || "";
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  const ok = status === "aprobado";
  const fail = status === "fallido";

  useEffect(() => {
    if (ok) {
      void refreshUserModules();
    }
  }, [ok, refreshUserModules]);

  useEffect(() => {
    if (!ok) return;
    if (seconds <= 0) {
      router.replace(isAuthenticated ? "/panel" : "/");
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [ok, seconds, router, isAuthenticated]);

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-brand-gray-200 p-8 flex flex-col items-center gap-5 text-center animate-fade-in-up max-w-lg mx-auto">
      <BrandLogo variant="onLight" className="h-8 w-auto" />

      {ok ? (
        <CheckCircle2 className="w-14 h-14 text-success" />
      ) : fail ? (
        <AlertTriangle className="w-14 h-14 text-amber-600" />
      ) : (
        <XCircle className="w-14 h-14 text-brand-red" />
      )}

      <div>
        <h1 className="text-xl font-extrabold text-brand-gray-900">
          {ok ? "¡Gracias por tu compra!" : fail ? "No se pudo confirmar" : "Pago cancelado"}
        </h1>
        <p className="text-sm text-brand-gray-500 mt-2 leading-relaxed">
          {ok
            ? `Tu plan ${plan || ""} (${periodo || "mensual"}) quedó activo.`
            : message || "Puedes intentar de nuevo desde el registro o la página de planes."}
        </p>
      </div>

      {orden ? (
        <div className="w-full rounded-xl border border-brand-gray-200 bg-brand-gray-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-400">
            Número de orden
          </p>
          <p className="text-sm font-mono font-bold text-brand-gray-800 mt-1 break-all">
            {orden}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 justify-center">
        {ok ? (
          <>
            <Link
              href="/panel"
              className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red-bright text-white text-sm font-bold px-4 py-2.5 rounded-lg"
            >
              Ir al panel
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 border border-brand-gray-200 text-brand-gray-700 text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-brand-gray-50"
            >
              <Home className="size-4" />
              Inicio
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red-bright text-white text-sm font-bold px-4 py-2.5 rounded-lg"
            >
              Volver al registro
            </Link>
            <Link
              href="/suscripcion"
              className="inline-flex items-center gap-2 border border-brand-gray-200 text-brand-gray-700 text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-brand-gray-50"
            >
              Ir a suscripción
            </Link>
          </>
        )}
      </div>

      {ok ? (
        <p className="text-[11px] text-brand-gray-400">
          Redirigiendo al {isAuthenticated ? "panel" : "inicio"} en {seconds}s…
        </p>
      ) : null}
    </div>
  );
}

export default function RegistroGraciasPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-2xl p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-brand-gray-400" />
        </div>
      }
    >
      <GraciasContent />
    </Suspense>
  );
}
