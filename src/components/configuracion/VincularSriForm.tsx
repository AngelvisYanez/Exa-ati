"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { vincularSriSchema, type VincularSriInput } from "@/lib/schemas/emisor";
import { sriClient } from "@/lib/sriClient";
import { toast } from "sonner";

type VincularSriFormProps = {
  onSuccess?: () => void | Promise<void>;
  onCancel?: () => void;
};

export function VincularSriForm({ onSuccess, onCancel }: VincularSriFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VincularSriInput>({
    resolver: zodResolver(vincularSriSchema),
    defaultValues: { ruc: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const onSubmit = async (values: VincularSriInput) => {
    try {
      const res = await sriClient.vincularSri(values.ruc, values.password);
      if (res.success) {
        toast.success("Empresa vinculada correctamente al SRI");
        reset();
        await onSuccess?.();
      } else {
        toast.error(res.error || "Error al vincular con el SRI");
      }
    } catch {
      toast.error("Error de red al vincular con el SRI");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.ruc || undefined}>
          <FieldLabel htmlFor="vincular-ruc">RUC</FieldLabel>
          <input
            id="vincular-ruc"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={!!errors.ruc}
            placeholder="13 dígitos"
            className="w-full h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg px-3 text-sm font-mono focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 outline-none"
            {...register("ruc", {
              onChange: (e) => {
                e.target.value = e.target.value.replace(/\D/g, "").slice(0, 13);
              },
            })}
          />
          <FieldError errors={[errors.ruc]} />
        </Field>

        <Field data-invalid={!!errors.password || undefined}>
          <FieldLabel htmlFor="vincular-password">Clave del portal SRI</FieldLabel>
          <input
            id="vincular-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            placeholder="Clave SRI"
            className="w-full h-10 bg-brand-gray-50 border border-brand-gray-200 rounded-lg px-3 text-sm focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 outline-none"
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-brand-red hover:bg-brand-red-bright text-white"
        >
          {isSubmitting ? "Vinculando..." : "Vincular Empresa"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onCancel();
            }}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
