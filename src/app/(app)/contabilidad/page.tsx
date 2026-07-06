"use client";

import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  Receipt,
  ShieldCheck,
  Library,
  ArrowRight,
} from "lucide-react";

const sections = [
  {
    href: "/contabilidad/plan-cuentas",
    title: "Plan de Cuentas",
    desc: "Administra el catálogo contable con estructura jerárquica",
    icon: BookOpen,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    href: "/contabilidad/impuestos",
    title: "Impuestos",
    desc: "Gestiona IVA, ICE, Renta y retenciones",
    icon: Receipt,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    href: "/contabilidad/posiciones-fiscales",
    title: "Posiciones Fiscales",
    desc: "Configura combinaciones de impuestos por tipo de comprobante",
    icon: ShieldCheck,
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    href: "/contabilidad/catalogos",
    title: "Catálogos",
    desc: "Mantenimiento de tablas del sistema contable",
    icon: Library,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

export default function ContabilidadPage() {
  return (
    <>
      <title>Contabilidad - OFSERCONT IA</title>
      <Topbar title="Contabilidad" />
      <main className="p-3 flex-1 flex flex-col gap-5 w-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-gray-800">Módulo Contable</h1>
          <p className="text-sm text-brand-gray-500 mt-1">
            Gestión del plan de cuentas, impuestos y configuraciones contables
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.href} href={s.href}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-brand-gray-200">
                  <CardHeader>
                    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${s.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-sm font-bold text-brand-gray-800 mt-2">{s.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-brand-gray-500 leading-relaxed">{s.desc}</p>
                    <div className="flex items-center gap-1 text-xs font-bold text-brand-navy mt-3">
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
