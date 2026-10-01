"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { ModuleGate } from "@/components/auth/ModuleGate";
import ListToolbar from "@/components/lists/ListToolbar";
import { RecordCard, RecordGrid } from "@/components/lists/RecordGrid";
import { useViewMode } from "@/components/lists/useViewMode";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import { Mail, Eye, Loader2 } from "lucide-react";

interface PlantillaRow {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  asunto: string;
  activo: boolean;
  updatedAt: string | null;
  variables: string[];
}

function EmailsListContent() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlantillaRow[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useViewMode("emails");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch("/api/admin/emails");
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Error");
        setRows(data.data || []);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar plantillas");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter((p) =>
        [p.nombre, p.codigo, p.descripcion, p.asunto, p.activo ? "Activa" : "Inactiva"].some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        )
      )
    : rows;

  return (
    <>
      <Topbar title="Emails" backLink={{ href: "/administracion", label: "Admin" }} />
      <main className="ui-page flex-1 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-brand-gray-800 flex items-center gap-2">
            <Mail className="size-5 text-brand-red" />
            Plantillas de email
          </h1>
          <p className="text-xs text-brand-gray-500 mt-1">
            Edita y previsualiza bienvenida, pago aprobado, comprobante autorizado y notificaciones.
            Requiere SMTP configurado para el envío real.
          </p>
        </div>

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar plantilla..."
          view={view}
          onViewChange={setView}
        />

        {loading ? (
          <div className="flex justify-center py-16 text-brand-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-brand-gray-500">No se encontraron plantillas.</p>
        ) : view === "cuadricula" ? (
          <RecordGrid>
            {visible.map((p) => (
              <RecordCard
                key={p.codigo}
                title={p.nombre}
                subtitle={p.codigo}
                fields={[
                  { label: "Estado", value: p.activo ? "Activa" : "Inactiva" },
                  { label: "Asunto", value: p.asunto },
                  { label: "Descripción", value: p.descripcion || "—" },
                  { label: "Variables", value: p.variables.length },
                ]}
                actions={
                  <Link href={`/administracion/emails/${encodeURIComponent(p.codigo)}`}>
                    <Button variant="outline" size="sm" className="shrink-0">
                      <Eye className="size-3.5 mr-1.5" />
                      Editar / preview
                    </Button>
                  </Link>
                }
              />
            ))}
          </RecordGrid>
        ) : (
          <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[13px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <TableHead className="py-3 px-4 font-semibold">Nombre</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Código</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Asunto</TableHead>
                    <TableHead className="py-3 px-4 font-semibold">Estado</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {visible.map((p) => (
                    <TableRow key={p.codigo} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-3 px-4 font-medium text-brand-gray-800">{p.nombre}</TableCell>
                      <TableCell className="py-3 px-4 font-mono text-xs text-brand-gray-500">{p.codigo}</TableCell>
                      <TableCell className="py-3 px-4 text-xs text-brand-gray-600">{p.asunto}</TableCell>
                      <TableCell className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.activo
                              ? "bg-success-pale text-success"
                              : "bg-brand-gray-100 text-brand-gray-500"
                          }`}
                        >
                          {p.activo ? "Activa" : "Inactiva"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right">
                        <Link href={`/administracion/emails/${encodeURIComponent(p.codigo)}`}>
                          <Button variant="outline" size="sm" className="shrink-0">
                            <Eye className="size-3.5 mr-1.5" />
                            Editar / preview
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function AdminEmailsPage() {
  return (
    <ModuleGate module="admin.emails">
      <EmailsListContent />
    </ModuleGate>
  );
}
