"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Trash2, CloudDownload, RotateCcw, X } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";

interface Planilla {
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

function mapPlanilla(row: any): Planilla {
  return {
    id: String(row.id),
    periodo: Number(row.periodo),
    cedula: row.cedula ?? "",
    nombreCompleto: row.nombreCompleto ?? row.nombre_completo ?? "",
    sueldo: Number(row.sueldo ?? 0),
    aportePatronal: Number(row.aportePatronal ?? row.aporte_patronal ?? 0),
    aporteIndividual: Number(row.aporteIndividual ?? row.aporte_individual ?? 0),
    sueldoLiquido: Number(row.sueldoLiquido ?? row.sueldo_liquido ?? 0),
    costoTotalEmpresa: Number(row.costoTotalEmpresa ?? row.costo_total_empresa ?? 0),
  };
}

const IESS_CREDS_KEY = "v1:iessCreds";

function loadSavedCedula(): string {
  try {
    const raw = localStorage.getItem(IESS_CREDS_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return typeof parsed?.cedula === "string" ? parsed.cedula : "";
  } catch {
    return "";
  }
}

export default function PlanillasIESSPage() {
  const [items, setItems] = useState<Planilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [scraping, setScraping] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [showCreds, setShowCreds] = useState(false);
  const [cedulaIess, setCedulaIess] = useState("");
  const [passwordIess, setPasswordIess] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    cedula: "",
    nombreCompleto: "",
    sueldo: "",
    diasTrabajados: "30",
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setCedulaIess(loadSavedCedula());
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (periodo) params.set("periodo", periodo);
      const res = await apiFetch(`/api/control-tributario/planillas?${params}`);
      if (!res.ok) throw new Error("Error");
      const json = await res.json();
      setItems((json.data || []).map(mapPlanilla));
    } catch {
      toast.error("Error al cargar planillas IESS");
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    load();
  }, [load]);

