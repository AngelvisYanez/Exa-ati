"use client";

import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FileText, Users, BarChart3, Shield, FolderTree, Receipt, ArrowRight } from "lucide-react";

const sections = [
  {
    href: "/control-tributario/mensual",
    title: "Declaraci\u00f3n Mensual",
    desc: "Formularios 104/103 - IVA y Retenciones",
    icon: FileText,
    color: "bg-sky-50 text-brand-sky border-sky-200",
  },
  {
    href: "/control-tributario/planillas-iess",
    title: "Planillas IESS",
    desc: "Aportes patronales, d\u00e9cimos y fondos de reserva",
    icon: Users,
    color: "bg-success-pale text-success border-success-light/40",
  },
  {
    href: "/control-tributario/resumen-ir",
    title: "Resumen Anual IR",
    desc: "Impuesto a la Renta - Conciliaci\u00f3n tributaria",
    icon: BarChart3,
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    href: "/control-tributario/obligaciones",
    title: "Obligaciones",
    desc: "Sem\u00e1foro de cumplimiento tributario",
    icon: Shield,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    href: "/control-tributario/documentos",
    title: "Documentos Fiscales",
    desc: "Repositorio de declaraciones y comprobantes",
    icon: FolderTree,
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    href: "/declaraciones/reportes",
    title: "Formularios 103/104",
    desc: "Declaraciones SRI de periodos anteriores",
    icon: Receipt,
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
];

export default function ControlTributarioPage() {
  return (
    <>
      <title>Control Tributario - OFSERCONT IA</title>
      <Topbar title="Control Tributario" />
      <main className="ui-page flex-1">
        <PageHeader
          title="Control Tributario"
          description="Gestión integral de obligaciones fiscales, planillas IESS y declaraciones SRI"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.href} href={s.href}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-brand-gray-200">
                  <CardHeader>
                    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${s.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-sm font-semibold mt-2">{s.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-brand-gray-500">{s.desc}</p>
                    <div className="flex items-center gap-1 mt-3 text-xs font-medium text-brand-red">
                      Ingresar <ArrowRight className="w-3 h-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
