"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Calculator, FileSpreadsheet, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

interface RolFila {
  id: string;
  periodo: number;
  cedula: string;
  nombreCompleto: string;
  sueldo: number;
  aportePatronal?: number;
  aporteIndividual?: number;
  sueldoLiquido?: number;
  costoTotalEmpresa?: number;
}

export default function RolesPage() {
  const [items, setItems] = useState<RolFila[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [procesando, setProcesando] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/nomina/roles?periodo=${periodo}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast.error("Error al cargar roles de pago");
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  const handleCalcularRol = async () => {
    setProcesando(true);
    try {
      // 1. Obtener empleados activos
      const empRes = await apiFetch("/api/nomina/empleados");
      const empJson = await empRes.json();
      const listaEmp = empJson.data || [];

      if (listaEmp.length === 0) {
        toast.warning("No hay empleados en la ficha. Registra empleados primero.");
        setProcesando(false);
        return;
      }

      const empleadosCalculo = listaEmp.map((e: any) => ({
        cedula: e.cedula,
        nombreCompleto: e.nombre_completo,
        sueldoBase: parseFloat(e.sueldo || 0),
        diasTrabajados: 30,
      }));

      const res = await apiFetch("/api/nomina/roles", {
        method: "POST",
        body: JSON.stringify({
          periodo,
          empleados: empleadosCalculo,
        }),
      });

      if (!res.ok) throw new Error();
      toast.success("Rol de pagos del mes calculado exitosamente");
      load();
    } catch {
      toast.error("Error al calcular el rol de pagos");
    } finally {
      setProcesando(false);
    }
  };

  const totalSueldos = items.reduce((s, i) => s + Number(i.sueldo || 0), 0);
  const totalAporteInd = items.reduce((s, i) => s + Number(i.aporteIndividual || 0), 0);
  const totalAportePat = items.reduce((s, i) => s + Number(i.aportePatronal || 0), 0);
  const totalLiquido = items.reduce((s, i) => s + Number(i.sueldoLiquido || 0), 0);

  return (
    <>
      <title>Rol de Pagos Mensual - OFSERCONT IA</title>
      <Topbar title="Rol de Pagos Mensual" backLink={{ href: "/control-tributario", label: "Control Tributario" }} />

      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-gray-900">Procesamiento de Nómina del Mes</h1>
            <p className="text-xs text-brand-gray-500 mt-1">Cálculo de ingresos, deducción IESS 9.45%, aportes patronales y líquido a recibir.</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="Periodo YYYYMM"
              className="w-36 font-mono text-sm"
            />
            <Button onClick={load} variant="outline">
              <RotateCcw className="w-4 h-4 mr-1" /> Cargar
            </Button>
            <Button onClick={handleCalcularRol} disabled={procesando} className="bg-brand-red text-white hover:bg-brand-red-bright">
              <Calculator className={`w-4 h-4 mr-1.5 ${procesando ? "animate-spin" : ""}`} />
              {procesando ? "Procesando..." : "Calcular Rol del Mes"}
            </Button>
          </div>
        </div>

        {/* Resumen KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
            <div className="text-2xl font-extrabold text-brand-gray-900">${totalSueldos.toFixed(2)}</div>
            <div className="text-[11px] text-brand-gray-500 font-medium mt-1">Total Sueldos Brutos</div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
            <div className="text-2xl font-extrabold text-amber-700">${totalAporteInd.toFixed(2)}</div>
            <div className="text-[11px] text-brand-gray-500 font-medium mt-1">Aporte IESS Personal (9.45%)</div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
            <div className="text-2xl font-extrabold text-success">${totalAportePat.toFixed(2)}</div>
            <div className="text-[11px] text-brand-gray-500 font-medium mt-1">Aporte IESS Patronal (11.15%)</div>
          </div>
          <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
            <div className="text-2xl font-extrabold text-brand-red">${totalLiquido.toFixed(2)}</div>
            <div className="text-[11px] text-brand-gray-500 font-medium mt-1">Total Líquido a Pagar</div>
          </div>
        </div>

        {/* Tabla Rol */}
        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-brand-gray-400">Cargando rol de pagos del período...</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<FileSpreadsheet className="w-5 h-5" />}
              title={`No hay rol calculado para el período ${periodo}.`}
              description={'Haz clic en "Calcular Rol del Mes".'}
              compact
            />
          ) : (
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="bg-brand-gray-50 border-b text-left text-brand-gray-600 text-xs font-bold uppercase tracking-wider">
                  <TableHead className="py-3 px-4">Cédula</TableHead>
                  <TableHead className="py-3 px-4">Empleado</TableHead>
                  <TableHead className="py-3 px-4 text-right">Sueldo</TableHead>
                  <TableHead className="py-3 px-4 text-right">Aporte 9.45%</TableHead>
                  <TableHead className="py-3 px-4 text-right">Aporte 11.15%</TableHead>
                  <TableHead className="py-3 px-4 text-right font-bold">Líquido a Recibir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id || row.cedula} className="hover:bg-brand-gray-50 border-b border-brand-gray-100">
                    <TableCell className="py-3 px-4 font-mono text-xs text-brand-gray-700">{row.cedula}</TableCell>
                    <TableCell className="py-3 px-4 font-semibold text-brand-gray-900">{row.nombreCompleto}</TableCell>
                    <TableCell className="py-3 px-4 text-right font-medium text-brand-gray-900">${Number(row.sueldo || 0).toFixed(2)}</TableCell>
                    <TableCell className="py-3 px-4 text-right text-amber-700 font-medium">${Number(row.aporteIndividual || 0).toFixed(2)}</TableCell>
                    <TableCell className="py-3 px-4 text-right text-success font-medium">${Number(row.aportePatronal || 0).toFixed(2)}</TableCell>
                    <TableCell className="py-3 px-4 text-right font-bold text-brand-red">${Number(row.sueldoLiquido || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </>
  );
}
