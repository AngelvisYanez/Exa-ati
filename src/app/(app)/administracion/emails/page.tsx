"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { ModuleGate } from "@/components/auth/ModuleGate";
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

        {loading ? (
          <div className="flex justify-center py-16 text-brand-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((p) => (
              <div
                key={p.codigo}
                className="bg-white border border-brand-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-brand-gray-900">{p.nombre}</h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.activo
                          ? "bg-success-pale text-success"
                          : "bg-brand-gray-100 text-brand-gray-500"
                      }`}
                    >
                      {p.activo ? "Activa" : "Inactiva"}
                    </span>
                    <code className="text-[10px] text-brand-gray-400 font-mono">{p.codigo}</code>
                  </div>
                  <p className="text-[11px] text-brand-gray-500 mt-1 line-clamp-2">
                    {p.descripcion || p.asunto}
                  </p>
                </div>
                <Link href={`/administracion/emails/${encodeURIComponent(p.codigo)}`}>
                  <Button variant="outline" size="sm" className="shrink-0">
                    <Eye className="size-3.5 mr-1.5" />
                    Editar / preview
                  </Button>
                </Link>
              </div>
            ))}
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
