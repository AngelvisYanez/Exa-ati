"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export default function NuevoUsuarioPage() {
  const router = useRouter();
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
    const check = async () => {
      try {
        const res = await fetch("/api/admin/tenants?pageSize=100");
        if (res.ok) {
          const data = await res.json();
          setTenants(data.data || []);
          setIsSuperadmin(true);
        }
      } catch {}
    };
    check();
  }, []);

  const handleGenerate = () => {
    setPassword(generatePassword());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !nombre.trim() || !password.trim()) {
      toast.warning("Email, nombre y password son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          nombre: nombre.trim(),
          password,
          rol,
          tenantId: tenantId || null,
          ruc: ruc.trim() || null,
          activo,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al crear usuario");
      }
      toast.success("Usuario creado correctamente");
      router.push("/admin/usuarios");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <title>Nuevo Usuario - Admin - OFSERCONT IA</title>
      <Topbar title="Nuevo Usuario" backLink={{ href: "/admin/usuarios", label: "Usuarios" }} />
      <main className="p-3 flex-1 flex flex-col gap-4 w-full">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Nuevo Usuario</h1>

        <Card className="p-5 border-brand-gray-200 max-w-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@ejemplo.com" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Contraseña *</Label>
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
                <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">Empresa (opcional)</Label>
                <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
                  <option value="">Sin empresa (usuario del sistema)</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">RUC (opcional)</Label>
              <Input value={ruc} onChange={(e) => setRuc(e.target.value)} placeholder="13 dígitos" maxLength={13} />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="w-4 h-4 rounded border-brand-gray-300 text-brand-navy focus:ring-brand-navy/30" />
              <span className="text-xs font-medium text-brand-gray-700">Usuario activo</span>
            </label>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="bg-brand-navy hover:bg-brand-navy-light text-white">
                {submitting ? "Guardando..." : "Crear Usuario"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
