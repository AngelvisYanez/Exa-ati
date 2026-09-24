"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";

interface Obligacion {
  id: string;
  ruc: string;
  tipo: string;
  periodo: number;
  descripcion?: string;
  fechaVencimiento?: string;
  fechaDeclarado?: string;
  estado: string;
  vencida: boolean;
}

const estadoColors: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  EN_PROCESO: "bg-sky-100 text-brand-sky",
  CUMPLIDO: "bg-green-100 text-green-800",
  TARDIO: "bg-red-100 text-brand-red",
};

const tipoLabels: Record<string, string> = {
  IVA: "IVA",
  RET_IR: "Ret. IR",
  ATS: "ATS",
  IR_ANUAL: "IR Anual",
  ANTICIPO_IR: "Anticipo IR",
  IESS: "IESS",
};

export default function ObligacionesPage() {
  const [items, setItems] = useState<Obligacion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/control-tributario/obligaciones");
      if (!res.ok) throw new Error("Error");
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast.error("Error al cargar obligaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendientes = items.filter((o) => o.estado !== "CUMPLIDO");
  const cumplidas = items.filter((o) => o.estado === "CUMPLIDO");

  return (
    <>
      <title>Obligaciones - Control Tributario</title>
      <Topbar title="Obligaciones" backLink={{ href: "/control-tributario", label: "Control Tributario" }} />
      <main className="ui-page flex-1">
        <h1 className="text-xl font-bold text-brand-gray-800">Sem\u00e1foro de Obligaciones</h1>

        {loading ? (
          <p className="text-sm text-brand-gray-400">Cargando...</p>
        ) : (
          <>
            {pendientes.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-brand-gray-700 mb-2">Pendientes ({pendientes.length})</h2>
                <div className="space-y-2">
                  {pendientes.map((o) => (
                    <Card key={o.id} className={`border-l-4 ${o.vencida ? "border-l-red-500" : "border-l-yellow-400"}`}>
                      <CardContent className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono">{o.ruc}</span>
                            <Badge className={`text-[10px] ${estadoColors[o.estado] || ""}`}>{o.estado}</Badge>
                            {o.vencida && <Badge className="text-[10px] bg-red-100 text-brand-red">Vencida</Badge>}
                          </div>
                          <p className="text-sm font-medium mt-0.5">{tipoLabels[o.tipo] || o.tipo} - Periodo {o.periodo}</p>
                          {o.descripcion && <p className="text-xs text-brand-gray-500">{o.descripcion}</p>}
                        </div>
                        <div className="text-xs text-right text-brand-gray-500 shrink-0">
                          {o.fechaVencimiento && (
                            <p>Vence: {new Date(o.fechaVencimiento).toLocaleDateString()}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {cumplidas.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-brand-gray-700 mb-2">Cumplidas ({cumplidas.length})</h2>
                <div className="space-y-2">
                  {cumplidas.map((o) => (
                    <Card key={o.id} className="border-l-4 border-l-green-400 opacity-70">
                      <CardContent className="p-3 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono">{o.ruc}</span>
                            <Badge className="text-[10px] bg-green-100 text-green-800">CUMPLIDO</Badge>
                          </div>
                          <p className="text-sm font-medium mt-0.5">{tipoLabels[o.tipo] || o.tipo} - Periodo {o.periodo}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 && (
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={<CalendarCheck className="w-5 h-5" />}
                    title="No hay obligaciones registradas."
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}
