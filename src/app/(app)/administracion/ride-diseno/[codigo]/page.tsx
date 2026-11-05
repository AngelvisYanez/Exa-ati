"use client";

import { useParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { SuperadminOnly } from "@/components/admin/SuperadminOnly";
import { RideDisenoEditor } from "@/components/admin/RideDisenoEditor";

function EditarDiseno() {
  const { codigo: codigoParam } = useParams<{ codigo: string }>();
  const codigo = decodeURIComponent(codigoParam);

  return (
    <>
      <Topbar title="Editar diseño RIDE" backLink={{ href: "/administracion/ride-diseno", label: "Diseños" }} />
      <main className="ui-page flex-1 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-brand-gray-800">Editar diseño</h1>
          <p className="text-xs text-brand-gray-500 mt-1">
            Los cambios se ven en la vista previa. Para que salgan en las facturas, márcalo como diseño en uso.
          </p>
        </div>
        <RideDisenoEditor mode="edit" codigo={codigo} />
      </main>
    </>
  );
}

export default function EditarRideDisenoPage() {
  return (
    <SuperadminOnly>
      <EditarDiseno />
    </SuperadminOnly>
  );
}
