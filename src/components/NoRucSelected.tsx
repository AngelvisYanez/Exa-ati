"use client";

import { Building2 } from "lucide-react";

export function NoRucSelected() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="rounded-full bg-muted p-6">
        <Building2 className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">Selecciona una empresa</h2>
      <p className="text-muted-foreground max-w-md">
        Para comenzar, selecciona un RUC de la barra lateral o vincula uno nuevo con el SRI.
      </p>
    </div>
  );
}
