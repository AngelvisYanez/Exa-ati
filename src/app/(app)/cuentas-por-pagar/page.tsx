"use client";

import Topbar from "@/components/layout/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import CuentasModule from "@/components/cuentas/CuentasModule";

export default function CuentasPorPagarPage() {
  return (
    <>
      <title>Cuentas por Pagar - EXA ATI</title>
      <Topbar title="Cuentas por Pagar" />
      <main className="ui-page flex-1">
        <PageHeader
          title="Cuentas por Pagar"
          description="Controla las obligaciones con tus proveedores, sus saldos y los pagos realizados."
        />
        <CuentasModule tipo="PAGAR" />
      </main>
    </>
  );
}
