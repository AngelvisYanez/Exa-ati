"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import { Loader2, Save, Eye } from "lucide-react";

export interface RideDisenoFormValue {
  codigo: string;
  nombre: string;
  descripcion: string;
  plantilla: "clasico" | "compacto" | "banda";
  mostrarLogo: boolean;
  mostrarQr: boolean;
  mostrarAdicional: boolean;
  mostrarPagos: boolean;
  colorModo: "ruc" | "fijo";
  colorHex: string;
}

const PLANTILLAS: { id: RideDisenoFormValue["plantilla"]; titulo: string; texto: string }[] = [
  {
    id: "clasico",
    titulo: "Clásico SRI",
    texto: "Caja de autorización a la derecha, con la clave de acceso y el QR dentro.",
  },
  {
    id: "compacto",
    titulo: "Compacto",
    texto: "Autorización más corta. El QR queda al final del documento.",
  },
  {
    id: "banda",
    titulo: "Banda de marca",
    texto: "Franja de color con el logo y los datos de autorización en dos paneles.",
  },
];

const emptyForm = (): RideDisenoFormValue => ({
  codigo: "",
  nombre: "",
  descripcion: "",
  plantilla: "clasico",
  mostrarLogo: true,
  mostrarQr: true,
  mostrarAdicional: true,
  mostrarPagos: true,
  colorModo: "ruc",
  colorHex: "#1f4b3a",
});

export function RideDisenoEditor({
  mode,
  codigo,
}: {
  mode: "create" | "edit";
  codigo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [esSistema, setEsSistema] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<RideDisenoFormValue>(emptyForm);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const autoPreview = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (mode !== "edit" || !codigo) return;
    const load = async () => {
      try {
        const res = await apiFetch(`/api/admin/ride-diseno/${encodeURIComponent(codigo)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "No encontrado");
        const row = data.data;
        setEsSistema(Boolean(row.esSistema));
        setForm({
          codigo: row.codigo,
          nombre: row.nombre || "",
          descripcion: row.descripcion || "",
          plantilla: row.plantilla,
          mostrarLogo: Boolean(row.mostrarLogo),
          mostrarQr: Boolean(row.mostrarQr),
          mostrarAdicional: Boolean(row.mostrarAdicional),
          mostrarPagos: Boolean(row.mostrarPagos),
          colorModo: row.colorModo === "fijo" ? "fijo" : "ruc",
          colorHex: row.colorHex || "#1f4b3a",
        });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "No se pudo cargar el diseño");
        router.push("/administracion/ride-diseno");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [mode, codigo, router]);

  const payload = () => ({
    ...form,
    descripcion: form.descripcion || null,
    colorHex: form.colorModo === "fijo" ? form.colorHex : null,
  });

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const res = await apiFetch("/api/admin/ride-diseno/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo generar la vista previa");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al previsualizar");
    } finally {
      setPreviewing(false);
    }
  };

  useEffect(() => {
    if (loading || mode !== "edit" || !form.codigo || autoPreview.current) return;
    autoPreview.current = true;
    void runPreview();
  }, [loading, mode, form.codigo]);

  const remove = async () => {
    if (!codigo || esSistema) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/admin/ride-diseno/${encodeURIComponent(codigo)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo eliminar");
      toast.success("Diseño eliminado");
      router.push("/administracion/ride-diseno");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/admin/ride-diseno", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudo guardar");
      toast.success("Diseño guardado");
      if (mode === "create") {
        router.push(`/administracion/ride-diseno/${encodeURIComponent(data.data.codigo)}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-brand-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
      <form
        className="bg-white border border-brand-gray-200 rounded-xl p-5 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={form.nombre}
            maxLength={120}
            onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            value={form.codigo}
            maxLength={40}
            disabled={mode === "edit"}
            placeholder="mi-factura"
            onChange={(event) =>
              setForm((prev) => ({ ...prev, codigo: event.target.value.toLowerCase() }))
            }
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descripcion">Descripción</Label>
          <Input
            id="descripcion"
            value={form.descripcion}
            maxLength={500}
            onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold text-brand-gray-700">Plantilla</legend>
          {PLANTILLAS.map((plantilla) => (
            <label
              key={plantilla.id}
              className={`border rounded-lg p-3 cursor-pointer ${
                form.plantilla === plantilla.id ? "border-brand-red bg-brand-red/5" : "border-brand-gray-200"
              } ${esSistema ? "opacity-80" : ""}`}
            >
              <span className="flex items-start gap-2">
                <input
                  type="radio"
                  name="plantilla"
                  className="mt-1"
                  checked={form.plantilla === plantilla.id}
                  disabled={esSistema}
                  onChange={() => setForm((prev) => ({ ...prev, plantilla: plantilla.id }))}
                />
                <span>
                  <span className="block text-sm font-semibold text-brand-gray-800">{plantilla.titulo}</span>
                  <span className="block text-[11px] text-brand-gray-500 mt-0.5">{plantilla.texto}</span>
                </span>
              </span>
            </label>
          ))}
          {esSistema ? (
            <p className="text-[11px] text-brand-gray-400">
              Esta plantilla es del sistema. Para usar otra base, crea un diseño nuevo.
            </p>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold text-brand-gray-700">Contenido</legend>
          {(
            [
              ["mostrarLogo", "Mostrar logo"],
              ["mostrarQr", "Mostrar código QR"],
              ["mostrarAdicional", "Mostrar información adicional"],
              ["mostrarPagos", "Mostrar forma de pago"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-brand-gray-700">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.checked }))}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold text-brand-gray-700">Color</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="colorModo"
              checked={form.colorModo === "ruc"}
              onChange={() => setForm((prev) => ({ ...prev, colorModo: "ruc" }))}
            />
            Color según el RUC de la empresa
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="colorModo"
              checked={form.colorModo === "fijo"}
              onChange={() => setForm((prev) => ({ ...prev, colorModo: "fijo" }))}
            />
            Color fijo
          </label>
          {form.colorModo === "fijo" ? (
            <Input
              type="color"
              value={form.colorHex}
              className="h-10 w-20 p-1"
              onChange={(event) => setForm((prev) => ({ ...prev, colorHex: event.target.value }))}
            />
          ) : null}
        </fieldset>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" disabled={saving} className="bg-brand-red hover:bg-brand-red-bright text-white">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar
          </Button>
          <Button type="button" variant="outline" disabled={previewing} onClick={() => void runPreview()}>
            {previewing ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            Vista previa
          </Button>
          {mode === "edit" && !esSistema ? (
            <Button type="button" variant="outline" disabled={deleting} onClick={() => void remove()}>
              Eliminar
            </Button>
          ) : null}
        </div>
      </form>

      <div className="bg-white border border-brand-gray-200 rounded-xl min-h-[720px] overflow-hidden">
        {previewUrl ? (
          <iframe title="Vista previa del RIDE" src={previewUrl} className="w-full h-[900px] bg-white" />
        ) : (
          <div className="h-[720px] flex items-center justify-center text-sm text-brand-gray-400 px-8 text-center">
            Pulsa «Vista previa» para ver la factura de ejemplo con esta plantilla.
          </div>
        )}
      </div>
    </div>
  );
}
