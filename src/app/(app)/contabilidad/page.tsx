"use client";

import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  BookOpen,
  Receipt,
  ShieldCheck,
  Library,
  ArrowRight,
  Search,
  HandCoins,
  Wallet,
  Scale,
} from "lucide-react";

const sections = [
  {
    href: "/contabilidad/consulta-rag",
    title: "Consulta RAG",
    desc: "Preguntas en lenguaje natural sobre contabilidad, documentos, contactos, inventario, nómina y CxC/CxP",
    icon: Search,
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },

  {
    href: "/contabilidad/diario",
    title: "Libro Diario",
    desc: "Registra asientos contables y genera desde comprobantes autorizados",
    icon: BookOpen,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    href: "/contabilidad/balance",
    title: "Balance de Comprobación",
    desc: "Consulta saldos por cuenta contable",
    icon: Scale,
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  {
    href: "/contabilidad/plan-cuentas",
    title: "Plan de Cuentas",
    desc: "Administra el catálogo contable con estructura jerárquica",
    icon: BookOpen,
    color: "bg-sky-50 text-brand-sky border-sky-200",
  },
  {
    href: "/contabilidad/impuestos",
    title: "Impuestos",
    desc: "Gestiona IVA, ICE, Renta y retenciones",
    icon: Receipt,
    color: "bg-success-pale text-success border-success-light/40",
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
  {
    href: "/cuentas-por-cobrar",
    title: "Cuentas por Cobrar",
    desc: "Controla facturas a crédito, saldos y pagos de clientes",
    icon: HandCoins,
    color: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    href: "/cuentas-por-pagar",
    title: "Cuentas por Pagar",
    desc: "Controla obligaciones con proveedores y pagos realizados",
    icon: Wallet,
    color: "bg-teal-50 text-teal-700 border-teal-200",
  },
];

export default function ContabilidadPage() {
  return (
    <>
      <title>Contabilidad - OFSERCONT IA</title>
      <Topbar title="Contabilidad" />
      <main className="ui-page flex-1">
        <PageHeader
          title="Módulo Contable"
          description="Gestión del plan de cuentas, impuestos y configuraciones contables"
        />

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
                    <div className="flex items-center gap-1 text-xs font-bold text-brand-red mt-3">
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
