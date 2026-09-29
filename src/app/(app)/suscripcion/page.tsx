"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { Check, CreditCard, Loader2 } from "lucide-react";

interface PlanCard {
  codigo: string;
  nombre: string;
  descripcion: string;
  maxEmpresas: number;
  precioMensual: number;
  precioAnual: number | null;
  moneda: string;
  modulosCount: number;
}

function money(n: number, moneda = "USD") {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(n);
}

function SuscripcionContent() {
  const searchParams = useSearchParams();
  const { user, refreshUserModules } = useAuth();
  const [configured, setConfigured] = useState(false);
  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"mensual" | "anual">(
    searchParams.get("periodo") === "anual" ? "anual" : "mensual"
  );
  const [paying, setPaying] = useState<string | null>(null);
  const preselect = searchParams.get("plan") || "";
  const motivo = searchParams.get("motivo");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch("/api/billing/payphone/prepare");
        const data = await res.json();
        setConfigured(Boolean(data.configured));
        setPlans(data.plans || []);
      } catch {
        toast.error("No se pudieron cargar los planes");
      } finally {
        setLoading(false);
      }
    };
    load();
    void refreshUserModules();
  }, [refreshUserModules]);

  const handlePay = async (planCodigo: string) => {
    setPaying(planCodigo);
    try {
      const res = await apiFetch("/api/billing/payphone/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCodigo, periodo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al preparar el pago");

      const url = data.data?.payWithCard || data.data?.payWithPayPhone;
      if (!url) throw new Error("PayPhone no devolvió URL de pago");

      window.location.href = url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar pago");
      setPaying(null);
    }
  };

  return (
    <main className="ui-page flex-1 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">
          Elige tu plan
        </h1>
        <p className="text-xs text-brand-gray-500 mt-1">
          Pago seguro con PayPhone (tarjeta o saldo). Plan actual:{" "}
          <strong>{user?.planNombre || user?.planCodigo || "—"}</strong>
          {typeof user?.maxEmpresas === "number"
            ? ` · hasta ${user.maxEmpresas} empresa(s)`
            : ""}
          {user?.planVigenteHasta
            ? ` · vigente hasta ${new Date(user.planVigenteHasta).toLocaleDateString("es-EC")}`
            : ""}
        </p>
        {motivo === "vencido" ? (
          <p className="mt-2 text-xs font-semibold text-brand-red bg-brand-red-subtle border border-brand-red-pale rounded-lg px-3 py-2">
            Tu suscripción venció. Elige un plan y paga para recuperar el acceso.
          </p>
        ) : null}
        {motivo === "pendiente" ? (
          <p className="mt-2 text-xs font-semibold text-brand-red bg-brand-red-subtle border border-brand-red-pale rounded-lg px-3 py-2">
            Completa el pago de tu plan para activar el panel. Sin cobro aprobado no hay acceso operativo.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => setPeriodo("mensual")}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
            periodo === "mensual"
              ? "bg-brand-red text-white border-brand-red"
              : "bg-white text-brand-gray-600 border-brand-gray-200"
          }`}
        >
          Mensual
        </button>
        <button
          type="button"
          onClick={() => setPeriodo("anual")}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
            periodo === "anual"
              ? "bg-brand-red text-white border-brand-red"
              : "bg-white text-brand-gray-600 border-brand-gray-200"
          }`}
        >
          Anual
        </button>
      </div>

      {!configured && !loading ? (
        <Card className="p-4 mb-6 border-amber-200 bg-amber-50 text-xs text-amber-900">
          PayPhone aún no está configurado en este entorno. Un administrador debe
          definir PAYPHONE_TOKEN y PAYPHONE_STORE_ID.
        </Card>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16 text-brand-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const price =
              periodo === "anual"
                ? Number(plan.precioAnual ?? plan.precioMensual * 10)
                : Number(plan.precioMensual);
            const current = user?.planCodigo === plan.codigo;
            const highlight = preselect === plan.codigo || current;

            return (
              <Card
                key={plan.codigo}
                className={`p-5 flex flex-col gap-3 ${
                  highlight ? "ring-2 ring-brand-red border-brand-red" : ""
                }`}
              >
                <div>
                  <h2 className="font-bold text-brand-gray-900">{plan.nombre}</h2>
                  <p className="text-[11px] text-brand-gray-500 mt-1 leading-relaxed">
                    {plan.descripcion}
                  </p>
                </div>
                <p className="text-2xl font-extrabold tabular-nums">
                  {money(price, plan.moneda)}
                  <span className="text-xs font-semibold text-brand-gray-400">
                    /{periodo === "anual" ? "año" : "mes"}
                  </span>
                </p>
                <ul className="text-[11px] text-brand-gray-600 space-y-1 flex-1">
                  <li className="flex gap-1.5">
                    <Check className="size-3.5 text-brand-red shrink-0" />
                    Hasta {plan.maxEmpresas} empresa(s)
                  </li>
                  <li className="flex gap-1.5">
                    <Check className="size-3.5 text-brand-red shrink-0" />
                    {plan.modulosCount} módulos incluidos
                  </li>
                </ul>
                <Button
                  disabled={!configured || paying !== null}
                  onClick={() => handlePay(plan.codigo)}
                  className="w-full bg-brand-red hover:bg-brand-red-bright text-white"
                >
                  {paying === plan.codigo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-1.5" />
                      {current ? "Renovar / pagar" : "Suscribirme"}
                    </>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default function SuscripcionPage() {
  return (
    <>
      <title>Suscripción - EXA ATI</title>
      <Topbar title="Suscripción" />
      <Suspense
        fallback={
          <main className="ui-page flex-1 flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand-gray-400" />
          </main>
        }
      >
        <SuscripcionContent />
      </Suspense>
    </>
  );
}
