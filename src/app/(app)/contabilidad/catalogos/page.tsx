"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import ListToolbar from "@/components/lists/ListToolbar";
import { RecordCard, RecordGrid } from "@/components/lists/RecordGrid";
import { useViewMode } from "@/components/lists/useViewMode";
import { toast } from "sonner";
import { FileText, BookOpen, RefreshCw } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";

interface CatalogoItem {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
}

export default function CatalogosPage() {
  const [tiposDocumento, setTiposDocumento] = useState<CatalogoItem[]>([]);
  const [tiposSustento, setTiposSustento] = useState<CatalogoItem[]>([]);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [loadingSust, setLoadingSust] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useViewMode("catalogos");

  const loadDocumentos = useCallback(async () => {
    try {
      setLoadingDoc(true);
      const res = await apiFetch("/api/contabilidad/tipos-documento");
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setTiposDocumento(data.data || []);
    } catch {
      toast.error("Error al cargar tipos de documento");
    } finally {
      setLoadingDoc(false);
    }
  }, []);

  const loadSustento = useCallback(async () => {
    try {
      setLoadingSust(true);
      const res = await apiFetch("/api/contabilidad/tipos-sustento");
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setTiposSustento(data.data || []);
    } catch {
      toast.error("Error al cargar tipos de sustento tributario");
    } finally {
      setLoadingSust(false);
    }
  }, []);

  useEffect(() => {
    loadDocumentos();
    loadSustento();
  }, [loadDocumentos, loadSustento]);

  const handleRefresh = () => {
    loadDocumentos();
    loadSustento();
  };

  const q = search.trim().toLowerCase();
  const matchItem = (t: CatalogoItem) =>
    [t.codigo, t.descripcion, t.activo ? "Activo" : "Inactivo"].some((v) => v.toLowerCase().includes(q));
  const docs = q ? tiposDocumento.filter(matchItem) : tiposDocumento;
  const sustentos = q ? tiposSustento.filter(matchItem) : tiposSustento;

  return (
    <>
      <title>Catálogos - OFSERCONT IA</title>
      <Topbar title="Catálogos" backLink={{ href: "/contabilidad", label: "Contabilidad" }} />
      <main className="ui-page flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Catálogos del Sistema</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Tablas de referencia para tipos de documentos y sustento tributario del SRI</p>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-red hover:text-brand-red-bright border border-brand-gray-200 hover:bg-brand-gray-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
        </div>

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar en catálogos..."
          view={view}
          onViewChange={setView}
        />

        <Card className="border-brand-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg border flex items-center justify-center bg-sky-50 text-brand-sky border-sky-200">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-brand-gray-800">Tipos de Documento SRI</CardTitle>
                <p className="text-[10px] text-brand-gray-500">Códigos de comprobantes electrónicos</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDoc ? (
              <TableSkeleton rows={6} columns={5} />
            ) : docs.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-5 h-5" />}
                title="No hay tipos de documento registrados."
                compact
              />
            ) : view === "cuadricula" ? (
              <RecordGrid>
                {docs.map((t) => (
                  <RecordCard
                    key={t.id}
                    title={t.descripcion}
                    subtitle={t.codigo}
                    fields={[{ label: "Estado", value: t.activo ? "Activo" : "Inactivo" }]}
                  />
                ))}
              </RecordGrid>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full text-left border-collapse text-[13px]">
                  <TableHeader>
                    <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                      <TableHead className="py-2.5 px-4 font-semibold">Código</TableHead>
                      <TableHead className="py-2.5 px-4 font-semibold">Descripción</TableHead>
                      <TableHead className="py-2.5 px-4 font-semibold">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-brand-gray-50">
                    {docs.map((t) => (
                      <TableRow key={t.id} className="hover:bg-brand-gray-50/40 transition-colors">
                        <TableCell className="py-2.5 px-4 font-mono text-xs font-bold text-brand-red">{t.codigo}</TableCell>
                        <TableCell className="py-2.5 px-4 text-brand-gray-700">{t.descripcion}</TableCell>
                        <TableCell className="py-2.5 px-4">
                          {t.activo ? (
                            <span className="text-[10px] font-semibold bg-success-pale text-success px-2 py-0.5 rounded-full">Activo</span>
                          ) : (
                            <span className="text-[10px] font-semibold bg-brand-gray-100 text-brand-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-brand-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg border flex items-center justify-center bg-success-pale text-success border-success-light/40">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-brand-gray-800">Tipos de Sustento Tributario</CardTitle>
                <p className="text-[10px] text-brand-gray-500">Documentos de sustento para declaraciones</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSust ? (
              <TableSkeleton rows={6} columns={5} />
            ) : sustentos.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="w-5 h-5" />}
                title="No hay tipos de sustento registrados."
                compact
              />
            ) : view === "cuadricula" ? (
              <RecordGrid>
                {sustentos.map((t) => (
                  <RecordCard
                    key={t.id}
                    title={t.descripcion}
                    subtitle={t.codigo}
                    fields={[{ label: "Estado", value: t.activo ? "Activo" : "Inactivo" }]}
                  />
                ))}
              </RecordGrid>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full text-left border-collapse text-[13px]">
                  <TableHeader>
                    <TableRow className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                      <TableHead className="py-2.5 px-4 font-semibold">Código</TableHead>
                      <TableHead className="py-2.5 px-4 font-semibold">Descripción</TableHead>
                      <TableHead className="py-2.5 px-4 font-semibold">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-brand-gray-50">
                    {sustentos.map((t) => (
                      <TableRow key={t.id} className="hover:bg-brand-gray-50/40 transition-colors">
                        <TableCell className="py-2.5 px-4 font-mono text-xs font-bold text-brand-red">{t.codigo}</TableCell>
                        <TableCell className="py-2.5 px-4 text-brand-gray-700">{t.descripcion}</TableCell>
                        <TableCell className="py-2.5 px-4">
                          {t.activo ? (
                            <span className="text-[10px] font-semibold bg-success-pale text-success px-2 py-0.5 rounded-full">Activo</span>
                          ) : (
                            <span className="text-[10px] font-semibold bg-brand-gray-100 text-brand-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
