"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";

interface ResumenIR {
  id: string;
  anio: number;
  ruc: string;
  utilidadAntesParticipacion?: number;
  utilidadGravable?: number;
  impuestoCausado?: number;
  irAPagar?: number;
  saldoAFavor?: number;
  createdAt: string;
}

export default function ResumenIRPage() {
  const [items, setItems] = useState<ResumenIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [anio, setAnio] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (anio) params.set("anio", anio);
      const res = await apiFetch(`/api/control-tributario/resumen-ir?${params}`);
      if (!res.ok) throw new Error("Error");
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast.error("Error al cargar res\u00famenes IR");
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <title>Resumen Anual IR - Control Tributario</title>
      <Topbar title="Resumen Anual IR" backLink={{ href: "/control-tributario", label: "Control Tributario" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-xl font-bold text-brand-gray-800">Resumen Anual Impuesto a la Renta</h1>
          <div className="flex gap-2">
            <Input
              placeholder="A\u00f1o (YYYY)"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              className="w-28"
            />
            <Button variant="outline" size="icon" onClick={load}>
              <Search className="w-4 h-4" />
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-1" /> Nuevo
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-brand-gray-400">Cargando...</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState title="No hay res\u00famenes de IR registrados." />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((item) => (
              <Card key={item.id} className="border-brand-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    A\u00f1o {item.anio}
                  </CardTitle>
                  <p className="text-xs text-brand-gray-500">RUC: {item.ruc}</p>
                </CardHeader>
                <CardContent className="text-xs space-y-1 text-brand-gray-600">
                  <div className="flex justify-between">
                    <span>Utilidad Gravable:</span>
                    <span className="font-medium">${Number(item.utilidadGravable ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Impuesto Causado:</span>
                    <span className="font-medium">${Number(item.impuestoCausado ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IR a Pagar:</span>
                    <span className="font-medium">${Number(item.irAPagar ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saldo a Favor:</span>
                    <span className="font-medium">${Number(item.saldoAFavor ?? 0).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
