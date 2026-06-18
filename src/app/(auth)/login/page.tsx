"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success("Sesión iniciada correctamente");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-brand-gray-200 p-8 flex flex-col gap-6">
      <div className="text-center flex flex-col items-center gap-4">
        <Image
          src={mounted && resolvedTheme === "dark" ? "/exa-ati-2.png" : "/exa-ati.png"}
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
