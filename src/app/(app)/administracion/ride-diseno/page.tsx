"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { SuperadminOnly } from "@/components/admin/SuperadminOnly";
import ListToolbar from "@/components/lists/ListToolbar";
import { RecordCard, RecordGrid } from "@/components/lists/RecordGrid";
import { useViewMode } from "@/components/lists/useViewMode";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import { FileText, Plus, Loader2, Eye, Check } from "lucide-react";

interface DisenoRow {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  plantilla: string;
  esPredeterminado: boolean;
  esSistema: boolean;
}

const PLANTILLA_LABEL: Record<string, string> = {
  clasico: "Clásico SRI",
  compacto: "Compacto",
  banda: "Banda de marca",
};

function RideDisenoList() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DisenoRow[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useViewMode("ride-diseno");

  const load = async () => {
    try {
      const res = await apiFetch("/api/admin/ride-diseno");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error");
      setRows(data.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los diseños");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activar = async (codigo: string) => {
    try {
      const res = await apiFetch("/api/admin/ride-diseno", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "activar", codigo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudo activar");
      toast.success("Este diseño se usará en los RIDE");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al activar");
    }
  };

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter((row) =>
        [row.nombre, row.codigo, row.descripcion, row.plantilla].some((value) =>
          String(value ?? "").toLowerCase().includes(q)
        )
      )
    : rows;

  return (
    <>
      <Topbar title="Diseño RIDE" backLink={{ href: "/administracion", label: "Admin" }} />
      <main className="ui-page flex-1 max-w-5xl mx-auto">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800 flex items-center gap-2">
              <FileText className="size-5 text-brand-red" />
              Diseño del RIDE
            </h1>
            <p className="text-xs text-brand-gray-500 mt-1">
              Elige una plantilla, edítala y mira la vista previa. El diseño en uso se aplica a todas las facturas.
              Solo el superadmin puede cambiarlo.
            </p>
          </div>
          <Link href="/administracion/ride-diseno/nuevo">
            <Button className="bg-brand-red hover:bg-brand-red-bright text-white">
              <Plus className="size-4" />
              Nuevo diseño
            </Button>
          </Link>
        </div>

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar diseño..."
          view={view}
          onViewChange={setView}
        />

        {loading ? (
          <div className="flex justify-center py-16 text-brand-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-brand-gray-500">No hay diseños.</p>
        ) : view === "cuadricula" ? (
          <RecordGrid>
            {visible.map((row) => (
              <RecordCard
                key={row.codigo}
                title={row.nombre}
                subtitle={row.codigo}
                fields={[
                  { label: "Plantilla", value: PLANTILLA_LABEL[row.plantilla] || row.plantilla },
                  { label: "Uso", value: row.esPredeterminado ? "En uso" : "Disponible" },
                  { label: "Origen", value: row.esSistema ? "Sistema" : "Personalizado" },
                  { label: "Descripción", value: row.descripcion || "—" },
                ]}
                actions={
                  <div className="flex gap-2">
                    <Link href={`/administracion/ride-diseno/${encodeURIComponent(row.codigo)}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="size-3.5 mr-1.5" />
                        Editar
                      </Button>
                    </Link>
                    {!row.esPredeterminado ? (
                      <Button size="sm" variant="outline" onClick={() => void activar(row.codigo)}>
                        <Check className="size-3.5 mr-1.5" />
                        Usar
                      </Button>
                    ) : null}
                  </div>
                }
              />
            ))}
          </RecordGrid>
        ) : (
          <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
            <Table className="w-full text-left text-[13px]">
              <TableHeader>
                <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                  <TableHead className="py-3 px-4">Nombre</TableHead>
                  <TableHead className="py-3 px-4">Plantilla</TableHead>
                  <TableHead className="py-3 px-4">Estado</TableHead>
                  <TableHead className="py-3 px-4 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.codigo} className="border-b border-brand-gray-100">
                    <TableCell className="py-3 px-4">
                      <div className="font-semibold text-brand-gray-800">{row.nombre}</div>
                      <div className="text-[11px] text-brand-gray-400">{row.descripcion}</div>
                    </TableCell>
                    <TableCell className="py-3 px-4">{PLANTILLA_LABEL[row.plantilla] || row.plantilla}</TableCell>
                    <TableCell className="py-3 px-4">{row.esPredeterminado ? "En uso" : "Disponible"}</TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/administracion/ride-diseno/${encodeURIComponent(row.codigo)}`}>
                          <Button variant="outline" size="sm">Editar</Button>
                        </Link>
                        {!row.esPredeterminado ? (
                          <Button size="sm" variant="outline" onClick={() => void activar(row.codigo)}>
                            Usar
                          </Button>
                        ) : null}
                      </div>
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

export default function RideDisenoPage() {
  return (
    <SuperadminOnly>
      <RideDisenoList />
    </SuperadminOnly>
  );
}
