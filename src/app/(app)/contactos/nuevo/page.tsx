"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { contactoSchema, type ContactoInput } from "@/lib/schemas/contacto";

const TIPOS_ID = [
  { value: "04" as const, label: "RUC" },
  { value: "05" as const, label: "Cédula" },
  { value: "06" as const, label: "Pasaporte" },
  { value: "07" as const, label: "Consumidor Final" },
];

export default function NuevoContactoPage() {
  const router = useRouter();
  const [buscandoSri, setBuscandoSri] = useState(false);
  const [validacion, setValidacion] = useState<{ valido: boolean; mensaje: string } | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactoInput>({
    resolver: zodResolver(contactoSchema),
    defaultValues: {
      tipoIdentificacion: "04",
      identificacion: "",
      razonSocial: "",
      nombreComercial: "",
      email: "",
      telefono: "",
      direccion: "",
      esCliente: true,
      esProveedor: false,
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const tipoIdentificacion = watch("tipoIdentificacion");

  const handleValidarIdentificacion = async () => {
    const identificacion = getValues("identificacion");
    const tipo = getValues("tipoIdentificacion");
    if (!identificacion.trim()) return;
    setValidacion(null);
    try {
      const res = await apiFetch(
        `/api/sri/validar?identificacion=${identificacion}&tipo=${tipo}`
      );
      const data = await res.json();
      if (data.valido) {
        setValidacion({ valido: true, mensaje: "Identificación válida" });
      } else {
        setValidacion({ valido: false, mensaje: data.mensaje || "Identificación no válida" });
      }
    } catch {
      setValidacion({ valido: false, mensaje: "Error al validar" });
    }
  };

  const handleBuscarSri = async () => {
    const identificacion = getValues("identificacion");
    if (!identificacion.trim() || tipoIdentificacion !== "04") {
      toast.warning("La búsqueda en SRI requiere un RUC válido");
      return;
    }
    setBuscandoSri(true);
    try {
      const res = await apiFetch(`/api/sri/contribuyente?ruc=${identificacion}`);
      if (!res.ok) throw new Error("No encontrado");
      const data = await res.json();
      setValue("razonSocial", data.razonSocial || "");
      setValue("nombreComercial", data.nombreComercial || "");
      setValue("direccion", data.direccion || "");
      setValue("email", data.email || "");
      if (data.razonSocial) {
        toast.success("Datos del contribuyente cargados desde el SRI");
      } else {
        toast.warning("Contribuyente encontrado sin datos completos");
      }
    } catch {
      toast.error("No se encontró el contribuyente en el SRI");
    } finally {
      setBuscandoSri(false);
    }
  };

  const onSubmit = async (values: ContactoInput) => {
    try {
      const res = await apiFetch("/api/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoIdentificacion: values.tipoIdentificacion,
          identificacion: values.identificacion.trim(),
          razonSocial: values.razonSocial.trim(),
          nombreComercial: values.nombreComercial?.trim() || undefined,
          email: values.email?.trim() || undefined,
          telefono: values.telefono?.trim() || undefined,
          direccion: values.direccion?.trim() || undefined,
          esCliente: values.esCliente,
          esProveedor: values.esProveedor,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al crear contacto");
      }
      toast.success("Contacto creado correctamente");
      router.push("/contactos");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    }
  };

  return (
    <>
      <title>Nuevo Contacto - OFSERCONT IA</title>
      <Topbar title="Nuevo Contacto" backLink={{ href: "/contactos", label: "Contactos" }} />
      <main className="ui-page flex-1">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Nuevo Contacto</h1>

        <Card className="p-5 border-brand-gray-200">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
            <FieldGroup>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field data-invalid={!!errors.tipoIdentificacion || undefined}>
                  <FieldLabel htmlFor="contacto-tipo">Tipo Identificación</FieldLabel>
                  <select
                    id="contacto-tipo"
                    aria-label="Tipo de identificación"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                    {...register("tipoIdentificacion")}
                  >
                    {TIPOS_ID.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <FieldError errors={[errors.tipoIdentificacion]} />
                </Field>

                <Field data-invalid={!!errors.identificacion || undefined}>
                  <FieldLabel htmlFor="contacto-id">Identificación *</FieldLabel>
                  <div className="flex gap-1">
                    <Input
                      id="contacto-id"
                      placeholder="Número"
                      className="flex-1"
                      aria-invalid={!!errors.identificacion}
                      {...register("identificacion")}
                      onBlur={(e) => {
                        register("identificacion").onBlur(e);
                        void handleValidarIdentificacion();
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleBuscarSri}
                      disabled={buscandoSri}
                      aria-label="Buscar en SRI"
                      title="Buscar en SRI"
                    >
                      <Search className="size-3.5" />
                    </Button>
                  </div>
                  {validacion && (
                    <span
                      className={`text-[10px] font-semibold ${validacion.valido ? "text-success" : "text-destructive"}`}
                      role="status"
                    >
                      {validacion.mensaje}
                    </span>
                  )}
                  <FieldError errors={[errors.identificacion]} />
                </Field>
              </div>

              <Field data-invalid={!!errors.razonSocial || undefined}>
                <FieldLabel htmlFor="contacto-razon">Razón Social *</FieldLabel>
                <Input
                  id="contacto-razon"
                  placeholder="Nombre completo"
                  aria-invalid={!!errors.razonSocial}
                  {...register("razonSocial")}
                />
                <FieldError errors={[errors.razonSocial]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="contacto-comercial">Nombre Comercial</FieldLabel>
                <Input id="contacto-comercial" placeholder="Opcional" {...register("nombreComercial")} />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field data-invalid={!!errors.email || undefined}>
                  <FieldLabel htmlFor="contacto-email">Email</FieldLabel>
                  <Input
                    id="contacto-email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    aria-invalid={!!errors.email}
                    {...register("email")}
                  />
                  <FieldError errors={[errors.email]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contacto-tel">Teléfono</FieldLabel>
                  <Input id="contacto-tel" placeholder="0999999999" {...register("telefono")} />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="contacto-dir">Dirección</FieldLabel>
                <Input id="contacto-dir" placeholder="Dirección fiscal" {...register("direccion")} />
              </Field>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-brand-gray-300 text-brand-red focus:ring-brand-red/30"
                    {...register("esCliente")}
                  />
                  <span className="text-xs font-medium text-brand-gray-700">Es Cliente</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-brand-gray-300 text-brand-red focus:ring-brand-red/30"
                    {...register("esProveedor")}
                  />
                  <span className="text-xs font-medium text-brand-gray-700">Es Proveedor</span>
                </label>
              </div>
            </FieldGroup>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand-red hover:bg-brand-red-bright text-white"
              >
                {isSubmitting ? "Guardando..." : "Guardar Contacto"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
