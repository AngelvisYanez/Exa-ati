"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";

type Account = { id: number; banco: string; titular: string; identificacion: string; tipoCuenta: "AHORROS" | "CORRIENTE"; numeroCuenta: string; activo: boolean; orden: number };
const empty: Omit<Account, "id"> = { banco: "", titular: "", identificacion: "", tipoCuenta: "AHORROS", numeroCuenta: "", activo: true, orden: 0 };
const inputClass = "w-full rounded-lg border border-brand-gray-200 px-3 py-2 text-sm";

export default function BankAccountsAdmin() {
  const [rows, setRows] = useState<Account[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Account, "id">>(empty);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { const res = await apiFetch("/api/admin/metodos-pago/cuentas"); if (!res.ok) throw new Error(); setRows((await res.json()).data || []); }
    catch { toast.error("No se pudieron cargar las cuentas bancarias"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await apiFetch(editing ? `/api/admin/metodos-pago/cuentas/${editing}` : "/api/admin/metodos-pago/cuentas", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).message || "No se pudo guardar");
      toast.success("Cuenta guardada"); setEditing(null); setForm(empty); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar"); }
    finally { setSaving(false); }
  };
  const remove = async (id: number) => {
    if (!confirm("¿Eliminar esta cuenta bancaria?")) return;
    const res = await apiFetch(`/api/admin/metodos-pago/cuentas/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("No se pudo eliminar la cuenta"); return; }
    toast.success("Cuenta eliminada"); await load();
  };
  const field = (key: "banco" | "titular" | "identificacion" | "numeroCuenta", label: string) => <label className="text-xs font-medium text-brand-gray-700">{label}<input required className={`${inputClass} mt-1`} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>;
  return <section className="mt-8 space-y-4">
    <div><h2 className="text-lg font-bold text-brand-gray-800">Cuentas para transferencias</h2><p className="text-xs text-brand-gray-500">Puedes publicar varias cuentas. Solo las activas se muestran a los suscriptores.</p></div>
    <div className="grid gap-3 md:grid-cols-2">{rows.map(row => <div key={row.id} className="rounded-xl border border-brand-gray-200 bg-white p-4 text-sm">
      <div className="flex justify-between gap-3"><strong>{row.banco}</strong><span>{row.activo ? "Activa" : "Inactiva"}</span></div>
      <p>{row.titular} · {row.tipoCuenta.toLowerCase()}</p><p className="font-mono">{row.numeroCuenta}</p><p className="text-xs text-brand-gray-500">Identificación: {row.identificacion}</p>
      <div className="mt-3 flex gap-3 text-xs"><button type="button" className="text-brand-red underline" onClick={() => { setEditing(row.id); setForm({ banco: row.banco, titular: row.titular, identificacion: row.identificacion, tipoCuenta: row.tipoCuenta, numeroCuenta: row.numeroCuenta, activo: row.activo, orden: row.orden }); }}>Editar</button><button type="button" className="text-brand-red underline" onClick={() => void remove(row.id)}>Eliminar</button></div>
    </div>)}</div>
    <form onSubmit={save} className="grid gap-3 rounded-xl border border-brand-gray-200 bg-white p-4 md:grid-cols-2">
      <h3 className="font-bold md:col-span-2">{editing ? "Editar cuenta" : "Agregar cuenta bancaria"}</h3>
      {field("banco", "Banco")}{field("titular", "Titular")}{field("identificacion", "RUC o identificación")}{field("numeroCuenta", "Número de cuenta")}
      <label className="text-xs font-medium">Tipo de cuenta<select className={`${inputClass} mt-1`} value={form.tipoCuenta} onChange={e => setForm({ ...form, tipoCuenta: e.target.value as Account["tipoCuenta"] })}><option value="AHORROS">Ahorros</option><option value="CORRIENTE">Corriente</option></select></label>
      <label className="text-xs font-medium">Orden<input className={`${inputClass} mt-1`} type="number" min="0" value={form.orden} onChange={e => setForm({ ...form, orden: Number(e.target.value) })} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} />Publicar cuenta</label>
      <div className="flex gap-2 md:col-span-2"><button disabled={saving} className="rounded-lg bg-brand-red px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar cuenta"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>}</div>
    </form>
    <div className="rounded-xl border border-brand-gray-200 bg-brand-gray-50 p-4 text-sm"><strong>BENDO · Próximamente</strong><p className="text-brand-gray-500">Se habilitará cuando esté lista la integración.</p></div>
  </section>;
}
