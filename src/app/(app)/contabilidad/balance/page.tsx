"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import ListToolbar from "@/components/lists/ListToolbar";
import { RecordCard, RecordGrid } from "@/components/lists/RecordGrid";
import { useViewMode } from "@/components/lists/useViewMode";
import { toast } from "sonner";
import { RefreshCw, ArrowLeft, Scale } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

interface CuentaBalance {
  cuentaCodigo: string;
  cuentaNombre: string;
  debe: number;
  haber: number;
  saldo: number;
}

interface BalanceData {
  cuentas: CuentaBalance[];
  totales: { debe: number; haber: number };
  cuadra: boolean;
}

export default function BalancePage() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useViewMode("balance");

  const loadBalance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await apiFetch(`/api/contabilidad/balance?${params}`);
      const data = await res.json();
      if (res.ok) setBalance(data.data);
      else throw new Error(data.message);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al cargar balance");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const cuentas = balance?.cuentas ?? [];
  const q = search.trim().toLowerCase();
  const visibleCuentas = q
    ? cuentas.filter((c) =>
        [c.cuentaCodigo, c.cuentaNombre, c.debe.toFixed(2), c.haber.toFixed(2), c.saldo.toFixed(2)].some((v) =>
          v.toLowerCase().includes(q)
        )
      )
    : cuentas;

  return (
    <>
      <title>Balance de Comprobación - OFSERCONT IA</title>
      <Topbar title="Balance de Comprobación" />
      <main className="ui-page flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/contabilidad">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Contabilidad
            </Button>
          </Link>
          <Link href="/contabilidad/diario">
            <Button variant="outline" size="sm">
              Libro Diario
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={loadBalance}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
          </Button>
        </div>

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar cuenta..."
          view={view}
          onViewChange={setView}
        >
          <div>
            <Label className="text-[10px]">Desde</Label>
            <Input type="date" size={1} value={desde} onChange={(e) => setDesde(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Hasta</Label>
            <Input type="date" size={1} value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-8 text-xs" />
          </div>
          <Button size="sm" onClick={loadBalance}>Filtrar</Button>
        </ListToolbar>

        {balance && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-3 flex items-center gap-3">
              <Scale className="w-5 h-5 text-brand-sky" />
              <div>
                <p className="text-[10px] text-brand-gray-500 uppercase font-bold">Total Debe</p>
                <p className="text-lg font-bold font-mono">${balance.totales.debe.toFixed(2)}</p>
              </div>
            </Card>
            <Card className="p-3 flex items-center gap-3">
              <Scale className="w-5 h-5 text-success" />
              <div>
                <p className="text-[10px] text-brand-gray-500 uppercase font-bold">Total Haber</p>
                <p className="text-lg font-bold font-mono">${balance.totales.haber.toFixed(2)}</p>
              </div>
            </Card>
            <Card className="p-3 flex items-center gap-3">
              <Badge className={balance.cuadra ? "bg-success-pale text-success" : "bg-red-100 text-brand-red"}>
                {balance.cuadra ? "Cuadrado" : "Descuadrado"}
              </Badge>
              <p className="text-xs text-brand-gray-500">{balance.cuentas.length} cuentas con movimiento</p>
            </Card>
          </div>
        )}

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6">
              <TableSkeleton rows={4} columns={5} />
            </div>
          ) : !balance || visibleCuentas.length === 0 ? (
            <EmptyState
              icon={<Scale className="w-5 h-5" />}
              title="Sin movimientos contables"
              compact
            />
          ) : view === "cuadricula" ? (
            <div className="p-3">
              <RecordGrid>
                {visibleCuentas.map((c) => (
                  <RecordCard
                    key={c.cuentaCodigo}
                    title={c.cuentaNombre}
                    subtitle={c.cuentaCodigo}
                    fields={[
                      { label: "Debe", value: `$${c.debe.toFixed(2)}` },
                      { label: "Haber", value: `$${c.haber.toFixed(2)}` },
                      { label: "Saldo", value: `$${c.saldo.toFixed(2)}` },
                    ]}
                  />
                ))}
              </RecordGrid>
            </div>
          ) : (
            <Table className="w-full text-xs">
              <TableHeader>
                <TableRow className="bg-brand-gray-50">
                  <TableHead className="p-3">Código</TableHead>
                  <TableHead className="p-3">Cuenta</TableHead>
                  <TableHead className="p-3 text-right">Debe</TableHead>
                  <TableHead className="p-3 text-right">Haber</TableHead>
                  <TableHead className="p-3 text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCuentas.map((c) => (
                  <TableRow key={c.cuentaCodigo} className="border-b hover:bg-brand-gray-50">
                    <TableCell className="p-3 font-mono font-bold">{c.cuentaCodigo}</TableCell>
                    <TableCell className="p-3">{c.cuentaNombre}</TableCell>
                    <TableCell className="p-3 text-right font-mono">${c.debe.toFixed(2)}</TableCell>
                    <TableCell className="p-3 text-right font-mono">${c.haber.toFixed(2)}</TableCell>
                    <TableCell className="p-3 text-right font-mono font-bold">${c.saldo.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>
    </>
  );
}
