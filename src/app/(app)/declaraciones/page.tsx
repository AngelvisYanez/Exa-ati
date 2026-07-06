"use client";

import Link from "next/link";
import Topbar from "@/components/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, FileSpreadsheet, BarChart3, History, ArrowRight } from "lucide-react";

const sections = [
  {
    href: "/declaraciones/reportes/nuevo?tipo=103",
    title: "Formulario 103",
    desc: "Declaración de IVA - formulario oficial SRI",
    icon: FileText,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    href: "/declaraciones/reportes/nuevo?tipo=104",
    title: "Formulario 104",
    desc: "Declaración de Impuesto a la Renta",
    icon: FileSpreadsheet,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    href: "/declaraciones/ats",
    title: "ATS",
    desc: "Anexo Transaccional Simplificado",
    icon: BarChart3,
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    href: "/declaraciones/reportes",
    title: "Historial",
    desc: "Declaraciones y reportes generados anteriormente",
    icon: History,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

export default function DeclaracionesPage() {
  return (
    <>
      <title>Declaraciones - OFSERCONT IA</title>
      <Topbar title="Declaraciones" />
      <main className="p-3 flex-1 flex flex-col gap-5 w-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-gray-800">Declaraciones Tributarias</h1>
          <p className="text-sm text-brand-gray-500 mt-1">
            Gestión de formularios SRI, ATS y reportes fiscales
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

        <div className="bg-white border border-brand-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-brand-gray-800 mb-3">Declaraciones Recientes</h2>
          <p className="text-xs text-brand-gray-400">Las declaraciones generadas aparecerán aquí. Usa las opciones arriba para crear una nueva.</p>
        </div>
      </main>
    </>
  );
}
