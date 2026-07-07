"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import {
  Users, Building2, Receipt, Settings, ShieldAlert,
  CheckCircle, XCircle, Clock, FileText
} from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  href?: string;
  color: string;
}

function StatCard({ label, value, icon, href, color }: StatCardProps) {
  const content = (
    <div className="bg-white border border-brand-gray-200 rounded-xl p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-brand-gray-800">{value}</p>
        <p className="text-xs text-brand-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

interface RecentLog {
  id: number;
  usuarioEmail: string;
  accion: string;
  recurso: string;
  descripcion: string;
  exitoso: boolean;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    usuarios: number;
    tenants: number;
    emisores: number;
    comprobantes: number;
    scrapingJobs: number;
    recentLogs: RecentLog[];
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error("Error");
        const data = await res.json();
        setStats(data);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <>
      <title>Admin Dashboard - OFSERCONT IA</title>
      <Topbar title="Panel de Administración" />
      <main className="p-3 flex-1 flex flex-col gap-5 w-full">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Panel de Administración</h1>
          <p className="text-xs text-brand-gray-500 mt-0.5">Resumen general del sistema</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white border border-brand-gray-200 rounded-xl p-5 animate-pulse">
                <div className="h-10 w-24 bg-brand-gray-100 rounded mb-2" />
                <div className="h-3 w-16 bg-brand-gray-100 rounded" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                label="Usuarios"
                value={stats?.usuarios ?? 0}
                icon={<Users className="w-5 h-5 text-white" />}
                href="/admin/usuarios"
                color="bg-blue-600"
              />
              <StatCard
                label="Empresas"
                value={stats?.tenants ?? 0}
                icon={<Building2 className="w-5 h-5 text-white" />}
                href="/admin/empresas"
                color="bg-emerald-600"
              />
              <StatCard
                label="Emisores"
                value={stats?.emisores ?? 0}
                icon={<FileText className="w-5 h-5 text-white" />}
                color="bg-violet-600"
              />
              <StatCard
                label="Comprobantes"
                value={stats?.comprobantes ?? 0}
                icon={<Receipt className="w-5 h-5 text-white" />}
                color="bg-amber-600"
              />
              <StatCard
                label="Scraping Jobs"
                value={stats?.scrapingJobs ?? 0}
                icon={<Settings className="w-5 h-5 text-white" />}
                color="bg-slate-600"
              />
            </>
          )}
        </div>

        <div className="bg-white border border-brand-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-brand-gray-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-brand-gray-400" />
                Actividad Reciente
              </h2>
              <p className="text-[10px] text-brand-gray-400">Últimos 10 eventos de auditoría</p>
            </div>
            <Link
              href="/admin/auditoria"
              className="text-[11px] font-bold text-brand-navy hover:text-brand-navy-light transition-colors"
            >
              Ver todas →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 bg-brand-gray-50 rounded w-full" />
              ))}
            </div>
          ) : !stats?.recentLogs?.length ? (
            <div className="text-center py-8 text-sm text-brand-gray-400">Sin actividad registrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-brand-gray-100 text-[9px] font-bold text-brand-gray-400 uppercase tracking-wider">
                    <th className="py-2 px-3 font-semibold">Fecha</th>
                    <th className="py-2 px-3 font-semibold">Usuario</th>
                    <th className="py-2 px-3 font-semibold">Acción</th>
                    <th className="py-2 px-3 font-semibold">Recurso</th>
                    <th className="py-2 px-3 font-semibold">Descripción</th>
                    <th className="py-2 px-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gray-50">
                  {stats.recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <td className="py-2 px-3 text-brand-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleDateString("es-EC", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td className="py-2 px-3 font-medium text-brand-gray-700 max-w-[120px] truncate">
                        {log.usuarioEmail || "—"}
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] font-bold bg-brand-gray-100 text-brand-gray-600 px-2 py-0.5 rounded-full">
                          {log.accion}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-brand-gray-500">{log.recurso || "—"}</td>
                      <td className="py-2 px-3 text-brand-gray-500 max-w-[200px] truncate">
                        {log.descripcion || "—"}
                      </td>
                      <td className="py-2 px-3">
                        {log.exitoso ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </td>
                    </tr>
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
