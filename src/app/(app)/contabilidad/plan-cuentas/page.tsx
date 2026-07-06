"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, ChevronRight, ChevronDown } from "lucide-react";

interface Cuenta {
  id: string;
  codigo: string;
  nombre: string;
  nivel: number;
  tipo: string;
  permiteMovimiento: boolean;
  esAuxiliar: boolean;
  cuentaPadreId?: string;
  hijos?: Cuenta[];
}

const TIPO_LABEL: Record<string, string> = {
  ACTIVO: "Activo",
  PASIVO: "Pasivo",
  PATRIMONIO: "Patrimonio",
  INGRESO: "Ingreso",
  GASTO: "Gasto",
  COSTO: "Costo",
};

const TIPO_COLOR: Record<string, string> = {
  ACTIVO: "bg-blue-50 text-blue-700 border-blue-200",
  PASIVO: "bg-amber-50 text-amber-700 border-amber-200",
  PATRIMONIO: "bg-purple-50 text-purple-700 border-purple-200",
  INGRESO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  GASTO: "bg-red-50 text-red-700 border-red-200",
  COSTO: "bg-orange-50 text-orange-700 border-orange-200",
};

function buildTree(cuentas: Cuenta[]): Cuenta[] {
  const map = new Map<string, Cuenta>();
  const roots: Cuenta[] = [];
  cuentas.forEach((c) => map.set(c.id, { ...c, hijos: [] }));
  cuentas.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.cuentaPadreId && map.has(c.cuentaPadreId)) {
      map.get(c.cuentaPadreId)!.hijos!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function CuentaRow({ cuenta, depth = 0 }: { cuenta: Cuenta; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = cuenta.hijos && cuenta.hijos.length > 0;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar la cuenta "${cuenta.nombre}"?`)) return;
    try {
      const res = await fetch(`/api/contabilidad/plan-cuentas/${cuenta.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Cuenta eliminada correctamente");
      window.location.reload();
    } catch {
      toast.error("Error al eliminar la cuenta");
    }
  };

  return (
    <>
      <tr className="hover:bg-brand-gray-50/40 transition-colors border-b border-brand-gray-100">
        <td className="py-2.5">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
            {hasChildren ? (
              <button onClick={() => setOpen(!open)} className="cursor-pointer text-brand-gray-400 hover:text-brand-gray-600">
                {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            <span className="font-mono text-xs font-semibold text-brand-gray-600">{cuenta.codigo}</span>
          </div>
        </td>
        <td className="py-2.5 text-sm font-medium text-brand-gray-800">{cuenta.nombre}</td>
        <td className="py-2.5 text-xs text-brand-gray-500">{cuenta.nivel}</td>
        <td className="py-2.5">
          <Badge variant="outline" className={`text-[10px] ${TIPO_COLOR[cuenta.tipo] || ""}`}>
            {TIPO_LABEL[cuenta.tipo] || cuenta.tipo}
          </Badge>
        </td>
        <td className="py-2.5">
          {cuenta.permiteMovimiento ? (
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Sí</span>
          ) : (
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">No</span>
          )}
        </td>
        <td className="py-2.5 text-right whitespace-nowrap">
          <Link
            href={`/contabilidad/plan-cuentas/${cuenta.id}`}
            className="inline-flex items-center gap-1 text-brand-navy hover:text-brand-navy-light text-xs font-semibold border border-brand-gray-200 hover:bg-brand-gray-50 px-2 py-1 rounded-lg transition-colors mr-1"
          >
            <Edit className="w-3 h-3" /> Editar
          </Link>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-semibold border border-red-100 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> Eliminar
          </button>
        </td>
      </tr>
      {open && hasChildren && cuenta.hijos!.map((h) => (
        <CuentaRow key={h.id} cuenta={h} depth={depth + 1} />
      ))}
    </>
  );
}

export default function PlanCuentasPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [filtered, setFiltered] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/contabilidad/plan-cuentas");
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      const list = data.cuentas || data.data || [];
      setCuentas(list);
      setFiltered(list);
    } catch {
      toast.error("Error al cargar el plan de cuentas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(cuentas);
    } else {
      const q = search.toLowerCase();
      setFiltered(cuentas.filter((c) => c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q)));
    }
  }, [search, cuentas]);

  const tree = buildTree(filtered);

  return (
    <>
      <title>Plan de Cuentas - OFSERCONT IA</title>
      <Topbar title="Plan de Cuentas" backLink={{ href: "/contabilidad", label: "Contabilidad" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Plan de Cuentas</h1>
            <p className="text-xs text-brand-gray-500 mt-0.5">Catálogo contable jerárquico con niveles y tipos</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cuenta..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Link href="/contabilidad/plan-cuentas/nueva">
              <Button size="sm" className="bg-brand-navy hover:bg-brand-navy-light text-white">
                <Plus className="w-3.5 h-3.5" /> Crear Cuenta
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-brand-gray-500 animate-pulse">Cargando cuentas...</div>
          ) : tree.length === 0 ? (
            <div className="p-10 text-center text-sm text-brand-gray-400">
              No hay cuentas registradas. Crea la primera cuenta contable.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider bg-brand-gray-50/50">
                    <th className="py-3 px-4 font-semibold">Código</th>
                    <th className="py-3 px-4 font-semibold">Nombre</th>
                    <th className="py-3 px-4 font-semibold">Nivel</th>
                    <th className="py-3 px-4 font-semibold">Tipo</th>
                    <th className="py-3 px-4 font-semibold">Movimiento</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {tree.map((c) => (
                    <CuentaRow key={c.id} cuenta={c} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
