"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

function ResultadoContent() {
  const params = useSearchParams();
  const { refreshUserModules } = useAuth();
  const status = params.get("status") || "canceled";
  const plan = params.get("plan") || "";
  const periodo = params.get("periodo") || "";
  const message = params.get("message") || "";

  useEffect(() => {
    if (status === "aprobado") {
      void refreshUserModules();
    }
  }, [status, refreshUserModules]);

  const ok = status === "aprobado";
  const fail = status === "fallido";

  return (
    <Card className="p-8 max-w-lg mx-auto text-center flex flex-col items-center gap-4">
      {ok ? (
        <CheckCircle2 className="w-12 h-12 text-success" />
      ) : fail ? (
        <AlertTriangle className="w-12 h-12 text-amber-600" />
      ) : (
        <XCircle className="w-12 h-12 text-brand-red" />
      )}
      <div>
        <h1 className="text-lg font-bold text-brand-gray-900">
          {ok ? "Pago aprobado" : fail ? "No se pudo confirmar" : "Pago cancelado"}
        </h1>
        <p className="text-xs text-brand-gray-500 mt-2 leading-relaxed">
          {ok
            ? `Tu plan ${plan || ""} (${periodo || "mensual"}) quedó activo. Los módulos se actualizarán al instante.`
            : message || "Puedes intentar de nuevo desde la página de planes."}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href={ok ? "/panel" : "/suscripcion"}>
          <Button className="bg-brand-red hover:bg-brand-red-bright text-white">
            {ok ? "Ir al panel" : "Volver a suscripción"}
          </Button>
        </Link>
        <Link href="/configuracion">
          <Button variant="outline">Configuración</Button>
        </Link>
      </div>
    </Card>
  );
}

export default function BillingResultadoPage() {
  return (
    <>
      <title>Resultado del pago - OFSERCONT IA</title>
      <Topbar title="Resultado del pago" />
      <main className="ui-page flex-1">
        <Suspense
          fallback={
            <p className="text-center text-sm text-brand-gray-400 py-12">Cargando…</p>
          }
        >
          <ResultadoContent />
        </Suspense>
      </main>
    </>
  );
}
