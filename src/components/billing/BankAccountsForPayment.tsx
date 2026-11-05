"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

type Account = { banco: string; titular: string; identificacion: string; tipoCuenta: string; numeroCuenta: string };

export default function BankAccountsForPayment() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    let active = true;
    apiFetch("/api/billing/cuentas-bancarias").then(async res => {
      if (res.ok && active) setAccounts((await res.json()).data || []);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <div className="mb-6 space-y-3">
    {accounts.length ? accounts.map((account, i) => <div key={`${account.numeroCuenta}-${i}`} className="rounded-xl border border-brand-gray-200 bg-white p-4 text-sm">
      <p className="font-bold">{account.banco} · {account.tipoCuenta.toLowerCase()}</p>
      <p>Titular: {account.titular}</p><p>Identificación: {account.identificacion}</p>
      <p className="font-mono font-semibold">Cuenta: {account.numeroCuenta}</p>
    </div>) : <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Administración todavía no ha publicado cuentas bancarias para transferencias.</p>}
    <p className="text-xs text-brand-gray-500">Conserva el comprobante y envíalo a administración. El plan se activa tras verificar el pago.</p>
  </div>;
}
