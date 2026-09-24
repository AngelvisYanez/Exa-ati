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
import { Plus, RefreshCw, ArrowLeft, BookOpen, Wand2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

interface AsientoLinea {
  id?: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: string | number;
  haber: string | number;
  orden?: number;
}

interface Asiento {
  id: string;
  fecha: string;
  numero: number;
  glosa: string;
  origen: string;
  estado: string;
  lineas: AsientoLinea[];
}

interface LineaForm {
  cuentaCodigo: string;
  cuentaNombre: string;
  debe: string;
  haber: string;
}

const emptyLinea = (): LineaForm => ({
  cuentaCodigo: "",
  cuentaNombre: "",
  debe: "0",
  haber: "0",
});

export default function DiarioPage() {
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [glosa, setGlosa] = useState("");
  const [lineas, setLineas] = useState<LineaForm[]>([emptyLinea(), emptyLinea()]);
  const [periodoGen, setPeriodoGen] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const loadAsientos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/contabilidad/asientos?limite=100");
      const data = await res.json();
      if (res.ok) setAsientos(data.data || []);
    } catch {
      toast.error("Error al cargar asientos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAsientos();
  }, [loadAsientos]);

  function updateLinea(idx: number, field: keyof LineaForm, value: string) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function addLinea() {
    setLineas((prev) => [...prev, emptyLinea()]);
  }

  function removeLinea(idx: number) {
    if (lineas.length <= 2) return;
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalDebe = lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0);
  const totalHaber = lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
  const cuadra = Math.abs(totalDebe - totalHaber) < 0.01;

  async function handleSave() {
    if (!fecha || !glosa) {
      toast.error("Fecha y glosa son obligatorios");
      return;
    }
    if (!cuadra) {
      toast.error("El asiento debe cuadrar (debe = haber)");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/contabilidad/asientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          glosa,
          lineas: lineas.map((l) => ({
            cuentaCodigo: l.cuentaCodigo,
            cuentaNombre: l.cuentaNombre,
            debe: parseFloat(l.debe) || 0,
            haber: parseFloat(l.haber) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("Asiento registrado");
      setShowForm(false);
      setGlosa("");
      setLineas([emptyLinea(), emptyLinea()]);
      loadAsientos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerar() {
    if (!periodoGen || periodoGen.length !== 6) {
      toast.error("Periodo debe ser YYYYMM");
      return;
    }
    setGenerando(true);
    try {
      const res = await apiFetch("/api/contabilidad/asientos/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: parseInt(periodoGen, 10) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(`${data.data.generados} asiento(s) generado(s)`);
      loadAsientos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al generar");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <title>Libro Diario - OFSERCONT IA</title>
      <Topbar title="Libro Diario" />
      <main className="ui-page flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/contabilidad">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Contabilidad
            </Button>
          </Link>
          <Link href="/contabilidad/balance">
            <Button variant="outline" size="sm">
              <BookOpen className="w-3.5 h-3.5 mr-1" /> Balance
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={loadAsientos}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
          </Button>
          <Button
            size="sm"
            className="bg-brand-red hover:bg-brand-red-bright text-white ml-auto"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo Asiento
          </Button>
        </div>

        <Card className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label className="text-[10px]">Periodo (YYYYMM)</Label>
              <Input
                size={1}
                value={periodoGen}
                onChange={(e) => setPeriodoGen(e.target.value)}
                className="h-8 text-xs w-28"
                placeholder="202601"
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleGenerar} disabled={generando}>
              <Wand2 className="w-3.5 h-3.5 mr-1" />
              {generando ? "Generando..." : "Generar desde comprobantes"}
            </Button>
          </div>
        </Card>

        {showForm && (
          <Card className="p-4 border-brand-red/30">
            <h3 className="text-sm font-bold mb-3">Nuevo asiento contable</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <Label className="text-[10px]">Fecha</Label>
                <Input type="date" size={1} value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Glosa</Label>
                <Input size={1} value={glosa} onChange={(e) => setGlosa(e.target.value)} className="h-8 text-xs" placeholder="Descripción del asiento" />
              </div>
            </div>

            <Table className="text-xs mb-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input size={1} value={l.cuentaCodigo} onChange={(e) => updateLinea(idx, "cuentaCodigo", e.target.value)} className="h-7 text-xs" placeholder="1.1.01" />
                    </TableCell>
                    <TableCell>
                      <Input size={1} value={l.cuentaNombre} onChange={(e) => updateLinea(idx, "cuentaNombre", e.target.value)} className="h-7 text-xs" placeholder="Nombre cuenta" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" size={1} value={l.debe} onChange={(e) => updateLinea(idx, "debe", e.target.value)} className="h-7 text-xs text-right" min={0} step={0.01} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" size={1} value={l.haber} onChange={(e) => updateLinea(idx, "haber", e.target.value)} className="h-7 text-xs text-right" min={0} step={0.01} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="xs" onClick={() => removeLinea(idx)} disabled={lineas.length <= 2}>×</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between">
              <div className="text-xs">
                <span className="font-mono">Debe: ${totalDebe.toFixed(2)}</span>
                {" · "}
                <span className="font-mono">Haber: ${totalHaber.toFixed(2)}</span>
                {" · "}
                <Badge className={cuadra ? "bg-success-pale text-success" : "bg-red-100 text-brand-red"}>
                  {cuadra ? "Cuadrado" : "Descuadrado"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addLinea}>+ Línea</Button>
                <Button size="sm" className="bg-brand-red hover:bg-brand-red-bright text-white" onClick={handleSave} disabled={saving || !cuadra}>
                  {saving ? "Guardando..." : "Registrar"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-0 overflow-hidden">
          <Table className="w-full text-xs">
            <TableHeader>
              <TableRow className="bg-brand-gray-50">
                <TableHead className="p-3">#</TableHead>
                <TableHead className="p-3">Fecha</TableHead>
                <TableHead className="p-3">Glosa</TableHead>
                <TableHead className="p-3">Origen</TableHead>
                <TableHead className="p-3">Estado</TableHead>
                <TableHead className="p-3 text-right">Debe</TableHead>
                <TableHead className="p-3 text-right">Haber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="p-6"><TableSkeleton rows={4} columns={6} /></TableCell></TableRow>
              ) : asientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={<BookOpen className="w-5 h-5" />}
                      title="No hay asientos registrados"
                      compact
                    />
                  </TableCell>
                </TableRow>
              ) : asientos.map((a) => {
                const debe = a.lineas?.reduce((s, l) => s + Number(l.debe || 0), 0) ?? 0;
                const haber = a.lineas?.reduce((s, l) => s + Number(l.haber || 0), 0) ?? 0;
                return (
                  <TableRow key={a.id} className="border-b hover:bg-brand-gray-50">
                    <TableCell className="p-3 font-mono font-bold">{a.numero}</TableCell>
                    <TableCell className="p-3">{String(a.fecha).slice(0, 10)}</TableCell>
                    <TableCell className="p-3">{a.glosa}</TableCell>
                    <TableCell className="p-3"><Badge variant="outline">{a.origen}</Badge></TableCell>
                    <TableCell className="p-3"><Badge>{a.estado}</Badge></TableCell>
                    <TableCell className="p-3 text-right font-mono">${debe.toFixed(2)}</TableCell>
                    <TableCell className="p-3 text-right font-mono">${haber.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </main>
    </>
  );
}
