"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { sriClient } from "@/lib/sriClient";
import { toast } from "sonner";
import { Building2, Check } from "lucide-react";

type CompanyItem = {
  ruc: string;
  razonSocial: string;
};

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [selectedRuc, setSelectedRuc] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      toast.success("Sesión iniciada correctamente");

      let list: CompanyItem[] = [];
      try {
        if (user.rol === "USER") {
          const res = await sriClient.getEmisor();
          if (res.success && res.emisor) {
            list = [{ ruc: res.emisor.ruc, razonSocial: res.emisor.razonSocial || res.emisor.ruc }];
          }
        } else {
          const res = await sriClient.getEmisores();
          if (res.success && res.emisores) {
            list = res.emisores.map((e: any) => ({
              ruc: e.ruc,
              razonSocial: e.razonSocial || `Contribuyente ${e.ruc}`,
            }));
          }
        }
      } catch {
        list = [];
      }

      if (list.length === 0) {
        setCompanies([]);
        setSelecting(true);
      } else if (list.length === 1) {
        localStorage.setItem("sri_selected_ruc", list[0].ruc);
        window.location.href = "/";
      } else {
        setCompanies(list);
        setSelecting(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = (ruc: string) => {
    setSelectedRuc(ruc);
    localStorage.setItem("sri_selected_ruc", ruc);
    window.location.href = "/";
  };

  if (selecting) {
    return (
      <div className="bg-white rounded-2xl shadow-2xl border border-brand-gray-200 p-8 flex flex-col gap-6">
        <div className="text-center flex flex-col items-center gap-4">
          <Image
            src="/exa-ati.png"
            alt="EXA-ATI"
            width={156}
            height={32}
            priority
          />
          <p className="text-sm text-slate-500">
            {companies.length === 0
              ? "No tienes empresas vinculadas al SRI"
              : "Selecciona la empresa para continuar"}
          </p>
        </div>

        {companies.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 bg-brand-gray-100 rounded-full flex items-center justify-center">
              <Building2 className="w-8 h-8 text-brand-gray-400" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-600 text-center leading-relaxed">
              Para usar el sistema necesitas vincular al menos un contribuyente (RUC) al SRI.
            </p>
            <Link
              href="/configuracion?vincular=true"
              className="w-full bg-brand-navy hover:bg-brand-navy-light text-white py-3 rounded-lg text-sm font-bold text-center transition-colors"
            >
              Vincular empresa
            </Link>
            <Link
              href="/"
              className="text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Omitir por ahora
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {companies.map((item) => (
              <button
                key={item.ruc}
                onClick={() => handleSelectCompany(item.ruc)}
                disabled={selectedRuc === item.ruc}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-brand-gray-200 hover:border-brand-navy hover:bg-brand-gray-50 transition-all text-left cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-navy rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {item.ruc.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-gray-800">{item.razonSocial}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{item.ruc}</p>
                  </div>
                </div>
                {selectedRuc === item.ruc ? (
                  <div className="w-5 h-5 rounded-full bg-brand-navy flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-brand-gray-300" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-brand-gray-200 p-8 flex flex-col gap-6">
      <div className="text-center flex flex-col items-center gap-4">
        <Image
          src="/exa-ati.png"
          alt="EXA-ATI"
          width={156}
          height={32}
          priority
        />
        <p className="text-sm text-slate-500">Inicia sesión en tu cuenta</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
            Correo electrónico o RUC
          </label>
          <input
            type="text"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none"
            placeholder="ejemplo@email.com o RUC"
            autoComplete="username"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
            Contraseña
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-2.5 text-sm text-brand-gray-800 focus:border-brand-navy outline-none"
            placeholder="Tu contraseña"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-navy hover:bg-brand-navy-light text-white py-3 rounded-lg text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-brand-navy font-semibold hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
