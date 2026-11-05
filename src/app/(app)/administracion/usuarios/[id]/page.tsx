"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";

function generatePassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const all = upper + lower + digits + symbols;
  let pw = "";
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = 0; i < 8; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  return pw
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

interface Tenant {
  id: string;
  nombre: string;
}

interface RolOption {
  codigo: string;
  nombre: string;
}

interface PlanOption {
  codigo: string;
  nombre: string;
  maxEmpresas: number;
  precioMensual: number;
  activo: boolean;
}

export default function EditarUsuarioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasModule, user } = useAuth();
  const canManagePlanes =
    user?.rol === "SUPERADMIN" || hasModule("admin.planes");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rol, setRol] = useState("USER");
  const [tenantId, setTenantId] = useState("");
  const [ruc, setRuc] = useState("");
  const [activo, setActivo] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [roles, setRoles] = useState<RolOption[]>([]);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [planes, setPlanes] = useState<PlanOption[]>([]);
  const [planCodigo, setPlanCodigo] = useState("");
  const [planPeriodo, setPlanPeriodo] = useState<"mensual" | "anual">("mensual");
  const [planEstado, setPlanEstado] = useState("activo");
  const [planVigenteHasta, setPlanVigenteHasta] = useState("");
  const [cuentaNombre, setCuentaNombre] = useState<string | null>(null);
  const [hasCuenta, setHasCuenta] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, tenantsRes, rolesRes, planesRes] = await Promise.all([
          apiFetch(`/api/admin/usuarios/${id}`),
          apiFetch("/api/admin/tenants?pageSize=100").catch(() => null),
          apiFetch("/api/admin/roles"),
          canManagePlanes
            ? apiFetch("/api/admin/planes").catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!userRes.ok) throw new Error("No encontrado");
        const userData = await userRes.json();
        const u = userData.data;
        setEmail(u.email || "");
        setNombre(u.nombre || "");
        setRol(u.rol || "USER");
        setTenantId(u.tenantId || "");
        setRuc(u.ruc || "");
        setActivo(u.activo ?? true);
        setPlanCodigo(u.planCodigo || "");
        setPlanPeriodo(u.planPeriodo === "anual" ? "anual" : "mensual");
        setPlanEstado(u.planEstado || "activo");
        setPlanVigenteHasta(
          u.planVigenteHasta
            ? String(u.planVigenteHasta).slice(0, 10)
            : ""
        );
        setCuentaNombre(u.cuentaNombre || null);
        setHasCuenta(Boolean(u.cuentaId || u.tenantId));

        if (tenantsRes?.ok) {
          const tData = await tenantsRes.json();
          setTenants(tData.data || []);
          setIsSuperadmin(true);
        }
        if (rolesRes.ok) {
          const rData = await rolesRes.json();
          setRoles(
            (rData.data || []).map((r: { codigo: string; nombre: string }) => ({
              codigo: r.codigo,
              nombre: r.nombre,
            }))
          );
        }
        if (planesRes && "ok" in planesRes && planesRes.ok) {
          const pData = await planesRes.json();
          setPlanes(
            (pData.data || []).filter(
              (p: PlanOption) => p.activo || p.codigo === u.planCodigo
            )
          );
        }
      } catch {
        toast.error("Error al cargar usuario");
        router.push("/administracion/usuarios");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, router, canManagePlanes]);

  const handleGenerate = () => {
    setPassword(generatePassword());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !nombre.trim()) {
      toast.warning("Email y nombre son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        email: email.trim(),
        nombre: nombre.trim(),
        rol,
        tenantId: tenantId || null,
        ruc: ruc.trim() || null,
        activo,
      };
      if (password.trim()) body.password = password;

      if (canManagePlanes && planCodigo) {
        body.planCodigo = planCodigo;
        body.planPeriodo = planPeriodo;
        body.planEstado = planEstado;
        body.planVigenteHasta = planVigenteHasta || null;
      }

      const res = await apiFetch(`/api/admin/usuarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al actualizar");
      }
      toast.success("Usuario actualizado");
      router.push("/administracion/usuarios");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      const res = await apiFetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      toast.success("Usuario eliminado");
      router.push("/administracion/usuarios");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  if (loading) {
    return (
      <>
        <Topbar
          title="Editar Usuario"
          backLink={{ href: "/administracion/usuarios", label: "Usuarios" }}
        />
        <main className="p-3 flex-1 flex items-center justify-center text-sm text-brand-gray-500 animate-pulse">
          Cargando...
        </main>
      </>
    );
  }

  return (
    <>
      <title>Editar Usuario - Admin - OFSERCONT IA</title>
      <Topbar
        title="Editar Usuario"
        backLink={{ href: "/administracion/usuarios", label: "Usuarios" }}
      />
      <main className="ui-page flex-1">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Editar Usuario</h1>

        <Card className="p-5 border-brand-gray-200 max-w-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                Email *
              </Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                Nombre *
              </Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                Nueva Contraseña (dejar vacío para mantener)
              </Label>
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-gray-400 hover:text-brand-gray-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  title="Generar contraseña"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                Rol
              </Label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                {(roles.length > 0
                  ? roles.filter(
                      (r) =>
                        isSuperadmin || r.codigo !== "SUPERADMIN" || rol === "SUPERADMIN"
                    )
                  : [
                      { codigo: "USER", nombre: "Usuario" },
                      { codigo: "ADMIN", nombre: "Administrador" },
                      ...(isSuperadmin || rol === "SUPERADMIN"
                        ? [{ codigo: "SUPERADMIN", nombre: "Superadministrador" }]
                        : []),
                    ]
                ).map((r) => (
                  <option key={r.codigo} value={r.codigo}>
                    {r.codigo} — {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            {isSuperadmin && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                  Empresa
                </Label>
                <select
                  value={tenantId}
                  onChange={(e) => {
                    setTenantId(e.target.value);
                    setHasCuenta(Boolean(e.target.value));
                  }}
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="">Sin empresa (usuario del sistema)</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {canManagePlanes && hasCuenta ? (
              <div className="rounded-lg border border-brand-gray-200 bg-brand-gray-50/50 p-4 flex flex-col gap-3">
                <div>
                  <p className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                    Plan de suscripción
                  </p>
                  {cuentaNombre ? (
                    <p className="text-[11px] text-brand-gray-400 mt-0.5">
                      Cuenta: {cuentaNombre}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">
                    Plan
                  </Label>
                  <select
                    value={planCodigo}
                    onChange={(e) => setPlanCodigo(e.target.value)}
                    className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm"
                  >
                    <option value="">— Sin cambiar —</option>
                    {planes.map((p) => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.nombre} · ${Number(p.precioMensual).toFixed(2)}/mes
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">
                      Periodo
                    </Label>
                    <select
                      value={planPeriodo}
                      onChange={(e) =>
                        setPlanPeriodo(e.target.value === "anual" ? "anual" : "mensual")
                      }
                      className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm"
                    >
                      <option value="mensual">Mensual</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">
                      Estado
                    </Label>
                    <select
                      value={planEstado}
                      onChange={(e) => setPlanEstado(e.target.value)}
                      className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm"
                    >
                      <option value="activo">Activo</option>
                      <option value="gracia">Gracia</option>
                      <option value="vencido">Vencido</option>
                      <option value="cancelado">Cancelado</option>
                      <option value="pendiente">Pendiente</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-brand-gray-500 uppercase">
                    Vigente hasta
                  </Label>
                  <Input
                    type="date"
                    value={planVigenteHasta}
                    onChange={(e) => setPlanVigenteHasta(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
                RUC
              </Label>
              <Input value={ruc} onChange={(e) => setRuc(e.target.value)} maxLength={13} />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="w-4 h-4 rounded border-brand-gray-300 text-brand-red focus:ring-brand-red/30"
              />
              <span className="text-xs font-medium text-brand-gray-700">Usuario activo</span>
            </label>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-brand-red hover:bg-brand-red-bright text-white"
              >
                {submitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                className="ml-auto"
              >
                Eliminar
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
