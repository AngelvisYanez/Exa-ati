"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  leadSchema,
  ECUADOR_CITY_VALUES,
  type LeadInput,
} from "@/lib/schemas/leads";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function LeadForm({ fuente = "homepage" }: { fuente?: string }) {
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      nombre: "",
      email: "",
      telefono: "",
      ciudad: "Quito",
      perfil: "emprendedor",
      mensaje: "",
      fuente,
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const onSubmit = async (values: LeadInput) => {
    try {
      const res = await fetch("/api/marketing/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, fuente }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al enviar");
      toast.success(data.message || "Solicitud enviada");
      setDone(true);
      reset({
        nombre: "",
        email: "",
        telefono: "",
        ciudad: "Quito",
        perfil: "emprendedor",
        mensaje: "",
        fuente,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar");
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-success/30 bg-success-pale p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="mt-3 text-sm font-bold text-brand-gray-900">
          Solicitud recibida
        </p>
        <p className="mt-1 text-xs text-brand-gray-600 leading-relaxed">
          Te contactaremos para ayudarte a activar EXA ATI en tu ciudad.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-4 text-xs font-bold text-brand-red hover:underline cursor-pointer"
        >
          Enviar otra consulta
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="lead-nombre">Nombre</FieldLabel>
          <input
            id="lead-nombre"
            className="w-full rounded-lg border border-brand-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
            autoComplete="name"
            {...register("nombre")}
          />
          <FieldError>{errors.nombre?.message}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="lead-email">Correo</FieldLabel>
          <input
            id="lead-email"
            type="email"
            className="w-full rounded-lg border border-brand-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
            autoComplete="email"
            {...register("email")}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="lead-tel">Teléfono / WhatsApp</FieldLabel>
          <input
            id="lead-tel"
            type="tel"
            placeholder="09xxxxxxxx"
            className="w-full rounded-lg border border-brand-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
            autoComplete="tel"
            {...register("telefono")}
          />
          <FieldError>{errors.telefono?.message}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="lead-ciudad">Ciudad</FieldLabel>
          <select
            id="lead-ciudad"
            className="w-full rounded-lg border border-brand-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
            {...register("ciudad")}
          >
            {ECUADOR_CITY_VALUES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <FieldError>{errors.ciudad?.message}</FieldError>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="lead-perfil">¿Quién eres?</FieldLabel>
        <select
          id="lead-perfil"
          className="w-full rounded-lg border border-brand-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
          {...register("perfil")}
        >
          <option value="emprendedor">Emprendedor / negocio propio</option>
          <option value="contador">Contador / estudio contable</option>
          <option value="despacho">Despacho / varias empresas</option>
        </select>
        <FieldError>{errors.perfil?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="lead-msg">¿Qué necesitas? (opcional)</FieldLabel>
        <textarea
          id="lead-msg"
          rows={3}
          className="w-full rounded-lg border border-brand-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 resize-y"
          placeholder="Ej. Emitir facturas desde Guayaquil, ATS para 3 clientes…"
          {...register("mensaje")}
        />
        <FieldError>{errors.mensaje?.message}</FieldError>
      </Field>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-red px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-red-bright disabled:opacity-60 transition-colors cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Enviando…
          </>
        ) : (
          "Quiero que me contacten"
        )}
      </button>
      <p className="text-[11px] text-brand-gray-400 leading-relaxed">
        Al enviar aceptas que te contactemos sobre EXA ATI. Sin spam.
      </p>
    </form>
  );
}
