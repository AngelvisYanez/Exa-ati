"use client";

import Topbar from "@/components/layout/Topbar";
import AutorizacionesPanel from "@/components/autorizaciones/AutorizacionesPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";

export default function AutorizacionesPage() {
  const { hasSriLinked } = useAuth();

  return (
    <>
      <title>Autorizaciones - OFSERCONT IA</title>
      <Topbar title="Autorizaciones" />
      <main className="ui-page flex-1">
        {hasSriLinked ? (
          <AutorizacionesPanel />
        ) : (
          <EmptyState title="Vincula tu RUC del SRI en Configuración para definir la numeración." />
        )}
      </main>
    </>
  );
}
