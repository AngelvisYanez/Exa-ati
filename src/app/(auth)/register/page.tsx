"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { registerSchema, type RegisterInput } from "@/lib/schemas/auth";
import { toast } from "sonner";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      nombre: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const onSubmit = async (values: RegisterInput) => {
    setError("");
    try {
      await registerUser(
        values.email,
        values.password,
        values.nombre?.trim() || undefined
      );
      toast.success("Cuenta creada correctamente");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrarse";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-brand-gray-200 p-8 flex flex-col gap-6 animate-fade-in-up">
      <div className="text-center flex flex-col items-center gap-3">
        <Image
          src="/exa-ati.png"
          alt="exa — Asistente Tributario Inteligente"
          width={180}
          height={36}
          priority
          className="h-9 w-auto"
        />
        <div>
          <h1 className="text-xl font-extrabold text-brand-gray-800">Crear cuenta</h1>
          <p className="text-sm text-brand-gray-500 mt-1">
            Regístrate para gestionar tus obligaciones tributarias
          </p>
        </div>
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
          <Field data-invalid={!!errors.nombre || undefined}>
            <FieldLabel htmlFor="register-nombre">Nombre completo</FieldLabel>
            <div className="relative group">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors duration-200"
                aria-hidden
              />
              <input
                id="register-nombre"
                type="text"
                autoComplete="name"
                className="w-full pl-9 pr-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm text-brand-gray-800 focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 outline-none transition-all duration-200 placeholder:text-brand-gray-400"
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
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors duration-200"
                aria-hidden
              />
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                className="w-full pl-9 pr-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm text-brand-gray-800 focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 outline-none transition-all duration-200 placeholder:text-brand-gray-400"
                placeholder="tu@email.com"
                {...register("email")}
              />
            </div>
            <FieldError errors={[errors.email]} />
          </Field>

          <Field data-invalid={!!errors.password || undefined}>
            <FieldLabel htmlFor="register-password">Contraseña</FieldLabel>
            <div className="relative group">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors duration-200"
                aria-hidden
              />
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                className="w-full pl-9 pr-10 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm text-brand-gray-800 focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 outline-none transition-all duration-200 placeholder:text-brand-gray-400"
                placeholder="Mínimo 6 caracteres"
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
            <FieldError errors={[errors.password]} />
          </Field>

          <Field data-invalid={!!errors.confirmPassword || undefined}>
            <FieldLabel htmlFor="register-confirm">Confirmar contraseña</FieldLabel>
            <div className="relative group">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-brand-gray-400 group-focus-within:text-brand-red transition-colors duration-200"
                aria-hidden
              />
              <input
                id="register-confirm"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                className="w-full pl-9 pr-3 h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-sm text-brand-gray-800 focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 outline-none transition-all duration-200 placeholder:text-brand-gray-400"
                placeholder="Repite tu contraseña"
                {...register("confirmPassword")}
              />
            </div>
            <FieldError errors={[errors.confirmPassword]} />
          </Field>
        </FieldGroup>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-brand-red to-brand-red-mid hover:from-brand-red-mid hover:to-brand-red-bright text-white py-2.5 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 mt-1"
        >
          {isSubmitting ? (
            <>
              <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
              Creando cuenta...
            </>
          ) : (
            "Crear cuenta"
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
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="text-brand-red font-semibold hover:text-brand-red-bright transition-colors underline-offset-2 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