  const handleScrapear = async () => {
    if (!periodo || !/^\d{6}$/.test(periodo)) {
      toast.warning("Ingrese un periodo válido (YYYYMM)");
      return;
    }
    if (!cedulaIess.trim() || !passwordIess) {
      setShowCreds(true);
      toast.warning("Ingrese cédula/RUC y contraseña del portal IESS");
      return;
    }
    setScraping(true);
    try {
      try {
        localStorage.setItem(
          IESS_CREDS_KEY,
          JSON.stringify({ cedula: cedulaIess.trim() }),
        );
      } catch {
        /* ignore */
      }

      const res = await apiFetch("/api/control-tributario/scrapear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fuente: "IESS",
          periodo: parseInt(periodo, 10),
          ruc: cedulaIess.trim(),
          password: passwordIess,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Error al scrapear IESS");
      toast.success(
        `Scraping completado: ${json.results?.[0]?.registros ?? 0} registros`,
      );
      setShowCreds(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al scrapear IESS");
    } finally {
      setScraping(false);
    }
  };

  const handleRecalcular = async () => {
    if (!periodo) {
      toast.warning("Seleccione un periodo");
      return;
    }
    setRecalculando(true);
    try {
      const res = await apiFetch("/api/control-tributario/recalcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulo: "planillas", periodo: parseInt(periodo, 10) }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success("Totales recalculados");
      load();
    } catch {
      toast.error("Error al recalcular");
    } finally {
      setRecalculando(false);
    }
  };

  const handleDelete = async (cedula: string, nombre: string) => {
    if (!confirm(`¿Eliminar a "${nombre}"?`)) return;
    try {
      const res = await apiFetch(
        `/api/control-tributario/planillas?cedula=${encodeURIComponent(cedula)}&periodo=${periodo}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Error");
      toast.success("Registro eliminado");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const handleAdd = async () => {
    if (!periodo || !addForm.cedula || !addForm.nombreCompleto || !addForm.sueldo) {
      toast.warning("Complete cédula, nombre, sueldo y periodo");
      return;
    }
    setAdding(true);
    try {
      const res = await apiFetch("/api/control-tributario/planillas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo: parseInt(periodo, 10),
          cedula: addForm.cedula.trim(),
          nombreCompleto: addForm.nombreCompleto.trim(),
          sueldo: parseFloat(addForm.sueldo),
          diasTrabajados: parseInt(addForm.diasTrabajados || "30", 10),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Error al guardar");
      toast.success("Empleado agregado a la planilla");
      setShowAdd(false);
      setAddForm({ cedula: "", nombreCompleto: "", sueldo: "", diasTrabajados: "30" });
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al agregar");
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <title>Planillas IESS - Control Tributario</title>
      <Topbar title="Planillas IESS" backLink={{ href: "/control-tributario", label: "Control Tributario" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-gray-800">Planillas IESS</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">
              Importa desde el portal Empleadores con cédula/RUC y clave IESS
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Periodo (YYYYMM)"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-36"
            />
            <Button variant="outline" size="icon" onClick={load} aria-label="Buscar">
              <Search className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCreds((v) => !v)}
              disabled={scraping}
            >
              <CloudDownload className={`w-4 h-4 mr-1 ${scraping ? "animate-bounce" : ""}`} />
              {scraping ? "Scrapeando..." : "Scraping IESS"}
            </Button>
            <Button
              variant="outline"
              onClick={handleRecalcular}
              disabled={recalculando || items.length === 0}
            >
              <RotateCcw className={`w-4 h-4 mr-1 ${recalculando ? "animate-spin" : ""}`} />
              Recalcular
            </Button>
            <Button onClick={() => setShowAdd((v) => !v)}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          </div>
        </div>

        {showCreds && (
          <Card className="border-brand-gray-200">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-brand-gray-800">
                  Credenciales portal IESS (Empleadores)
                </h2>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowCreds(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-brand-gray-500">
                Use la cédula o RUC del empleador y la clave del portal{" "}
                <span className="font-mono">empleador-web</span> (no la clave SRI).
              </p>
              <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase text-brand-gray-500">
                    Cédula / RUC empleador
                  </Label>
                  <Input
                    value={cedulaIess}
                    onChange={(e) => setCedulaIess(e.target.value.replace(/\D/g, "").slice(0, 13))}
                    placeholder="0102030405"
                    autoComplete="username"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase text-brand-gray-500">
                    Contraseña IESS
                  </Label>
                  <Input
                    type="password"
                    value={passwordIess}
                    onChange={(e) => setPasswordIess(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button
                onClick={handleScrapear}
                disabled={scraping}
                className="bg-brand-red hover:bg-brand-red-bright text-white self-start"
              >
                {scraping ? "Conectando al IESS..." : "Iniciar scraping"}
              </Button>
            </CardContent>
          </Card>
        )}

        {showAdd && (
          <Card className="border-brand-gray-200">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-brand-gray-800">Agregar empleado a planilla</h2>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowAdd(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase text-brand-gray-500">Cédula</Label>
                  <Input
                    value={addForm.cedula}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, cedula: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase text-brand-gray-500">Nombre</Label>
                  <Input
                    value={addForm.nombreCompleto}
                    onChange={(e) => setAddForm((f) => ({ ...f, nombreCompleto: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase text-brand-gray-500">Sueldo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={addForm.sueldo}
                    onChange={(e) => setAddForm((f) => ({ ...f, sueldo: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase text-brand-gray-500">Días</Label>
                  <Input
                    type="number"
                    value={addForm.diasTrabajados}
                    onChange={(e) => setAddForm((f) => ({ ...f, diasTrabajados: e.target.value }))}
                  />
                </div>
              </div>
              <Button
                onClick={handleAdd}
                disabled={adding}
                className="bg-brand-red hover:bg-brand-red-bright text-white self-start"
              >
                {adding ? "Guardando..." : "Guardar"}
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-brand-gray-400">Cargando...</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<CloudDownload className="w-5 h-5" />}
                title="No hay planillas registradas para este periodo."
                description='Use "Scraping IESS" con cédula y clave del portal, o agregue empleados manualmente.'
              />
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="border-b text-left text-brand-gray-500 text-xs uppercase tracking-wider">
                  <TableHead className="py-2 pr-2">Cédula</TableHead>
                  <TableHead className="py-2 pr-2">Nombre</TableHead>
                  <TableHead className="py-2 pr-2 text-right">Sueldo</TableHead>
                  <TableHead className="py-2 pr-2 text-right">A. Patronal</TableHead>
                  <TableHead className="py-2 pr-2 text-right">A. Individual</TableHead>
                  <TableHead className="py-2 pr-2 text-right">S. Líquido</TableHead>
                  <TableHead className="py-2 pr-2 text-right">Costo Empresa</TableHead>
                  <TableHead className="py-2 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id} className="border-b hover:bg-gray-50">
                    <TableCell className="py-2 pr-2 font-mono text-xs">{p.cedula}</TableCell>
                    <TableCell className="py-2 pr-2 font-medium">{p.nombreCompleto}</TableCell>
                    <TableCell className="py-2 pr-2 text-right">${Number(p.sueldo).toFixed(2)}</TableCell>
                    <TableCell className="py-2 pr-2 text-right">
                      ${Number(p.aportePatronal ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="py-2 pr-2 text-right">
                      ${Number(p.aporteIndividual ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="py-2 pr-2 text-right">
                      ${Number(p.sueldoLiquido ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="py-2 pr-2 text-right">
                      ${Number(p.costoTotalEmpresa ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 text-red-500"
                        onClick={() => handleDelete(p.cedula, p.nombreCompleto)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </>
  );
}
