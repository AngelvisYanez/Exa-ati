"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

const INPUT_CLASS =
  "w-full h-11 sm:h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-base sm:text-sm text-brand-gray-800 outline-none transition-colors duration-200 placeholder:text-brand-gray-400 focus:border-brand-red focus:ring-2 focus:ring-brand-red/15";

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
  { n: 1 as const, label: "Plan", short: "Elegir plan" },
  { n: 2 as const, label: "Datos", short: "Tu cuenta" },
  { n: 3 as const, label: "Pago", short: "Confirmar pago" },
];

function RegisterWizard() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [paying, setPaying] = useState(false);
  const [waitingPayment, setWaitingPayment] = useState(false);
  const [checkout, setCheckout] = useState<{
    paymentUrl: string;
    pagoId: string;
    amount: number;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const currentStepMeta = STEPS.find((s) => s.n === step) ?? STEPS[0];

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
        paymentUrl:
          data.data.paymentUrl ||
          data.data.payWithCard ||
          data.data.payWithPayPhone,
        pagoId: data.data.pagoId,
        amount: data.data.amount,
      });
      setStep(3);
      toast.success("Cuenta creada. Completa el pago con PayPhone.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrarse";
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pollPagoStatus = useCallback(async () => {
    if (!checkout?.pagoId) return;
    try {
      const res = await apiFetch(
        `/api/billing/payphone/status?pagoId=${encodeURIComponent(checkout.pagoId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const estado = data.data?.estado as string | undefined;
      if (estado === "aprobado") {
        stopPolling();
        setWaitingPayment(false);
        setPaying(false);
        toast.success("Pago aprobado");
        router.push(
          `/registro/gracias?status=aprobado&plan=${encodeURIComponent(data.data.planCodigo || "")}&periodo=${encodeURIComponent(data.data.periodo || "")}&pagoId=${encodeURIComponent(checkout.pagoId)}`
        );
      } else if (estado === "cancelado" || estado === "fallido") {
        stopPolling();
        setWaitingPayment(false);
        setPaying(false);
        toast.error(
          estado === "cancelado" ? "Pago cancelado" : "Pago fallido"
        );
      }
    } catch {
      /* reintento */
    }
  }, [checkout?.pagoId, router, stopPolling]);

  const startPay = () => {
    if (!checkout?.paymentUrl) {
      toast.error("URL de pago no disponible");
      return;
    }
    setPaying(true);
    setWaitingPayment(true);
    window.open(checkout.paymentUrl, "_blank", "noopener,noreferrer");
    stopPolling();
    pollRef.current = setInterval(() => {
      void pollPagoStatus();
    }, 3000);
    toast.message("Completa el pago en la pestaña de PayPhone");
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm sm:shadow-lg border border-brand-gray-200/80 flex flex-col animate-fade-in-up overflow-hidden">
      <header className="px-4 pt-5 pb-4 sm:px-8 sm:pt-7 sm:pb-5 border-b border-brand-gray-100">
        <div className="flex flex-col items-center gap-3 text-center sm:gap-3.5">
          <BrandLogo variant="onLight" priority className="h-8 sm:h-9 w-auto" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-brand-gray-900 tracking-tight">
              Crear cuenta
            </h1>
            <p className="text-sm text-brand-gray-500 mt-1 max-w-md mx-auto leading-snug">
              Elige plan, completa tus datos y activa el panel al confirmar el pago.
            </p>
          </div>
        </div>

        {/* Mobile: progress + current step */}
        <div className="mt-5 sm:hidden" aria-hidden={false}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-xs font-semibold text-brand-gray-700">
              Paso {step} de {STEPS.length}
              <span className="text-brand-gray-400 font-medium"> · {currentStepMeta.short}</span>
            </p>
            <p className="text-[11px] tabular-nums text-brand-gray-400 font-medium">
              {Math.round((step / STEPS.length) * 100)}%
            </p>
          </div>
          <div
            className="h-1.5 rounded-full bg-brand-gray-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={3}
            aria-label={`Paso ${step} de ${STEPS.length}`}
          >
            <div
              className="h-full rounded-full bg-brand-red transition-[width] duration-200 ease-out"
              style={{ width: `${(step / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Desktop / tablet: full stepper */}
        <ol
          className="hidden sm:flex items-center justify-between gap-2 mt-6"
          aria-label="Pasos del registro"
        >
          {STEPS.map((s, i) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <li key={s.n} className="flex-1 flex items-center gap-2 min-w-0">
                <div
                  className={`flex items-center gap-2 min-w-0 ${
                    active || done ? "text-brand-red" : "text-brand-gray-400"
                  }`}
                >
                  <span
                    className={`size-8 shrink-0 rounded-full text-xs font-bold flex items-center justify-center border transition-colors duration-200 ${
                      done
                        ? "bg-brand-red text-white border-brand-red"
                        : active
                          ? "bg-brand-red/10 text-brand-red border-brand-red"
                          : "bg-brand-gray-50 border-brand-gray-200 text-brand-gray-500"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={2.5} /> : s.n}
                  </span>
                  <span className="text-xs font-semibold truncate">{s.label}</span>
                </div>
                {i < STEPS.length - 1 ? (
                  <div
                    className={`h-px flex-1 min-w-4 ${done ? "bg-brand-red" : "bg-brand-gray-200"}`}
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </header>

      <div className="px-4 py-5 sm:px-8 sm:py-6 flex flex-col gap-5">
        {error ? (
          <div
            role="alert"
            className="bg-brand-red-subtle border border-brand-red-pale rounded-lg p-3 text-sm text-brand-red font-medium flex items-start gap-2"
          >
            <div className="size-1.5 rounded-full bg-brand-red shrink-0 mt-1.5" aria-hidden />
            <span className="leading-snug">{error}</span>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-5">
            <div
              className="grid grid-cols-2 p-1 rounded-xl bg-brand-gray-50 border border-brand-gray-200"
              role="group"
              aria-label="Periodo de facturación"
            >
              {(["mensual", "anual"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  aria-pressed={periodo === p}
                  className={`min-h-11 sm:min-h-10 rounded-lg text-sm font-semibold cursor-pointer transition-colors duration-200 ${
                    periodo === p
                      ? "bg-white text-brand-gray-900 shadow-sm border border-brand-gray-200"
                      : "text-brand-gray-500 hover:text-brand-gray-700 border border-transparent"
                  }`}
                >
                  {p === "mensual" ? "Mensual" : "Anual"}
                </button>
              ))}
            </div>

            {loadingPlans ? (
              <div className="flex justify-center py-12 text-brand-gray-400">
                <Loader2 className="size-6 animate-spin" aria-label="Cargando planes" />
              </div>
            ) : (
              <div
                className="grid gap-3 md:grid-cols-3"
                role="radiogroup"
                aria-label="Planes disponibles"
              >
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
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPlanCodigo(plan.codigo)}
                      className={`text-left rounded-xl border p-4 min-h-[7.5rem] flex flex-col gap-2 cursor-pointer transition-colors duration-200 touch-manipulation ${
                        selected
                          ? "border-brand-red bg-brand-red-subtle/40 ring-1 ring-brand-red"
                          : "border-brand-gray-200 bg-white hover:border-brand-gray-300 active:bg-brand-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="font-bold text-sm sm:text-[15px] text-brand-gray-900">
                            {plan.nombre}
                          </h2>
                          <p className="text-xs text-brand-gray-500 leading-relaxed mt-1 line-clamp-2 sm:line-clamp-3">
                            {plan.descripcion}
                          </p>
                        </div>
                        <span
                          className={`size-5 shrink-0 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                            selected
                              ? "border-brand-red bg-brand-red"
                              : "border-brand-gray-300 bg-white"
                          }`}
                          aria-hidden
                        >
                          {selected ? (
                            <Check className="size-3 text-white" strokeWidth={3} />
                          ) : null}
                        </span>
                      </div>
                      <p className="text-xl font-bold tabular-nums text-brand-gray-900 mt-auto pt-1">
                        {money(p, plan.moneda)}
                        <span className="text-xs font-semibold text-brand-gray-400 ml-0.5">
                          /{periodo === "anual" ? "año" : "mes"}
                        </span>
                      </p>
                      <p className="text-[11px] text-brand-gray-500">
                        Hasta {plan.maxEmpresas} empresa{plan.maxEmpresas === 1 ? "" : "s"} ·{" "}
                        {plan.modulosCount} módulos
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* CTA fijo en móvil: los planes empujan el botón fuera del primer viewport */}
            <div className="sm:hidden h-14" aria-hidden />
            <div className="fixed inset-x-0 bottom-0 z-20 sm:static sm:inset-auto sm:z-auto border-t border-brand-gray-100 sm:border-0 bg-white/95 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-0 sm:py-0 sm:pb-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] sm:shadow-none">
              <button
                type="button"
                onClick={goPlanNext}
                className="w-full min-h-11 sm:min-h-10 bg-brand-red hover:bg-brand-red-bright text-white rounded-lg text-sm font-bold transition-colors duration-200 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2 touch-manipulation"
              >
                Continuar
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <form onSubmit={handleSubmit(onDatosSubmit)} className="flex flex-col gap-5" noValidate>
            <div className="rounded-xl border border-brand-gray-200 bg-brand-gray-50 px-3.5 py-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs sm:text-sm text-brand-gray-600">
                Plan:{" "}
                <strong className="text-brand-gray-900 font-semibold">
                  {selectedPlan?.nombre}
                </strong>
              </p>
              <p className="text-xs sm:text-sm font-bold tabular-nums text-brand-gray-900">
                {money(price, selectedPlan?.moneda)}/
                {periodo === "anual" ? "año" : "mes"}
              </p>
            </div>

            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <Field data-invalid={!!errors.nombre || undefined}>
                  <FieldLabel htmlFor="register-nombre">Nombre completo</FieldLabel>
                  <div className="relative group">
                    <User
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors"
                      aria-hidden
                    />
                    <input
                      id="register-nombre"
                      type="text"
                      autoComplete="name"
                      className={`${INPUT_CLASS} pl-9 pr-3`}
                      placeholder="Tu nombre"
                      {...register("nombre")}
                    />
                  </div>
                  <FieldError errors={[errors.nombre]} />
                </Field>

                <Field data-invalid={!!errors.email || undefined}>
                  <FieldLabel htmlFor="register-email">Correo electrónico</FieldLabel>
                  <div className="relative group">
                    <Mail
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors"
                      aria-hidden
                    />
                    <input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      className={`${INPUT_CLASS} pl-9 pr-3`}
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
                  <Building2
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors"
                    aria-hidden
                  />
                  <input
                    id="register-empresa"
                    type="text"
                    autoComplete="organization"
                    className={`${INPUT_CLASS} pl-9 pr-3`}
                    placeholder="Nombre de tu negocio"
                    {...register("razonSocial")}
                  />
                </div>
                <FieldError errors={[errors.razonSocial]} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field data-invalid={!!errors.ruc || undefined}>
                  <FieldLabel htmlFor="register-ruc">RUC (opcional)</FieldLabel>
                  <input
                    id="register-ruc"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={`${INPUT_CLASS} px-3 font-mono`}
                    placeholder="13 dígitos"
                    {...register("ruc")}
                  />
                  <FieldError errors={[errors.ruc]} />
                </Field>
                <Field data-invalid={!!errors.telefono || undefined}>
                  <FieldLabel htmlFor="register-tel">Teléfono</FieldLabel>
                  <div className="relative">
                    <Phone
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400"
                      aria-hidden
                    />
                    <input
                      id="register-tel"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className={`${INPUT_CLASS} pl-9 pr-3`}
                      placeholder="09xxxxxxxx"
                      {...register("telefono")}
                    />
                  </div>
                  <FieldError errors={[errors.telefono]} />
                </Field>
                <Field
                  data-invalid={!!errors.ciudad || undefined}
                  className="sm:col-span-2 lg:col-span-1"
                >
                  <FieldLabel htmlFor="register-ciudad">Ciudad</FieldLabel>
                  <div className="relative">
                    <MapPin
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400"
                      aria-hidden
                    />
                    <input
                      id="register-ciudad"
                      type="text"
                      autoComplete="address-level2"
                      className={`${INPUT_CLASS} pl-9 pr-3`}
                      placeholder="Quito"
                      {...register("ciudad")}
                    />
                  </div>
                  <FieldError errors={[errors.ciudad]} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field data-invalid={!!errors.password || undefined}>
                  <FieldLabel htmlFor="register-password">Contraseña</FieldLabel>
                  <div className="relative group">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors"
                      aria-hidden
                    />
                    <input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className={`${INPUT_CLASS} pl-9 pr-11`}
                      placeholder="Mínimo 6 caracteres"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 size-9 flex items-center justify-center text-brand-gray-400 hover:text-brand-gray-600 cursor-pointer rounded-md"
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
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors"
                      aria-hidden
                    />
                    <input
                      id="register-confirm"
                      type="password"
                      autoComplete="new-password"
                      className={`${INPUT_CLASS} pl-9 pr-3`}
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

            <div className="sm:hidden h-20" aria-hidden />
            <div className="fixed inset-x-0 bottom-0 z-20 sm:static sm:inset-auto sm:z-auto border-t border-brand-gray-100 sm:border-0 bg-white/95 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-0 sm:pt-1 sm:pb-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] sm:shadow-none">
              <div className="flex flex-row gap-2 sm:gap-3 max-w-3xl mx-auto">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-11 sm:min-h-10 px-3 sm:px-4 rounded-lg text-sm font-bold border border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50 cursor-pointer flex items-center justify-center gap-1.5 touch-manipulation bg-white shrink-0"
                >
                  <ChevronLeft className="size-4" />
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 min-h-11 sm:min-h-10 bg-brand-red hover:bg-brand-red-bright text-white rounded-lg text-sm font-bold disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 touch-manipulation transition-colors duration-200"
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
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-brand-gray-200 bg-brand-gray-50 p-4">
              <p className="text-sm font-bold text-brand-gray-900">Resumen</p>
              <p className="text-sm text-brand-gray-600 mt-1.5 leading-snug">
                {selectedPlan?.nombre} · {periodo} ·{" "}
                <span className="font-semibold tabular-nums text-brand-gray-900">
                  {checkout
                    ? money(checkout.amount, selectedPlan?.moneda)
                    : money(price, selectedPlan?.moneda)}
                </span>
              </p>
              {checkout?.pagoId ? (
                <p className="text-xs text-brand-gray-400 mt-2.5 font-mono break-all">
                  Orden pendiente: {checkout.pagoId}
                </p>
              ) : null}
            </div>

            {!payConfigured || !checkout ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 leading-snug">
                No hay métodos de pago disponibles todavía. Vuelve a{" "}
                <Link href="/suscripcion" className="font-bold underline underline-offset-2">
                  Suscripción
                </Link>{" "}
                cuando PayPhone esté configurado.
              </div>
            ) : waitingPayment ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center space-y-3">
                <Loader2 className="size-8 animate-spin text-amber-600 mx-auto" />
                <p className="text-sm font-bold text-brand-gray-900">
                  Esperando tu pago…
                </p>
                <p className="text-xs text-brand-gray-600 leading-snug">
                  Completa el cobro en PayPhone. Esta pantalla se actualizará sola
                  cuando el pago sea aprobado.
                </p>
                {checkout.paymentUrl ? (
                  <a
                    href={checkout.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-xs font-bold text-brand-red underline underline-offset-2"
                  >
                    Reabrir página de pago
                  </a>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                disabled={paying}
                onClick={startPay}
                className="flex flex-col items-start gap-2 rounded-xl border border-brand-gray-200 p-4 min-h-[6.5rem] hover:border-brand-red active:bg-brand-gray-50 cursor-pointer disabled:opacity-50 text-left touch-manipulation transition-colors duration-200 w-full"
              >
                <CreditCard className="size-5 text-brand-red" />
                <span className="text-sm font-bold text-brand-gray-900">
                  Pagar con PayPhone
                </span>
                <span className="text-xs text-brand-gray-500 leading-snug">
                  Tarjeta o saldo PayPhone en un enlace seguro
                </span>
                {paying ? (
                  <Loader2 className="size-4 animate-spin text-brand-gray-400" />
                ) : null}
              </button>
            )}

            <p className="text-xs text-brand-gray-400 text-center leading-relaxed px-2">
              Se abrirá PayPhone en una pestaña nueva. Al aprobar el cobro verás la
              página de gracias.
            </p>
          </div>
        ) : null}
      </div>

      <footer
        className={`px-4 py-4 sm:px-8 sm:py-5 border-t border-brand-gray-100 bg-brand-gray-50 ${
          step < 3 ? "pb-24 sm:pb-5" : ""
        }`}
      >
        <p className="text-center text-sm text-brand-gray-500">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/iniciar-sesion"
            className="text-brand-red font-semibold hover:text-brand-red-bright transition-colors underline-offset-2 hover:underline"
          >
            Inicia sesión
          </Link>
        </p>
      </footer>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-xl sm:rounded-2xl border border-brand-gray-200 p-8 flex justify-center min-h-48 items-center">
          <Loader2 className="size-6 animate-spin text-brand-gray-400" aria-label="Cargando" />
        </div>
      }
    >
      <RegisterWizard />
    </Suspense>
  );
}
