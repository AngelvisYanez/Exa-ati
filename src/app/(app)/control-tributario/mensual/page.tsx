"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import ListToolbar from "@/components/lists/ListToolbar";
import { useViewMode } from "@/components/lists/useViewMode";
import { toast } from "sonner";
import { Plus, Search, Calculator, RotateCcw } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";

interface Mensual {
  id: string;
  periodo: number;
  ruc: string;
  totalVentas?: number;
  totalCompras?: number;
  ivaCausado?: number;
  ivaAPagar?: number;
  creditoPendiente?: number;
  createdAt: string;
}

export default function MensualPage() {
  const [items, setItems] = useState<Mensual[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const [periodo, setPeriodo] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useViewMode("ct-mensual");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (periodo) params.set("periodo", periodo);
      const res = await apiFetch(`/api/control-tributario/mensual?${params}`);
      if (!res.ok) throw new Error("Error");
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast.error("Error al cargar declaraciones mensuales");
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  const handleRecalcular = async () => {
    setRecalculando(true);
    try {
      let count = 0;
      for (const item of items) {
        if (!item.ruc) continue;
        const res = await apiFetch("/api/control-tributario/recalcular", {
          method: "POST",
          body: JSON.stringify({ modulo: "mensual", periodo: item.periodo, ruc: item.ruc }),
        });
        if (res.ok) count++;
      }
      toast.success(`${count} declaraciones recalculadas`);
      load();
    } catch {
      toast.error("Error al recalcular");
    } finally {
      setRecalculando(false);
    }
  };

  const q = search.trim().toLowerCase();
  const visibles = q
    ? items.filter((item) =>
        `${item.periodo} ${item.ruc}`.toLowerCase().includes(q)
      )
    : items;

  return (
    <>
      <title>Declaraci\u00f3n Mensual - Control Tributario</title>
      <Topbar title="Declaraci\u00f3n Mensual" backLink={{ href: "/control-tributario", label: "Control Tributario" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-xl font-bold text-brand-gray-800">Declaraciones Mensuales 104/103</h1>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Periodo (YYYYMM)"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-36"
            />
            <Button variant="outline" size="icon" onClick={load}>
              <Search className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={handleRecalcular} disabled={recalculando || items.length === 0}>
              <RotateCcw className={`w-4 h-4 mr-1 ${recalculando ? "animate-spin" : ""}`} />
              Recalcular
            </Button>
            <Link href="/control-tributario/mensual/nueva">
              <Button>
                <Plus className="w-4 h-4 mr-1" /> Nueva
              </Button>
            </Link>
          </div>
        </div>

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar por periodo o RUC..."
          view={view}
          onViewChange={setView}
        />

        {loading ? (
          <p className="text-sm text-brand-gray-400">Cargando...</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<Calculator className="w-5 h-5" />}
                title="No hay declaraciones registradas."
                action={
                  <Link href="/control-tributario/mensual/nueva" className="text-brand-red underline">
                    Crear primera declaraci\u00f3n
                  </Link>
                }
              />
            </CardContent>
          </Card>
        ) : visibles.length === 0 ? (
          <p className="text-sm text-brand-gray-400">Ningún resultado para la búsqueda.</p>
        ) : view === "cuadricula" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibles.map((item) => (
              <Card key={item.id} className="border-brand-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Periodo {item.periodo}</CardTitle>
                  <p className="text-xs text-brand-gray-500">RUC: {item.ruc}</p>
                </CardHeader>
                <CardContent className="text-xs space-y-1 text-brand-gray-600">
                  <div className="flex justify-between">
                    <span>Ventas:</span>
                    <span className="font-medium">${Number(item.totalVentas ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Compras:</span>
                    <span className="font-medium">${Number(item.totalCompras ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-brand-red font-semibold pt-1 border-t">
                    <span>IVA a Pagar:</span>
                    <span>${Number(item.ivaAPagar ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-amber-600">
                    <span>Cr\u00e9dito Pendiente:</span>
                    <span>${Number(item.creditoPendiente ?? 0).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto bg-white border border-brand-gray-200 rounded-xl">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="border-b text-left text-brand-gray-500 text-xs uppercase tracking-wider">
                  <TableHead className="py-2 px-3">Periodo</TableHead>
                  <TableHead className="py-2 px-3">RUC</TableHead>
                  <TableHead className="py-2 px-3 text-right">Ventas</TableHead>
                  <TableHead className="py-2 px-3 text-right">Compras</TableHead>
                  <TableHead className="py-2 px-3 text-right">IVA a pagar</TableHead>
                  <TableHead className="py-2 px-3 text-right">Crédito pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((item) => (
                  <TableRow key={item.id} className="border-b hover:bg-gray-50">
                    <TableCell className="py-2 px-3 font-medium">{item.periodo}</TableCell>
                    <TableCell className="py-2 px-3 font-mono text-xs">{item.ruc}</TableCell>
                    <TableCell className="py-2 px-3 text-right">${Number(item.totalVentas ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="py-2 px-3 text-right">${Number(item.totalCompras ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="py-2 px-3 text-right font-semibold text-brand-red">${Number(item.ivaAPagar ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="py-2 px-3 text-right text-amber-600">${Number(item.creditoPendiente ?? 0).toFixed(2)}</TableCell>
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
