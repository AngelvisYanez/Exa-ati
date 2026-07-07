"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, RefreshCw } from "lucide-react";

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
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}

interface Tenant {
  id: string;
  nombre: string;
}

export default function EditarUsuarioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, tenantsRes] = await Promise.all([
          fetch(`/api/admin/usuarios/${id}`),
          fetch("/api/admin/tenants?pageSize=100").catch(() => null),
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

        if (tenantsRes?.ok) {
          const tData = await tenantsRes.json();
          setTenants(tData.data || []);
          setIsSuperadmin(true);
        }
      } catch {
        toast.error("Error al cargar usuario");
        router.push("/admin/usuarios");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, router]);

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

      const res = await fetch(`/api/admin/usuarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al actualizar");
      }
      toast.success("Usuario actualizado");
      router.push("/admin/usuarios");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      toast.success("Usuario eliminado");
      router.push("/admin/usuarios");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Editar Usuario" backLink={{ href: "/admin/usuarios", label: "Usuarios" }} />
        <main className="p-3 flex-1 flex items-center justify-center text-sm text-brand-gray-500 animate-pulse">Cargando...</main>
      </>
    );
  }

  return (
    <>
      <title>Editar Usuario - Admin - OFSERCONT IA</title>
      <Topbar title="Editar Usuario" backLink={{ href: "/admin/usuarios", label: "Usuarios" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Editar Usuario</h1>

        <Card className="p-5 border-brand-gray-200 max-w-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Nueva Contraseña (dejar vacío para mantener)</Label>
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
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleGenerate} title="Generar contraseña">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Rol</Label>
              <select value={rol} onChange={(e) => setRol(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPERADMIN">SUPERADMIN</option>
              </select>
            </div>

            {isSuperadmin && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Empresa</Label>
                <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
                  <option value="">Sin empresa (usuario del sistema)</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">RUC</Label>
              <Input value={ruc} onChange={(e) => setRuc(e.target.value)} maxLength={13} />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="w-4 h-4 rounded border-brand-gray-300 text-brand-navy focus:ring-brand-navy/30" />
              <span className="text-xs font-medium text-brand-gray-700">Usuario activo</span>
            </label>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="bg-brand-navy hover:bg-brand-navy-light text-white">
                {submitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
              <Button type="button" variant="destructive" onClick={handleDelete} className="ml-auto">Eliminar</Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
