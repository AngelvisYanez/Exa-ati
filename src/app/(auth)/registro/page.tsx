"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { registerSchema, type RegisterInput } from "@/lib/schemas/auth";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Building2,
  Phone,
  MapPin,
  Check,
  CreditCard,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import BrandLogo from "@/components/brand/BrandLogo";
import { apiFetch } from "@/lib/apiFetch";
import { FALLBACK_PLANS, SYSTEM_PLAN_CODES } from "@/lib/plans";
import { sriClient } from "@/lib/sriClient";

type Step = 1 | 2 | 3;

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

function fallbackPlans(): PlanCard[] {
  return SYSTEM_PLAN_CODES.map((c) => {
    const p = FALLBACK_PLANS[c];
    return {
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      maxEmpresas: p.maxEmpresas,
      precioMensual: p.precioMensual,
      precioAnual: p.precioAnual,
      moneda: p.moneda,
      modulosCount: p.modulos.length,
    };
  });
}

const STEPS = [
  { n: 1 as const, label: "Plan" },
  { n: 2 as const, label: "Datos" },
  { n: 3 as const, label: "Pago" },
];

function RegisterWizard() {
  const searchParams = useSearchParams();
  const { login, refreshUserModules } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [periodo, setPeriodo] = useState<"mensual" | "anual">(
    searchParams.get("periodo") === "anual" ? "anual" : "mensual"
  );
  const [planCodigo, setPlanCodigo] = useState(
    searchParams.get("plan") || "emprendedor"
  );
  const [plans, setPlans] = useState<PlanCard[]>(fallbackPlans);
  const [payConfigured, setPayConfigured] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [paying, setPaying] = useState<"card" | "payphone" | null>(null);
  const [checkout, setCheckout] = useState<{
    payWithCard: string;
    payWithPayPhone: string;
    pagoId: string;
    amount: number;
  } | null>(null);
  const [creating, setCreating] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      nombre: "",
      email: "",
      password: "",
      confirmPassword: "",
      razonSocial: "",
      ruc: "",
      telefono: "",
      ciudad: "",
      planCodigo: searchParams.get("plan") || "emprendedor",
      periodo: searchParams.get("periodo") === "anual" ? "anual" : "mensual",
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/billing/payphone/prepare");
        const data = await res.json();
        setPayConfigured(Boolean(data.configured));
        if (Array.isArray(data.plans) && data.plans.length > 0) {
          setPlans(data.plans);
        }
      } catch {
        /* fallback estático */
      } finally {
        setLoadingPlans(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    setValue("planCodigo", planCodigo);
    setValue("periodo", periodo);
  }, [planCodigo, periodo, setValue]);

  const selectedPlan = plans.find((p) => p.codigo === planCodigo) || plans[0];
  const price = selectedPlan
    ? periodo === "anual"
      ? Number(selectedPlan.precioAnual ?? selectedPlan.precioMensual * 10)
      : Number(selectedPlan.precioMensual)
    : 0;

  const goPlanNext = () => {
    if (!planCodigo) {
      toast.error("Selecciona un plan");
      return;
    }
    setStep(2);
  };

  const onDatosSubmit = async (values: RegisterInput) => {
    setError("");
    setCreating(true);
    try {
      await sriClient.register(values.email, values.password, "USER", values.nombre, {
        razonSocial: values.razonSocial,
        ruc: values.ruc || undefined,
        telefono: values.telefono || undefined,
        ciudad: values.ciudad || undefined,
        planCodigo: values.planCodigo || planCodigo,
        periodo: values.periodo || periodo,
      });
      await login(values.email, values.password);
      await refreshUserModules();

      if (!payConfigured) {
        setError(
          "PayPhone no está configurado. Un administrador debe activar el cobro. Tu cuenta quedó creada en estado pendiente."
        );
        setStep(3);
        setCreating(false);
        return;
      }

      const res = await apiFetch("/api/billing/payphone/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCodigo: values.planCodigo || planCodigo,
          periodo: values.periodo || periodo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al preparar el pago");

      setCheckout({
        payWithCard: data.data.payWithCard,
        payWithPayPhone: data.data.payWithPayPhone,
        pagoId: data.data.pagoId,
        amount: data.data.amount,
      });
      setStep(3);
      toast.success("Cuenta creada. Elige cómo pagar.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrarse";
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const startPay = (kind: "card" | "payphone") => {
    if (!checkout) return;
    const url = kind === "card" ? checkout.payWithCard : checkout.payWithPayPhone;
    if (!url) {
      toast.error("URL de pago no disponible");
      return;
    }
    setPaying(kind);
    window.location.href = url;
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-brand-gray-200 p-6 sm:p-8 flex flex-col gap-6 animate-fade-in-up">
      <div className="text-center flex flex-col items-center gap-3">
        <BrandLogo variant="onLight" priority className="h-9 w-auto" />
        <div>
          <h1 className="text-xl font-extrabold text-brand-gray-800">Crear cuenta</h1>
          <p className="text-sm text-brand-gray-500 mt-1">
            Plan → datos → pago. Activamos tu panel al confirmar el cobro.
          </p>
        </div>
      </div>

      <ol className="flex items-center justify-between gap-1 sm:gap-2" aria-label="Pasos del registro">
        {STEPS.map((s, i) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <li key={s.n} className="flex-1 flex items-center gap-1 sm:gap-2 min-w-0">
              <div
                className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${
                  active || done ? "text-brand-red" : "text-brand-gray-400"
                }`}
              >
                <span
                  className={`size-7 shrink-0 rounded-full text-xs font-bold flex items-center justify-center border ${
                    done
                      ? "bg-brand-red text-white border-brand-red"
                      : active
                        ? "bg-brand-red/10 text-brand-red border-brand-red"
                        : "bg-brand-gray-50 border-brand-gray-200"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : s.n}
                </span>
                <span className="text-[11px] sm:text-xs font-bold truncate">{s.label}</span>
              </div>
              {i < STEPS.length - 1 ? (
                <div
                  className={`h-px flex-1 ${done ? "bg-brand-red" : "bg-brand-gray-200"}`}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {error ? (
        <div
          role="alert"
          className="bg-brand-red-subtle border border-brand-red-pale rounded-lg p-3 text-xs text-brand-red font-semibold animate-slide-down flex items-center gap-2"
        >
          <div className="size-1.5 rounded-full bg-brand-red shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            {(["mensual", "anual"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                  periodo === p
                    ? "bg-brand-red text-white border-brand-red"
                    : "bg-white text-brand-gray-600 border-brand-gray-200"
                }`}
              >
                {p === "mensual" ? "Mensual" : "Anual"}
              </button>
            ))}
          </div>

          {loadingPlans ? (
            <div className="flex justify-center py-10 text-brand-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {plans.map((plan) => {
                const p =
                  periodo === "anual"
                    ? Number(plan.precioAnual ?? plan.precioMensual * 10)
                    : Number(plan.precioMensual);
                const selected = planCodigo === plan.codigo;
                return (
                  <button
                    key={plan.codigo}
                    type="button"
                    onClick={() => setPlanCodigo(plan.codigo)}
                    className={`text-left rounded-xl border p-4 flex flex-col gap-2 cursor-pointer transition-all ${
                      selected
                        ? "ring-2 ring-brand-red border-brand-red bg-brand-red/[0.03]"
                        : "border-brand-gray-200 hover:border-brand-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-bold text-sm text-brand-gray-900">{plan.nombre}</h2>
                      {selected ? <Check className="size-4 text-brand-red shrink-0" /> : null}
                    </div>
                    <p className="text-[11px] text-brand-gray-500 leading-relaxed line-clamp-3">
                      {plan.descripcion}
                    </p>
                    <p className="text-lg font-extrabold tabular-nums mt-auto">
                      {money(p, plan.moneda)}
                      <span className="text-[10px] font-semibold text-brand-gray-400">
                        /{periodo === "anual" ? "año" : "mes"}
                      </span>
                    </p>
                    <p className="text-[10px] text-brand-gray-500">
                      Hasta {plan.maxEmpresas} empresa(s) · {plan.modulosCount} módulos
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={goPlanNext}
            className="w-full bg-gradient-to-r from-brand-red to-brand-red-mid hover:from-brand-red-mid hover:to-brand-red-bright text-white py-2.5 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2 mt-1"
          >
            Continuar
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <form onSubmit={handleSubmit(onDatosSubmit)} className="flex flex-col gap-4" noValidate>
          <p className="text-xs text-brand-gray-500">
            Plan elegido:{" "}
            <strong className="text-brand-gray-800">
              {selectedPlan?.nombre} · {money(price, selectedPlan?.moneda)}/
              {periodo === "anual" ? "año" : "mes"}
            </strong>
          </p>

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.nombre || undefined}>
                <FieldLabel htmlFor="register-nombre">Nombre completo</FieldLabel>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400" aria-hidden />
                  <input
                    id="register-nombre"
                    type="text"
                    autoComplete="name"
                    className="w-full pl-9 pr-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/15"
                    placeholder="Tu nombre"
                    {...register("nombre")}
                  />
                </div>
                <FieldError errors={[errors.nombre]} />
              </Field>

              <Field data-invalid={!!errors.email || undefined}>
                <FieldLabel htmlFor="register-email">Correo electrónico</FieldLabel>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400" aria-hidden />
                  <input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    className="w-full pl-9 pr-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/15"
                    placeholder="tu@email.com"
                    {...register("email")}
                  />
                </div>
                <FieldError errors={[errors.email]} />
              </Field>
            </div>

            <Field data-invalid={!!errors.razonSocial || undefined}>
              <FieldLabel htmlFor="register-empresa">Razón social / empresa</FieldLabel>
              <div className="relative group">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400" aria-hidden />
                <input
                  id="register-empresa"
                  type="text"
                  className="w-full pl-9 pr-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/15"
                  placeholder="Nombre de tu negocio"
                  {...register("razonSocial")}
                />
              </div>
              <FieldError errors={[errors.razonSocial]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={!!errors.ruc || undefined}>
                <FieldLabel htmlFor="register-ruc">RUC (opcional)</FieldLabel>
                <input
                  id="register-ruc"
                  type="text"
                  inputMode="numeric"
                  className="w-full px-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/15"
                  placeholder="13 dígitos"
                  {...register("ruc")}
                />
                <FieldError errors={[errors.ruc]} />
              </Field>
              <Field data-invalid={!!errors.telefono || undefined}>
                <FieldLabel htmlFor="register-tel">Teléfono</FieldLabel>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400" aria-hidden />
                  <input
                    id="register-tel"
                    type="tel"
                    className="w-full pl-9 pr-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/15"
                    placeholder="09xxxxxxxx"
                    {...register("telefono")}
                  />
                </div>
                <FieldError errors={[errors.telefono]} />
              </Field>
              <Field data-invalid={!!errors.ciudad || undefined}>
                <FieldLabel htmlFor="register-ciudad">Ciudad</FieldLabel>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400" aria-hidden />
                  <input
                    id="register-ciudad"
                    type="text"
                    className="w-full pl-9 pr-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/15"
                    placeholder="Quito"
                    {...register("ciudad")}
                  />
                </div>
                <FieldError errors={[errors.ciudad]} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.password || undefined}>
                <FieldLabel htmlFor="register-password">Contraseña</FieldLabel>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400" aria-hidden />
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/15"
                    placeholder="Mínimo 6 caracteres"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-gray-400 hover:text-brand-gray-600 cursor-pointer"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <FieldError errors={[errors.password]} />
              </Field>
              <Field data-invalid={!!errors.confirmPassword || undefined}>
                <FieldLabel htmlFor="register-confirm">Confirmar contraseña</FieldLabel>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400" aria-hidden />
                  <input
                    id="register-confirm"
                    type="password"
                    autoComplete="new-password"
                    className="w-full pl-9 pr-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/15"
                    placeholder="Repite tu contraseña"
                    {...register("confirmPassword")}
                  />
                </div>
                <FieldError errors={[errors.confirmPassword]} />
              </Field>
            </div>
          </FieldGroup>

          <input type="hidden" {...register("planCodigo")} />
          <input type="hidden" {...register("periodo")} />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-lg text-sm font-bold border border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="size-4" />
              Atrás
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 bg-gradient-to-r from-brand-red to-brand-red-mid text-white py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creando cuenta…
                </>
              ) : (
                <>
                  Continuar al pago
                  <ChevronRight className="size-4" />
                </>
              )}
            </button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-brand-gray-200 bg-brand-gray-50 p-4 text-sm">
            <p className="font-bold text-brand-gray-800">Resumen</p>
            <p className="text-xs text-brand-gray-500 mt-1">
              {selectedPlan?.nombre} · {periodo} ·{" "}
              {checkout
                ? money(checkout.amount, selectedPlan?.moneda)
                : money(price, selectedPlan?.moneda)}
            </p>
            {checkout?.pagoId ? (
              <p className="text-[11px] text-brand-gray-400 mt-2 font-mono">
                Orden pendiente: {checkout.pagoId}
              </p>
            ) : null}
          </div>

          {!payConfigured || !checkout ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              No hay métodos de pago disponibles todavía. Vuelve a{" "}
              <Link href="/suscripcion" className="font-bold underline">
                Suscripción
              </Link>{" "}
              cuando PayPhone esté configurado.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={paying !== null}
                onClick={() => startPay("card")}
                className="flex flex-col items-start gap-2 rounded-xl border border-brand-gray-200 p-4 hover:border-brand-red cursor-pointer disabled:opacity-50 text-left"
              >
                <CreditCard className="size-5 text-brand-red" />
                <span className="text-sm font-bold text-brand-gray-800">Tarjeta</span>
                <span className="text-[11px] text-brand-gray-500">
                  Visa, Mastercard y más vía PayPhone
                </span>
                {paying === "card" ? <Loader2 className="size-4 animate-spin" /> : null}
              </button>
              <button
                type="button"
                disabled={paying !== null}
                onClick={() => startPay("payphone")}
                className="flex flex-col items-start gap-2 rounded-xl border border-brand-gray-200 p-4 hover:border-brand-red cursor-pointer disabled:opacity-50 text-left"
              >
                <Phone className="size-5 text-brand-red" />
                <span className="text-sm font-bold text-brand-gray-800">Saldo PayPhone</span>
                <span className="text-[11px] text-brand-gray-500">
                  Paga con tu billetera PayPhone
                </span>
                {paying === "payphone" ? <Loader2 className="size-4 animate-spin" /> : null}
              </button>
            </div>
          )}

          <p className="text-[11px] text-brand-gray-400 text-center">
            Tras el cobro verás la página de gracias con tu número de orden.
          </p>
        </div>
      ) : null}

      <p className="text-center text-sm text-brand-gray-500">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/iniciar-sesion"
          className="text-brand-red font-semibold hover:text-brand-red-bright transition-colors underline-offset-2 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-2xl p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-brand-gray-400" />
        </div>
      }
    >
      <RegisterWizard />
    </Suspense>
  );
}
