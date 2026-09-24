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

        <Card className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label className="text-[10px]">Desde</Label>
              <Input type="date" size={1} value={desde} onChange={(e) => setDesde(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Hasta</Label>
              <Input type="date" size={1} value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-8 text-xs" />
            </div>
            <Button size="sm" onClick={loadBalance}>Filtrar</Button>
          </div>
        </Card>

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
              {loading ? (
                <TableRow><TableCell colSpan={5} className="p-6"><TableSkeleton rows={4} columns={5} /></TableCell></TableRow>
              ) : !balance || balance.cuentas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={<Scale className="w-5 h-5" />}
                      title="Sin movimientos contables"
                      compact
                    />
                  </TableCell>
                </TableRow>
              ) : balance.cuentas.map((c) => (
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
        </Card>
      </main>
    </>
  );
}
