"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Calculator, Save } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";

export default function NuevaMensualPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [calculando, setCalculando] = useState(false);

  const [periodo, setPeriodo] = useState("");
  const [ruc, setRuc] = useState("");

  const [ventasIva, setVentasIva] = useState("0");
  const [ventas0, setVentas0] = useState("0");
  const [ncVentas15, setNcVentas15] = useState("0");
  const [ncVentas0, setNcVentas0] = useState("0");

  const [compras15, setCompras15] = useState("0");
  const [compras0, setCompras0] = useState("0");
  const [compras5, setCompras5] = useState("0");
  const [compras8, setCompras8] = useState("0");
  const [activosFijos, setActivosFijos] = useState("0");
  const [importaciones, setImportaciones] = useState("0");
  const [ncCompras15, setNcCompras15] = useState("0");
  const [ncComprasSinIva, setNcComprasSinIva] = useState("0");

  const [retIva20, setRetIva20] = useState("0");
  const [retIva30, setRetIva30] = useState("0");
  const [retIva70, setRetIva70] = useState("0");
  const [retIva100, setRetIva100] = useState("0");

  const [retIr303, setRetIr303] = useState("0");
  const [retIr304, setRetIr304] = useState("0");
  const [retIr307, setRetIr307] = useState("0");
  const [retIr310, setRetIr310] = useState("0");
  const [retIr322, setRetIr322] = useState("0");

  const [sueldo, setSueldo] = useState("0");
  const [depreciaciones, setDepreciaciones] = useState("0");
  const [gastosNoDeducibles, setGastosNoDeducibles] = useState("0");
  const [observaciones, setObservaciones] = useState("");

  const [resultado, setResultado] = useState<Record<string, number> | null>(null);

  const n = (v: string) => parseFloat(v) || 0;

  const handleCalcular = async () => {
    if (!periodo || !ruc) {
      toast.warning("Ingrese periodo y RUC primero");
      return;
    }
    setCalculando(true);
    try {
      const res = await apiFetch("/api/control-tributario/mensual", {
        method: "POST",
        body: JSON.stringify({
          tenantId: "current",
          periodo: parseInt(periodo),
          ruc,
          ventasIva: n(ventasIva),
          ventas0: n(ventas0),
          ncVentas15: n(ncVentas15),
          ncVentas0: n(ncVentas0),
          compras15: n(compras15),
          compras0: n(compras0),
          compras5: n(compras5),
          compras8: n(compras8),
          activosFijos: n(activosFijos),
          importaciones: n(importaciones),
          ncCompras15: n(ncCompras15),
          ncComprasSinIva: n(ncComprasSinIva),
          retIva20: n(retIva20),
          retIva30: n(retIva30),
          retIva70: n(retIva70),
          retIva100: n(retIva100),
          retIr303: n(retIr303),
          retIr304: n(retIr304),
          retIr307: n(retIr307),
          retIr310: n(retIr310),
          retIr322: n(retIr322),
          sueldo: n(sueldo),
          depreciaciones: n(depreciaciones),
          gastosNoDeducibles: n(gastosNoDeducibles),
          observaciones,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const json = await res.json();
      setResultado(json.data || json);
      toast.success("Declaraci\u00f3n calculada y guardada");
    } catch (e: any) {
      toast.error(e.message || "Error al calcular");
    } finally {
      setCalculando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await handleCalcular();
    setSubmitting(false);
    router.push("/control-tributario/mensual");
  };

  const InputField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <Label className="text-xs font-medium text-brand-gray-600">{label}</Label>
      <Input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );

  return (
    <>
      <title>Nueva Declaraci\u00f3n Mensual - Control Tributario</title>
      <Topbar title="Nueva Declaraci\u00f3n Mensual" backLink={{ href: "/control-tributario/mensual", label: "Declaraciones" }} />
      <main className="ui-page flex-1">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-32">
              <Label className="text-xs font-medium text-brand-gray-600">Periodo (YYYYMM)</Label>
              <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="202601" className="h-8 text-sm" required />
            </div>
            <div className="flex-1">
              <Label className="text-xs font-medium text-brand-gray-600">RUC</Label>
              <Input value={ruc} onChange={(e) => setRuc(e.target.value)} placeholder="1234567890001" className="h-8 text-sm" required />
            </div>
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-gray-800">Formulario 104 - Ventas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InputField label="Ventas IVA 15%" value={ventasIva} onChange={setVentasIva} />
                <InputField label="Ventas 0%" value={ventas0} onChange={setVentas0} />
                <InputField label="NC Ventas 15%" value={ncVentas15} onChange={setNcVentas15} />
                <InputField label="NC Ventas 0%" value={ncVentas0} onChange={setNcVentas0} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-gray-800">Formulario 104 - Compras</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InputField label="Compras 15%" value={compras15} onChange={setCompras15} />
                <InputField label="Compras 0%" value={compras0} onChange={setCompras0} />
                <InputField label="Compras 5% (Bienes)" value={compras5} onChange={setCompras5} />
                <InputField label="Compras 8%" value={compras8} onChange={setCompras8} />
                <InputField label="Activos Fijos" value={activosFijos} onChange={setActivosFijos} />
                <InputField label="Importaciones" value={importaciones} onChange={setImportaciones} />
                <InputField label="NC Compras 15%" value={ncCompras15} onChange={setNcCompras15} />
                <InputField label="NC Compras Sin IVA" value={ncComprasSinIva} onChange={setNcComprasSinIva} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-gray-800">Retenciones IVA Emitidas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InputField label="Ret. IVA 20%" value={retIva20} onChange={setRetIva20} />
                <InputField label="Ret. IVA 30%" value={retIva30} onChange={setRetIva30} />
                <InputField label="Ret. IVA 70%" value={retIva70} onChange={setRetIva70} />
                <InputField label="Ret. IVA 100%" value={retIva100} onChange={setRetIva100} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-gray-800">Retenciones IR (Form. 103)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InputField label="Ret. IR 303" value={retIr303} onChange={setRetIr303} />
                <InputField label="Ret. IR 304" value={retIr304} onChange={setRetIr304} />
                <InputField label="Ret. IR 307" value={retIr307} onChange={setRetIr307} />
                <InputField label="Ret. IR 310" value={retIr310} onChange={setRetIr310} />
                <InputField label="Ret. IR 322" value={retIr322} onChange={setRetIr322} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-gray-800">Gastos de Personal</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InputField label="Sueldos y Salarios" value={sueldo} onChange={setSueldo} />
                <InputField label="Depreciaciones" value={depreciaciones} onChange={setDepreciaciones} />
                <InputField label="Gastos No Deducibles" value={gastosNoDeducibles} onChange={setGastosNoDeducibles} />
              </div>
            </CardContent>
          </Card>

          <div>
            <Label className="text-xs font-medium text-brand-gray-600">Observaciones</Label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full border rounded-md p-2 text-sm h-20"
            />
          </div>

          {resultado && (
            <Card className="bg-brand-red text-white">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-2">Resultado del C\u00e1lculo</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-white/60 text-xs">Total Ventas</p>
                    <p className="font-bold">${(resultado.totalVentas ?? resultado.total_ventas ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Total Compras</p>
                    <p className="font-bold">${(resultado.totalCompras ?? resultado.total_compras ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">IVA Causado</p>
                    <p className="font-bold">${(resultado.ivaCausado ?? resultado.iva_causado ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">IVA a Pagar</p>
                    <p className="font-bold">${(resultado.ivaAPagar ?? resultado.iva_a_pagar ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Cr\u00e9dito Tributario</p>
                    <p className="font-bold">${(resultado.creditoTributario ?? resultado.credito_tributario ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Cr\u00e9dito Pendiente</p>
                    <p className="font-bold">${(resultado.creditoPendiente ?? resultado.credito_pendiente ?? 0).toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleCalcular} disabled={calculando}>
              <Calculator className="w-4 h-4 mr-1" /> {calculando ? "Calculando..." : "Calcular"}
            </Button>
            <Button type="submit" disabled={submitting}>
              <Save className="w-4 h-4 mr-1" /> Guardar Declaraci\u00f3n
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}
