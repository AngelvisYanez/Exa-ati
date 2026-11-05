import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Tipos de Documento SRI (Catálogo SRI 1.1.1) ──
  const docTypes = [
    { codigo: '01', nombre: 'Factura', descripcion: 'Comprobante de factura electrónica', version: '2.10.0' },
    { codigo: '02', nombre: 'Nota de Crédito', descripcion: 'Nota de crédito electrónica', version: '2.10.0' },
    { codigo: '03', nombre: 'Nota de Débito', descripcion: 'Nota de débito electrónica', version: '2.10.0' },
    { codigo: '04', nombre: 'Guía de Remisión', descripcion: 'Guía de remisión electrónica', version: '2.10.0' },
    { codigo: '05', nombre: 'Comprobante de Retención', descripcion: 'Comprobante de retención electrónica', version: '2.10.0' },
    { codigo: '06', nombre: 'Nota de Venta', descripcion: 'Nota de venta (POS)', version: '2.10.0' },
    { codigo: '07', nombre: 'Comprobante de Liquidación de Compra', descripcion: 'Liquidación de compra de bienes o prestación de servicios', version: '2.10.0' },
  ];
  for (const dt of docTypes) {
    await prisma.tipoDocumentoSri.upsert({
      where: { codigo: dt.codigo },
      update: dt,
      create: dt,
    });
  }

  // ── Tipos de Sustento Tributario ──
  const sustento = [
    { codigo: '01', nombre: 'Fiscal', descripcion: 'Gastos generales con derecho a crédito tributario' },
    { codigo: '02', nombre: 'Fiscal con sustento', descripcion: 'Gastos con derecho a crédito fiscal con sustento específico' },
    { codigo: '03', nombre: 'No fiscal', descripcion: 'Gastos que no tienen derecho a crédito tributario' },
    { codigo: '04', nombre: 'Sustento de exportación', descripcion: 'Operaciones de exportación' },
    { codigo: '05', nombre: 'Gastos locales', descripcion: 'Gastos y costas judiciales' },
    { codigo: '06', nombre: 'Reembolso', descripcion: 'Reembolso de gastos' },
    { codigo: '07', nombre: 'Gastos fiscales no deducibles', descripcion: 'Gastos no deducibles local o importados' },
    { codigo: '08', nombre: 'Gastos no acogidos', descripcion: 'Gastos no acogidos a deducción alguna' },
    { codigo: '09', nombre: 'Comprobante líquido', descripcion: 'Adquisiciones con liquidación de compra' },
    { codigo: '10', nombre: 'Gastos con retención total', descripcion: 'Gastos con retención total del IVA' },
  ];
  for (const s of sustento) {
    await prisma.tipoSustentoTributario.upsert({
      where: { codigo: s.codigo },
      update: s,
      create: s,
    });
  }

  // ── Motivos de Traslado ──
  const motivos = [
    { codigo: '01', nombre: 'Venta', descripcion: 'Traslado por venta de bienes' },
    { codigo: '02', nombre: 'Compra', descripcion: 'Traslado por compra de bienes' },
    { codigo: '03', nombre: 'Consignación', descripcion: 'Traslado por consignación de bienes' },
    { codigo: '04', nombre: 'Devolución', descripcion: 'Traslado por devolución de bienes' },
    { codigo: '05', nombre: 'Exportación', descripcion: 'Traslado por exportación de bienes' },
    { codigo: '06', nombre: 'Importación', descripcion: 'Traslado por importación de bienes' },
    { codigo: '07', nombre: 'Traslado interno', descripcion: 'Traslado entre establecimientos del mismo contribuyente' },
    { codigo: '08', nombre: 'Otros', descripcion: 'Otros traslados no contemplados' },
  ];
  for (const m of motivos) {
    await prisma.motivoTraslado.upsert({
      where: { codigo: m.codigo },
      update: m,
      create: m,
    });
  }

  // ── Impuestos Ecuador ──
  const impuestos = [
    // IVA 0% (bienes)
    { codigo: '2', codigoPorcentaje: '0', nombre: 'IVA 0%', porcentaje: 0, tarifa: 0, tipoImpuesto: 'IVA', codigoAts: '1501', codigoFormulario103: '401', codigoFormulario104: '401' },
    // IVA 12%
    { codigo: '2', codigoPorcentaje: '2', nombre: 'IVA 12%', porcentaje: 12, tarifa: 12, tipoImpuesto: 'IVA', codigoAts: '1502', codigoFormulario103: '402', codigoFormulario104: '402' },
    // IVA 14% (Región Amazonía)
    { codigo: '2', codigoPorcentaje: '3', nombre: 'IVA 14%', porcentaje: 14, tarifa: 14, tipoImpuesto: 'IVA', codigoAts: '1503', codigoFormulario103: '403', codigoFormulario104: '403' },
    // IVA 15%
    { codigo: '2', codigoPorcentaje: '4', nombre: 'IVA 15%', porcentaje: 15, tarifa: 15, tipoImpuesto: 'IVA', codigoAts: '1504', codigoFormulario103: '404', codigoFormulario104: '404' },
    // ICE
    { codigo: '3', codigoPorcentaje: '0', nombre: 'ICE 0%', porcentaje: 0, tarifa: 0, tipoImpuesto: 'ICE', codigoAts: '2101', codigoFormulario103: '411', codigoFormulario104: '411' },
    { codigo: '3', codigoPorcentaje: '12', nombre: 'ICE 12%', porcentaje: 12, tarifa: 12, tipoImpuesto: 'ICE', codigoAts: '2102', codigoFormulario103: '412', codigoFormulario104: '412' },
    // IRBPNR
    { codigo: '5', codigoPorcentaje: '0', nombre: 'IRBPNR 0%', porcentaje: 0, tarifa: 0, tipoImpuesto: 'IRBPNR', codigoAts: '2201', codigoFormulario103: '421', codigoFormulario104: '421' },
    // Retención Renta
    { codigo: '6', codigoPorcentaje: '1', nombre: 'Renta 1%', porcentaje: 1, tarifa: 1, tipoImpuesto: 'RENTA', codigoAts: '3201', codigoFormulario103: '321', codigoFormulario104: '322' },
    { codigo: '6', codigoPorcentaje: '2', nombre: 'Renta 2%', porcentaje: 2, tarifa: 2, tipoImpuesto: 'RENTA', codigoAts: '3202', codigoFormulario103: '322', codigoFormulario104: '323' },
    { codigo: '6', codigoPorcentaje: '8', nombre: 'Renta 8%', porcentaje: 8, tarifa: 8, tipoImpuesto: 'RENTA', codigoAts: '3203', codigoFormulario103: '323', codigoFormulario104: '324' },
    { codigo: '6', codigoPorcentaje: '10', nombre: 'Renta 10%', porcentaje: 10, tarifa: 10, tipoImpuesto: 'RENTA', codigoAts: '3204', codigoFormulario103: '324', codigoFormulario104: '325' },
    // Retención IVA
    { codigo: '7', codigoPorcentaje: '10', nombre: 'Ret IVA 10%', porcentaje: 10, tarifa: 10, tipoImpuesto: 'IVA_RET', codigoAts: '3401', codigoFormulario103: '331', codigoFormulario104: '331' },
    { codigo: '7', codigoPorcentaje: '20', nombre: 'Ret IVA 20%', porcentaje: 20, tarifa: 20, tipoImpuesto: 'IVA_RET', codigoAts: '3402', codigoFormulario103: '332', codigoFormulario104: '332' },
    { codigo: '7', codigoPorcentaje: '30', nombre: 'Ret IVA 30%', porcentaje: 30, tarifa: 30, tipoImpuesto: 'IVA_RET', codigoAts: '3403', codigoFormulario103: '333', codigoFormulario104: '333' },
    { codigo: '7', codigoPorcentaje: '50', nombre: 'Ret IVA 50%', porcentaje: 50, tarifa: 50, tipoImpuesto: 'IVA_RET', codigoAts: '3404', codigoFormulario103: '334', codigoFormulario104: '334' },
    { codigo: '7', codigoPorcentaje: '70', nombre: 'Ret IVA 70%', porcentaje: 70, tarifa: 70, tipoImpuesto: 'IVA_RET', codigoAts: '3405', codigoFormulario103: '335', codigoFormulario104: '335' },
    { codigo: '7', codigoPorcentaje: '100', nombre: 'Ret IVA 100%', porcentaje: 100, tarifa: 100, tipoImpuesto: 'IVA_RET', codigoAts: '3406', codigoFormulario103: '336', codigoFormulario104: '336' },
  ];

  // ── Tenant por defecto (si no existe) ──
  let tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        nombre: 'Empresa por defecto',
        ruc: '0000000000001',
        activo: true,
      },
    });
    console.log(`[SEED] Tenant por defecto creado: ${tenant.id}`);
  } else {
    console.log(`[SEED] Usando tenant existente: ${tenant.id} — ${tenant.nombre}`);
  }

  // ── Impuestos Ecuador ──
  for (const imp of impuestos) {
    await prisma.impuesto.upsert({
      where: { tenantId_codigo_codigoPorcentaje: { tenantId: tenant.id, codigo: imp.codigo, codigoPorcentaje: imp.codigoPorcentaje } },
      update: imp,
      create: { ...imp, tenantId: tenant.id },
    });
  }

  console.log('[SEED] Seed completed successfully');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
