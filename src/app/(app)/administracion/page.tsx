"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Building2,
  Receipt,
  Settings,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  XCircle,
  FileText,
  CreditCard,
  Wallet,
  DollarSign,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import {
  BillingMonthlyChart,
  BillingByPlanChart,
  BillingTopUsersChart,
} from "@/components/admin/BillingCharts";
import { formatCurrency } from "@/lib/chartTheme";

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

interface BillingStats {
  mrr: number;
  ingresosTotales: number;
  ingresosMesActual: number;
  ingresosMesAnterior: number;
  pagosAprobados: number;
  pagosPendientes: number;
  pagosFallidos: number;
  cuentasPorEstado: { estado: string; count: number }[];
  ingresosMensuales: { mes: string; ingresos: number }[];
  ingresosPorPlan: { plan: string; planCodigo: string; ingresos: number; pagos: number }[];
  topUsuarios: {
    usuarioId: string | null;
    email: string;
    nombre: string | null;
    ingresos: number;
    pagos: number;
  }[];
  porMetodo: { metodo: string; ingresos: number; pagos: number }[];
}

export default function AdminDashboardPage() {
  const { hasModule } = useAuth();
  const canManageEmpresas = hasModule("admin.empresas");
  const canManagePlanes = hasModule("admin.planes");
  const canManageEmails = hasModule("admin.emails");
  const canManageMetodos = hasModule("admin.metodos-pago");
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(true);
  const [stats, setStats] = useState<{
    usuarios: number;
    tenants: number;
    emisores: number;
    comprobantes: number;
    scrapingJobs: number;
    recentLogs: RecentLog[];
  } | null>(null);
  const [billing, setBilling] = useState<BillingStats | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch("/api/admin/stats");
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

  useEffect(() => {
    const loadBilling = async () => {
      try {
        const res = await apiFetch("/api/admin/billing-stats");
        if (!res.ok) throw new Error("Error");
        const data = await res.json();
        setBilling(data);
      } catch {
        setBilling(null);
      } finally {
        setBillingLoading(false);
      }
    };
    loadBilling();
  }, []);

  const deltaMes =
    billing && billing.ingresosMesAnterior > 0
      ? ((billing.ingresosMesActual - billing.ingresosMesAnterior) /
          billing.ingresosMesAnterior) *
        100
      : null;

  return (
    <>
      <title>Admin Dashboard - OFSERCONT IA</title>
      <Topbar title="Panel de Administración" />
      <main className="ui-page flex-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">
            Panel de Administración
          </h1>
          <p className="text-xs text-brand-gray-500 mt-0.5">
            Resumen general del sistema e ingresos de suscripción
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-brand-gray-200 rounded-xl p-5 animate-pulse"
              >
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
                href="/administracion/usuarios"
                color="bg-brand-sky"
              />
              <StatCard
                label="Roles"
                value="RBAC"
                icon={<ShieldCheck className="w-5 h-5 text-white" />}
                href="/administracion/roles"
                color="bg-brand-sky"
              />
              {canManagePlanes ? (
                <StatCard
                  label="Planes"
                  value="Suscripción"
                  icon={<CreditCard className="w-5 h-5 text-white" />}
                  href="/administracion/planes"
                  color="bg-brand-red"
                />
              ) : null}
              {canManageMetodos ? (
                <StatCard
                  label="Métodos de pago"
                  value="Catálogo"
                  icon={<Wallet className="w-5 h-5 text-white" />}
                  href="/administracion/metodos-pago"
                  color="bg-amber-600"
                />
              ) : null}
              {canManageEmails ? (
                <StatCard
                  label="Emails"
                  value="Plantillas"
                  icon={<FileText className="w-5 h-5 text-white" />}
                  href="/administracion/emails"
                  color="bg-brand-sky"
                />
              ) : null}
              <StatCard
                label="Empresas"
                value={stats?.tenants ?? 0}
                icon={<Building2 className="w-5 h-5 text-white" />}
                href={canManageEmpresas ? "/administracion/empresas" : undefined}
                color="bg-success"
              />
              <StatCard
                label="Emisores"
                value={stats?.emisores ?? 0}
                icon={<FileText className="w-5 h-5 text-white" />}
                color="bg-brand-gray-700"
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
                color="bg-brand-gray-600"
              />
            </>
          )}
        </div>

        {/* Ingresos de suscripción */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-brand-gray-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-brand-red" />
              Ingresos de suscripción
            </h2>
            <p className="text-[10px] text-brand-gray-400">
              Histórico de pagos aprobados por plan, usuario y método
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {billingLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white border border-brand-gray-200 rounded-xl p-4 animate-pulse h-24"
                />
              ))
            ) : (
              <>
                <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-brand-gray-400 uppercase">MRR approx.</p>
                  <p className="text-xl font-extrabold text-brand-gray-800 mt-1">
                    {formatCurrency(billing?.mrr ?? 0)}
                  </p>
                  <p className="text-[10px] text-brand-gray-400 mt-0.5">Cuentas activas / gracia</p>
                </div>
                <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-brand-gray-400 uppercase">
                    Ingresos totales
                  </p>
                  <p className="text-xl font-extrabold text-brand-gray-800 mt-1">
                    {formatCurrency(billing?.ingresosTotales ?? 0)}
                  </p>
                  <p className="text-[10px] text-brand-gray-400 mt-0.5">
                    {billing?.pagosAprobados ?? 0} pagos aprobados
                  </p>
                </div>
                <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-brand-gray-400 uppercase">Mes actual</p>
                  <p className="text-xl font-extrabold text-brand-gray-800 mt-1">
                    {formatCurrency(billing?.ingresosMesActual ?? 0)}
                  </p>
                  {deltaMes != null ? (
                    <p
                      className={`text-[10px] mt-0.5 flex items-center gap-0.5 ${
                        deltaMes >= 0 ? "text-success" : "text-brand-red"
                      }`}
                    >
                      <TrendingUp className="w-3 h-3" />
                      {deltaMes >= 0 ? "+" : ""}
                      {deltaMes.toFixed(0)}% vs mes anterior
                    </p>
                  ) : (
                    <p className="text-[10px] text-brand-gray-400 mt-0.5">
                      Ant.: {formatCurrency(billing?.ingresosMesAnterior ?? 0)}
                    </p>
                  )}
                </div>
                <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-brand-gray-400 uppercase">Cola de pagos</p>
                  <p className="text-xl font-extrabold text-brand-gray-800 mt-1">
                    {billing?.pagosPendientes ?? 0}
                  </p>
                  <p className="text-[10px] text-brand-gray-400 mt-0.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {billing?.pagosFallidos ?? 0} fallidos / cancelados
                  </p>
                </div>
              </>
            )}
          </div>

          {!billingLoading && billing?.cuentasPorEstado?.length ? (
            <div className="flex flex-wrap gap-2">
              {billing.cuentasPorEstado.map((e) => (
                <span
                  key={e.estado}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-gray-100 text-brand-gray-600"
                >
                  {e.estado}: {e.count}
                </span>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="bg-white border border-brand-gray-200 rounded-xl p-4 lg:col-span-1">
              <h3 className="text-xs font-bold text-brand-gray-700 mb-2">Últimos 12 meses</h3>
              {billingLoading ? (
                <div className="h-48 animate-pulse bg-brand-gray-50 rounded" />
              ) : (
                <BillingMonthlyChart data={billing?.ingresosMensuales || []} />
              )}
            </div>
            <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
              <h3 className="text-xs font-bold text-brand-gray-700 mb-2">Por plan</h3>
              {billingLoading ? (
                <div className="h-48 animate-pulse bg-brand-gray-50 rounded" />
              ) : (
                <BillingByPlanChart data={billing?.ingresosPorPlan || []} />
              )}
              {!billingLoading && billing?.ingresosPorPlan?.length ? (
                <ul className="mt-2 space-y-1">
                  {billing.ingresosPorPlan.map((p) => (
                    <li
                      key={p.planCodigo}
                      className="flex justify-between text-[11px] text-brand-gray-600"
                    >
                      <span>{p.plan}</span>
                      <span className="font-semibold">{formatCurrency(p.ingresos)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
              <h3 className="text-xs font-bold text-brand-gray-700 mb-2">Top usuarios / cuentas</h3>
              {billingLoading ? (
                <div className="h-48 animate-pulse bg-brand-gray-50 rounded" />
              ) : (
                <BillingTopUsersChart data={billing?.topUsuarios || []} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white border border-brand-gray-200 rounded-xl p-4 overflow-hidden">
              <h3 className="text-xs font-bold text-brand-gray-700 mb-3">
                Detalle por usuario
              </h3>
              {billingLoading ? (
                <div className="h-32 animate-pulse bg-brand-gray-50 rounded" />
              ) : !billing?.topUsuarios?.length ? (
                <EmptyState
                  icon={<Users className="w-5 h-5" />}
                  title="Sin pagos aprobados aún."
                  compact
                />
              ) : (
                <div className="overflow-x-auto max-h-64">
                  <Table className="w-full text-left text-[12px]">
                    <TableHeader>
                      <TableRow className="border-b border-brand-gray-100 text-[9px] font-bold text-brand-gray-400 uppercase">
                        <TableHead className="py-2 px-2">Usuario</TableHead>
                        <TableHead className="py-2 px-2 text-right">Pagos</TableHead>
                        <TableHead className="py-2 px-2 text-right">Ingresos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-brand-gray-50">
                      {billing.topUsuarios.map((u, i) => (
                        <TableRow key={u.usuarioId || u.email + i}>
                          <TableCell className="py-2 px-2">
                            <div className="font-medium text-brand-gray-800 truncate max-w-[180px]">
                              {u.nombre || u.email}
                            </div>
                            {u.nombre ? (
                              <div className="text-[10px] text-brand-gray-400 truncate">
                                {u.email}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="py-2 px-2 text-right">{u.pagos}</TableCell>
                          <TableCell className="py-2 px-2 text-right font-semibold">
                            {formatCurrency(u.ingresos)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <div className="bg-white border border-brand-gray-200 rounded-xl p-4">
              <h3 className="text-xs font-bold text-brand-gray-700 mb-3">Por método de cobro</h3>
              {billingLoading ? (
                <div className="h-32 animate-pulse bg-brand-gray-50 rounded" />
              ) : !billing?.porMetodo?.length ? (
                <EmptyState
                  icon={<Wallet className="w-5 h-5" />}
                  title="Sin desglose por método."
                  compact
                />
              ) : (
                <ul className="space-y-2">
                  {billing.porMetodo.map((m) => (
                    <li
                      key={m.metodo}
                      className="flex items-center justify-between text-sm border-b border-brand-gray-50 pb-2"
                    >
                      <div>
                        <span className="font-medium text-brand-gray-800">{m.metodo}</span>
                        <span className="text-[10px] text-brand-gray-400 ml-2">
                          {m.pagos} pago(s)
                        </span>
                      </div>
                      <span className="font-bold text-brand-gray-800">
                        {formatCurrency(m.ingresos)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

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
              href="/administracion/auditoria"
              className="text-[11px] font-bold text-brand-red hover:text-brand-red-bright transition-colors"
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
            <EmptyState
              icon={<ShieldAlert className="w-5 h-5" />}
              title="Sin actividad registrada."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse text-[12px]">
                <TableHeader>
                  <TableRow className="border-b border-brand-gray-100 text-[9px] font-bold text-brand-gray-400 uppercase tracking-wider">
                    <TableHead className="py-2 px-3 font-semibold">Fecha</TableHead>
                    <TableHead className="py-2 px-3 font-semibold">Usuario</TableHead>
                    <TableHead className="py-2 px-3 font-semibold">Acción</TableHead>
                    <TableHead className="py-2 px-3 font-semibold">Recurso</TableHead>
                    <TableHead className="py-2 px-3 font-semibold">Descripción</TableHead>
                    <TableHead className="py-2 px-3 font-semibold">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-brand-gray-50">
                  {stats.recentLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-brand-gray-50/40 transition-colors">
                      <TableCell className="py-2 px-3 text-brand-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleDateString("es-EC", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="py-2 px-3 font-medium text-brand-gray-700 max-w-[120px] truncate">
                        {log.usuarioEmail || "—"}
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        <span className="text-[10px] font-bold bg-brand-gray-100 text-brand-gray-600 px-2 py-0.5 rounded-full">
                          {log.accion}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-brand-gray-500">
                        {log.recurso || "—"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-brand-gray-500 max-w-[200px] truncate">
                        {log.descripcion || "—"}
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        {log.exitoso ? (
                          <CheckCircle className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
