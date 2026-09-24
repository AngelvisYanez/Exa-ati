"use client";

import Topbar from "@/components/layout/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import CuentasModule from "@/components/cuentas/CuentasModule";

export default function CuentasPorCobrarPage() {
  return (
    <>
      <title>Cuentas por Cobrar - EXA ATI</title>
      <Topbar title="Cuentas por Cobrar" />
      <main className="ui-page flex-1">
        <PageHeader
          title="Cuentas por Cobrar"
          description="Controla las facturas emitidas a crédito, sus saldos y los pagos recibidos de tus clientes."
        />
        <CuentasModule tipo="COBRAR" />
      </main>
    </>
  );
}
