"use client";

import Topbar from "@/components/layout/Topbar";
import { SuperadminOnly } from "@/components/admin/SuperadminOnly";
import { RideDisenoEditor } from "@/components/admin/RideDisenoEditor";

function NuevoDiseno() {
  return (
    <>
      <Topbar title="Nuevo diseño RIDE" backLink={{ href: "/administracion/ride-diseno", label: "Diseños" }} />
      <main className="ui-page flex-1 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold tracking-tight text-brand-gray-800 mb-1">Nuevo diseño</h1>
        <p className="text-xs text-brand-gray-500 mb-6">
          Parte de una plantilla, ajusta el contenido y revisa la factura de ejemplo antes de guardarla.
        </p>
        <RideDisenoEditor mode="create" />
      </main>
    </>
  );
}

export default function NuevoRideDisenoPage() {
  return (
    <SuperadminOnly>
      <NuevoDiseno />
    </SuperadminOnly>
  );
}
