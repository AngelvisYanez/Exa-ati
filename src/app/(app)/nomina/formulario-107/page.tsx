"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, FileText, Code2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

interface EmpleadoF107 {
  cedula: string;
  nombre_completo: string;
  sueldo: number;
}

export default function Formulario107Page() {
  const [empleados, setEmpleados] = useState<EmpleadoF107[]>([]);
  const [loading, setLoading] = useState(true);
  const [anioFiscal, setAnioFiscal] = useState("2025");
  const [generando, setGenerando] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/nomina/empleados");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setEmpleados(json.data || []);
    } catch {
      toast.error("Error al cargar empleados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDescargar107 = async (cedula: string, format: "pdf" | "xml") => {
    setGenerando(`${cedula}_${format}`);
    try {
      const res = await apiFetch("/api/nomina/formulario-107", {
        method: "POST",
        body: JSON.stringify({
          anioFiscal: parseInt(anioFiscal, 10),
          cedula,
          format,
        }),
      });

      if (!res.ok) throw new Error();

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Formulario107_${cedula}_${anioFiscal}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`Formulario 107 descargado en ${format.toUpperCase()}`);
    } catch {
      toast.error(`Error al generar Formulario 107 (${format.toUpperCase()})`);
    } finally {
      setGenerando(null);
    }
  };

  return (
    <>
      <title>Formulario 107 SRI - OFSERCONT IA</title>
      <Topbar title="Formulario 107 SRI (RDEP)" backLink={{ href: "/control-tributario", label: "Control Tributario" }} />

      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-gray-900">Formulario 107 SRI & Anexo RDEP</h1>
            <p className="text-xs text-brand-gray-500 mt-1">Comprobante de retención anual de Impuesto a la Renta por ingresos del trabajo en relación de dependencia.</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-xs font-semibold text-brand-gray-700">Año Fiscal:</span>
            <Input
              value={anioFiscal}
              onChange={(e) => setAnioFiscal(e.target.value)}
              className="w-28 font-mono text-sm"
              placeholder="2025"
            />
          </div>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-brand-gray-400">Cargando personal para Formulario 107...</div>
          ) : empleados.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={<FileText className="w-5 h-5" />}
                  title="No hay empleados en el sistema."
                  description="Registra personal en la sección de empleados primero."
                />
              </CardContent>
            </Card>
          ) : (
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="bg-brand-gray-50 border-b text-left text-brand-gray-600 text-xs font-bold uppercase tracking-wider">
                  <TableHead className="py-3 px-4">Cédula</TableHead>
                  <TableHead className="py-3 px-4">Nombre Completo</TableHead>
                  <TableHead className="py-3 px-4 text-right">Ingresos Proyectados ($)</TableHead>
                  <TableHead className="py-3 px-4 text-center">Acciones Formulario 107</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empleados.map((emp) => {
                  const s = Number(emp.sueldo || 0) * 12;
                  const keyPdf = `${emp.cedula}_pdf`;
                  const keyXml = `${emp.cedula}_xml`;

                  return (
                    <TableRow key={emp.cedula} className="hover:bg-brand-gray-50 border-b border-brand-gray-100">
                      <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-brand-gray-700">{emp.cedula}</TableCell>
                      <TableCell className="py-3 px-4 font-semibold text-brand-gray-900">{emp.nombre_completo}</TableCell>
                      <TableCell className="py-3 px-4 text-right font-bold text-brand-gray-900">${s.toFixed(2)}</TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDescargar107(emp.cedula, "pdf")}
                            disabled={generando === keyPdf}
                            className="text-brand-red border-brand-red/30 hover:bg-brand-red/10"
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            {generando === keyPdf ? "PDF..." : "Descargar PDF (F107)"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDescargar107(emp.cedula, "xml")}
                            disabled={generando === keyXml}
                            className="text-purple-700 border-purple-300 hover:bg-purple-50"
                          >
                            <Code2 className="w-4 h-4 mr-1" />
                            {generando === keyXml ? "XML..." : "Exportar RDEP (XML)"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </>
  );
}
