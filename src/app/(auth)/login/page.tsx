"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { sriClient } from "@/lib/sriClient";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { toast } from "sonner";
import { Building2, Check, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

type CompanyItem = {
  ruc: string;
  razonSocial: string;
};

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [selectedRuc, setSelectedRuc] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const onSubmit = async (values: LoginInput) => {
    setError("");
    try {
      const user = await login(values.email.trim(), values.password);
      toast.success("Sesión iniciada correctamente");

      let list: CompanyItem[] = [];
      try {
        if (user.rol === "USER") {
          const res = await sriClient.getEmisor();
          if (res.success && res.emisor) {
            list = [{ ruc: res.emisor.ruc, razonSocial: res.emisor.razonSocial || res.emisor.ruc }];
          }
        } else {
          const res = await sriClient.getEmisores();
          if (res.success && res.emisores) {
            list = res.emisores.map((e: { ruc: string; razonSocial?: string }) => ({
              ruc: e.ruc,
              razonSocial: e.razonSocial || `Contribuyente ${e.ruc}`,
            }));
          }
        }
      } catch {
        list = [];
      }

      if (list.length === 0) {
        setCompanies([]);
        setSelecting(true);
      } else if (list.length === 1) {
        localStorage.setItem("sri_selected_ruc", list[0].ruc);
        window.location.href = "/";
      } else {
        setCompanies(list);
        setSelecting(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleSelectCompany = (ruc: string) => {
    setSelectedRuc(ruc);
    localStorage.setItem("sri_selected_ruc", ruc);
    window.location.href = "/";
  };

  if (selecting) {
    return (
      <div className="bg-white rounded-2xl shadow-2xl border border-brand-gray-200 p-8 flex flex-col gap-6 animate-fade-in-up">
        <div className="text-center flex flex-col items-center gap-4">
          <Image
            src="/exa-ati.png"
            alt="exa — Asistente Tributario Inteligente"
            width={180}
            height={36}
            priority
            className="h-9 w-auto"
          />
          <p className="text-sm text-brand-gray-500">
            {companies.length === 0
              ? "No tienes empresas vinculadas al SRI"
              : "Selecciona la empresa para continuar"}
          </p>
        </div>

        {companies.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="size-16 bg-brand-gray-100 rounded-full flex items-center justify-center">
              <Building2 className="size-8 text-brand-gray-400" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-brand-gray-600 text-center leading-relaxed">
              Para usar el sistema necesitas vincular al menos un contribuyente (RUC) al SRI.
            </p>
            <Link
              href="/configuracion?vincular=true"
              className="w-full bg-brand-red hover:bg-brand-red-bright text-white py-3 rounded-lg text-sm font-bold text-center transition-all duration-200 active:scale-[0.98]"
            >
              Vincular empresa
            </Link>
            <Link
              href="/"
              className="text-sm text-brand-gray-500 hover:text-brand-gray-700 underline underline-offset-2 transition-colors"
            >
              Omitir por ahora
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2" role="listbox" aria-label="Empresas disponibles">
            {companies.map((item, i) => (
              <button
                key={item.ruc}
                type="button"
                role="option"
                aria-selected={selectedRuc === item.ruc}
                onClick={() => handleSelectCompany(item.ruc)}
                disabled={selectedRuc === item.ruc}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-brand-gray-200 hover:border-brand-red hover:bg-brand-gray-50 transition-all text-left cursor-pointer disabled:opacity-50 animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-brand-red rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {item.ruc.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-gray-800">{item.razonSocial}</p>
                    <p className="text-[11px] text-brand-gray-500 font-mono">{item.ruc}</p>
                  </div>
                </div>
                {selectedRuc === item.ruc ? (
                  <div className="size-5 rounded-full bg-brand-red flex items-center justify-center animate-scale-in" aria-hidden>
                    <Check className="size-3 text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="size-5 rounded-full border-2 border-brand-gray-300" aria-hidden />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-brand-gray-200 p-8 flex flex-col gap-6 animate-fade-in-up">
      <div className="text-center flex flex-col items-center gap-4">
        <div className="relative flex flex-col items-center gap-3">
          <Image
            src="/exa-ati.png"
            alt="exa — Asistente Tributario Inteligente"
            width={180}
            height={36}
            priority
            className="h-9 w-auto"
          />
        </div>
        <p className="text-sm text-brand-gray-500">Inicia sesión en tu cuenta</p>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-brand-red-subtle border border-brand-red-pale rounded-lg p-3 text-xs text-brand-red font-semibold animate-slide-down flex items-center gap-2"
        >
          <div className="size-1.5 rounded-full bg-brand-red shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email || undefined}>
            <FieldLabel htmlFor="login-email">Correo electrónico o RUC</FieldLabel>
            <div className="relative group">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors duration-200"
                aria-hidden
              />
              <input
                id="login-email"
                type="text"
                autoComplete="username"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "login-email-error" : undefined}
                className="w-full pl-9 pr-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm text-brand-gray-800 focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 outline-none transition-all duration-200 placeholder:text-brand-gray-400"
                placeholder="ejemplo@email.com o RUC"
                {...register("email")}
              />
            </div>
            <FieldError id="login-email-error" errors={[errors.email]} />
          </Field>

          <Field data-invalid={!!errors.password || undefined}>
            <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
            <div className="relative group">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors duration-200"
                aria-hidden
              />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "login-password-error" : undefined}
                className="w-full pl-9 pr-10 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm text-brand-gray-800 focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 outline-none transition-all duration-200 placeholder:text-brand-gray-400"
                placeholder="Tu contraseña"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-gray-400 hover:text-brand-gray-600 transition-colors cursor-pointer"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" strokeWidth={1.5} />
                ) : (
                  <Eye className="size-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
            <FieldError id="login-password-error" errors={[errors.password]} />
          </Field>
        </FieldGroup>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand-red hover:bg-brand-red-bright text-white py-2.5 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 mt-1"
        >
          {isSubmitting ? (
            <>
              <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
              Iniciando sesión...
            </>
          ) : (
            "Iniciar sesión"
          )}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-brand-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-brand-gray-400">o</span>
        </div>
      </div>

      <p className="text-center text-sm text-brand-gray-500">
        ¿No tienes cuenta?{" "}
        <Link
          href="/register"
          className="text-brand-red font-semibold hover:text-brand-red-bright transition-colors underline-offset-2 hover:underline"
        >
          Regístrate
        </Link>
      </p>
    </div>
  );
}
