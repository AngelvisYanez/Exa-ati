"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import ListToolbar from "@/components/lists/ListToolbar";
import { useViewMode } from "@/components/lists/useViewMode";
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

function ObligacionTable({ rows }: { rows: Obligacion[] }) {
  return (
    <div className="overflow-x-auto bg-white border border-brand-gray-200 rounded-xl">
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow className="border-b text-left text-brand-gray-500 text-xs uppercase tracking-wider">
            <TableHead className="py-2 px-3">RUC</TableHead>
            <TableHead className="py-2 px-3">Tipo</TableHead>
            <TableHead className="py-2 px-3">Periodo</TableHead>
            <TableHead className="py-2 px-3">Estado</TableHead>
            <TableHead className="py-2 px-3">Descripción</TableHead>
            <TableHead className="py-2 px-3">Vence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.id} className="border-b hover:bg-gray-50">
              <TableCell className="py-2 px-3 font-mono text-xs">{o.ruc}</TableCell>
              <TableCell className="py-2 px-3">{tipoLabels[o.tipo] || o.tipo}</TableCell>
              <TableCell className="py-2 px-3">{o.periodo}</TableCell>
              <TableCell className="py-2 px-3">
                <div className="flex items-center gap-1">
                  <Badge className={`text-[10px] ${estadoColors[o.estado] || ""}`}>{o.estado}</Badge>
                  {o.vencida && <Badge className="text-[10px] bg-red-100 text-brand-red">Vencida</Badge>}
                </div>
              </TableCell>
              <TableCell className="py-2 px-3 text-xs text-brand-gray-500">{o.descripcion || "—"}</TableCell>
              <TableCell className="py-2 px-3 text-xs text-brand-gray-500">
                {o.fechaVencimiento ? new Date(o.fechaVencimiento).toLocaleDateString() : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ObligacionesPage() {
  const [items, setItems] = useState<Obligacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useViewMode("ct-obligaciones");

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

  const q = search.trim().toLowerCase();
  const matches = (o: Obligacion) =>
    !q ||
    `${o.ruc} ${o.tipo} ${tipoLabels[o.tipo] || ""} ${o.descripcion || ""} ${o.estado} ${o.periodo}`.toLowerCase().includes(q);
  const pendientes = items.filter((o) => o.estado !== "CUMPLIDO" && matches(o));
  const cumplidas = items.filter((o) => o.estado === "CUMPLIDO" && matches(o));

  return (
    <>
      <title>Obligaciones - Control Tributario</title>
      <Topbar title="Obligaciones" backLink={{ href: "/control-tributario", label: "Control Tributario" }} />
      <main className="ui-page flex-1">
        <h1 className="text-xl font-bold text-brand-gray-800">Sem\u00e1foro de Obligaciones</h1>

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar por RUC, tipo o estado..."
          view={view}
          onViewChange={setView}
        />

        {loading ? (
          <p className="text-sm text-brand-gray-400">Cargando...</p>
        ) : (
          <>
            {pendientes.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-brand-gray-700 mb-2">Pendientes ({pendientes.length})</h2>
                {view === "cuadricula" ? (
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
                ) : (
                  <ObligacionTable rows={pendientes} />
                )}
              </div>
            )}

            {cumplidas.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-brand-gray-700 mb-2">Cumplidas ({cumplidas.length})</h2>
                {view === "cuadricula" ? (
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
                ) : (
                  <ObligacionTable rows={cumplidas} />
                )}
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
            {items.length > 0 && pendientes.length === 0 && cumplidas.length === 0 && (
              <p className="text-sm text-brand-gray-400">Ningún resultado para la búsqueda.</p>
            )}
          </>
        )}
      </main>
    </>
  );
}
