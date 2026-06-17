"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <div className="text-center">
        <div className="w-12 h-12 bg-brand-navy rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        </div>
        <h1 className="text-xl font-extrabold text-brand-navy">OFSERCONT IA</h1>
        <p className="text-sm text-slate-500 mt-1">Inicia sesión en tu cuenta</p>
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
