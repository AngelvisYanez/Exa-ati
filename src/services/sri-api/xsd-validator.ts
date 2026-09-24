import * as xml2js from 'xml2js';

export interface ValidationResult {
  valid: boolean;
  tipo?: string;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

type Rule = (
  obj: any,
  path: string,
  errors: ValidationError[],
  warnings: ValidationError[]
) => void;

function isPresent(val: any): boolean {
  return val !== undefined && val !== null && val !== '';
}

function req(path: string, field: string): string {
  return `${path}.${field}`;
}

function ruleRequired(obj: any, path: string, field: string): Rule {
  return (_o, _p, errors) => {
    if (!isPresent(obj[field])) {
      errors.push({ path: req(path, field), message: `Campo requerido '${field}'`, severity: 'error' });
    }
  };
}

function ruleDecimal(obj: any, path: string, field: string, decimals: number): Rule {
  return (_o, _p, errors) => {
    const v = obj[field];
    if (isPresent(v)) {
      const parts = String(v).split('.');
      if (parts.length === 2 && parts[1].length > decimals) {
        errors.push({ path: req(path, field), message: `Máximo ${decimals} decimales`, severity: 'error' });
      }
    }
  };
}

function ruleMaxLength(obj: any, path: string, field: string, max: number): Rule {
  return (_o, _p, errors) => {
    const v = obj[field];
    if (isPresent(v) && String(v).length > max) {
      errors.push({ path: req(path, field), message: `Máximo ${max} caracteres`, severity: 'error' });
    }
  };
}

function applyRules(obj: any, path: string, rules: Rule[], errors: ValidationError[], warnings: ValidationError[]) {
  for (const rule of rules) {
    rule(obj, path, errors, warnings);
  }
}

function validateImpuesto(obj: any, path: string, errors: ValidationError[], warnings: ValidationError[]) {
  applyRules(obj, path, [
    ruleRequired(obj, path, 'codigo'),
    ruleRequired(obj, path, 'codigoPorcentaje'),
    ruleRequired(obj, path, 'baseImponible'),
    ruleRequired(obj, path, 'valor'),
    ruleDecimal(obj, path, 'baseImponible', 2),
    ruleDecimal(obj, path, 'valor', 2),
  ], errors, warnings);
}

function validateInfoTributaria(obj: any, path: string, errors: ValidationError[], warnings: ValidationError[]) {
  applyRules(obj, path, [
    ruleRequired(obj, path, 'ambiente'),
    ruleRequired(obj, path, 'tipoEmision'),
    ruleRequired(obj, path, 'razonSocial'),
    ruleRequired(obj, path, 'ruc'),
    ruleRequired(obj, path, 'claveAcceso'),
    ruleRequired(obj, path, 'codDoc'),
    ruleRequired(obj, path, 'estab'),
    ruleRequired(obj, path, 'ptoEmi'),
    ruleRequired(obj, path, 'secuencial'),
    ruleRequired(obj, path, 'dirMatriz'),
    ruleMaxLength(obj, path, 'ruc', 13),
    ruleMaxLength(obj, path, 'estab', 3),
    ruleMaxLength(obj, path, 'ptoEmi', 3),
    ruleMaxLength(obj, path, 'secuencial', 9),
  ], errors, warnings);
}

function validatePagos(obj: any, path: string, errors: ValidationError[], warnings: ValidationError[]) {
  const pagos = obj.pagos?.pago;
  if (!pagos) {
    errors.push({ path: `${path}.pagos`, message: 'Se requiere al menos un pago', severity: 'error' });
    return;
  }
  const arr = Array.isArray(pagos) ? pagos : [pagos];
  arr.forEach((p: any, i: number) => {
    applyRules(p, `${path}.pagos.pago[${i}]`, [
      ruleRequired(p, `${path}.pagos.pago[${i}]`, 'formaPago'),
      ruleRequired(p, `${path}.pagos.pago[${i}]`, 'total'),
      ruleDecimal(p, `${path}.pagos.pago[${i}]`, 'total', 2),
    ], errors, warnings);
  });
}

const rootRules: Record<string, { element: string; version: string; rules: Rule[]; allowInfoAdicional: boolean }> = {
  '01': {
    element: 'factura',
    version: '1.1.0',
    allowInfoAdicional: true,
    rules: [
      (o, p, e, w) => validateInfoTributaria(o.infoTributaria, `${p}.infoTributaria`, e, w),
      (o, p, e, w) => {
        const inf = o.infoFactura;
        if (!inf) { e.push({ path: `${p}.infoFactura`, message: 'infoFactura requerido', severity: 'error' }); return; }
        applyRules(inf, `${p}.infoFactura`, [
          ruleRequired(inf, `${p}.infoFactura`, 'fechaEmision'),
          ruleRequired(inf, `${p}.infoFactura`, 'obligadoContabilidad'),
          ruleRequired(inf, `${p}.infoFactura`, 'tipoIdentificacionComprador'),
          ruleRequired(inf, `${p}.infoFactura`, 'razonSocialComprador'),
          ruleRequired(inf, `${p}.infoFactura`, 'identificacionComprador'),
          ruleRequired(inf, `${p}.infoFactura`, 'totalSinImpuestos'),
          ruleRequired(inf, `${p}.infoFactura`, 'totalDescuento'),
          ruleRequired(inf, `${p}.infoFactura`, 'importeTotal'),
          ruleDecimal(inf, `${p}.infoFactura`, 'totalSinImpuestos', 2),
          ruleDecimal(inf, `${p}.infoFactura`, 'totalDescuento', 2),
          ruleDecimal(inf, `${p}.infoFactura`, 'importeTotal', 2),
        ], e, w);
        if (inf.totalConImpuestos?.totalImpuesto) {
          const imps = Array.isArray(inf.totalConImpuestos.totalImpuesto)
            ? inf.totalConImpuestos.totalImpuesto : [inf.totalConImpuestos.totalImpuesto];
          imps.forEach((imp: any, i: number) => validateImpuesto(imp, `${p}.infoFactura.totalConImpuestos.totalImpuesto[${i}]`, e, w));
        } else {
          e.push({ path: `${p}.infoFactura.totalConImpuestos`, message: 'totalConImpuestos requerido', severity: 'error' });
        }
        validatePagos(inf, `${p}.infoFactura`, e, w);
      },
      (o, p, e, w) => {
        const detalles = o.detalles?.detalle;
        if (!detalles) { e.push({ path: `${p}.detalles`, message: 'detalles requerido', severity: 'error' }); return; }
        const arr = Array.isArray(detalles) ? detalles : [detalles];
        arr.forEach((d: any, i: number) => {
          const dp = `${p}.detalles.detalle[${i}]`;
          applyRules(d, dp, [
            ruleRequired(d, dp, 'codigoPrincipal'),
            ruleRequired(d, dp, 'descripcion'),
            ruleRequired(d, dp, 'cantidad'),
            ruleRequired(d, dp, 'precioUnitario'),
            ruleRequired(d, dp, 'descuento'),
            ruleRequired(d, dp, 'precioTotalSinImpuesto'),
            ruleDecimal(d, dp, 'cantidad', 6),
            ruleDecimal(d, dp, 'precioUnitario', 6),
            ruleDecimal(d, dp, 'descuento', 2),
            ruleDecimal(d, dp, 'precioTotalSinImpuesto', 2),
          ], e, w);
          if (d.impuestos?.impuesto) {
            const dimps = Array.isArray(d.impuestos.impuesto) ? d.impuestos.impuesto : [d.impuestos.impuesto];
            dimps.forEach((imp: any, j: number) => validateImpuesto(imp, `${dp}.impuestos.impuesto[${j}]`, e, w));
          } else {
            e.push({ path: `${dp}.impuestos`, message: 'impuestos requerido en detalle', severity: 'error' });
          }
        });
      },
    ],
  },
  '03': {
    element: 'liquidacionCompra',
    version: '1.1.0',
    allowInfoAdicional: true,
    rules: [
      (o, p, e, w) => validateInfoTributaria(o.infoTributaria, `${p}.infoTributaria`, e, w),
      (o, p, e, w) => {
        const inf = o.infoLiquidacionCompra;
        if (!inf) { e.push({ path: `${p}.infoLiquidacionCompra`, message: 'infoLiquidacionCompra requerido', severity: 'error' }); return; }
        applyRules(inf, `${p}.infoLiquidacionCompra`, [
          ruleRequired(inf, `${p}.infoLiquidacionCompra`, 'fechaEmision'),
          ruleRequired(inf, `${p}.infoLiquidacionCompra`, 'obligadoContabilidad'),
          ruleRequired(inf, `${p}.infoLiquidacionCompra`, 'tipoIdentificacionProveedor'),
          ruleRequired(inf, `${p}.infoLiquidacionCompra`, 'razonSocialProveedor'),
          ruleRequired(inf, `${p}.infoLiquidacionCompra`, 'identificacionProveedor'),
          ruleRequired(inf, `${p}.infoLiquidacionCompra`, 'totalSinImpuestos'),
          ruleRequired(inf, `${p}.infoLiquidacionCompra`, 'totalDescuento'),
          ruleDecimal(inf, `${p}.infoLiquidacionCompra`, 'totalSinImpuestos', 2),
          ruleDecimal(inf, `${p}.infoLiquidacionCompra`, 'totalDescuento', 2),
        ], e, w);
      },
      (o, p, e, w) => {
        if (o.totalConImpuestos?.totalImpuesto) {
          const imps = Array.isArray(o.totalConImpuestos.totalImpuesto)
            ? o.totalConImpuestos.totalImpuesto : [o.totalConImpuestos.totalImpuesto];
          imps.forEach((imp: any, i: number) => validateImpuesto(imp, `${p}.totalConImpuestos.totalImpuesto[${i}]`, e, w));
        } else {
          e.push({ path: `${p}.totalConImpuestos`, message: 'totalConImpuestos requerido', severity: 'error' });
        }
      },
      (o, p, e, w) => {
        if (o.importeTotal === undefined) {
          e.push({ path: `${p}.importeTotal`, message: 'importeTotal requerido', severity: 'error' });
        }
      },
      (o, p, e, w) => validatePagos(o, `${p}`, e, w),
      (o, p, e, w) => {
        const detalles = o.detalles?.detalle;
        if (!detalles) { e.push({ path: `${p}.detalles`, message: 'detalles requerido', severity: 'error' }); return; }
        const arr = Array.isArray(detalles) ? detalles : [detalles];
        arr.forEach((d: any, i: number) => {
          const dp = `${p}.detalles.detalle[${i}]`;
          applyRules(d, dp, [
            ruleRequired(d, dp, 'codigoPrincipal'),
            ruleRequired(d, dp, 'descripcion'),
            ruleRequired(d, dp, 'cantidad'),
            ruleRequired(d, dp, 'precioUnitario'),
            ruleRequired(d, dp, 'descuento'),
            ruleRequired(d, dp, 'precioTotalSinImpuesto'),
            ruleDecimal(d, dp, 'cantidad', 6),
            ruleDecimal(d, dp, 'precioUnitario', 6),
            ruleDecimal(d, dp, 'descuento', 2),
            ruleDecimal(d, dp, 'precioTotalSinImpuesto', 2),
          ], e, w);
          if (d.impuestos?.impuesto) {
            const dimps = Array.isArray(d.impuestos.impuesto) ? d.impuestos.impuesto : [d.impuestos.impuesto];
            dimps.forEach((imp: any, j: number) => validateImpuesto(imp, `${dp}.impuestos.impuesto[${j}]`, e, w));
          } else {
            e.push({ path: `${dp}.impuestos`, message: 'impuestos requerido en detalle', severity: 'error' });
          }
        });
      },
    ],
  },
  '04': {
    element: 'notaCredito',
    version: '1.1.0',
    allowInfoAdicional: true,
    rules: [
      (o, p, e, w) => validateInfoTributaria(o.infoTributaria, `${p}.infoTributaria`, e, w),
      (o, p, e, w) => {
        const inf = o.infoNotaCredito;
        if (!inf) { e.push({ path: `${p}.infoNotaCredito`, message: 'infoNotaCredito requerido', severity: 'error' }); return; }
        applyRules(inf, `${p}.infoNotaCredito`, [
          ruleRequired(inf, `${p}.infoNotaCredito`, 'fechaEmision'),
          ruleRequired(inf, `${p}.infoNotaCredito`, 'tipoIdentificacionComprador'),
          ruleRequired(inf, `${p}.infoNotaCredito`, 'razonSocialComprador'),
          ruleRequired(inf, `${p}.infoNotaCredito`, 'identificacionComprador'),
          ruleRequired(inf, `${p}.infoNotaCredito`, 'codDocModificado'),
          ruleRequired(inf, `${p}.infoNotaCredito`, 'numDocModificado'),
          ruleRequired(inf, `${p}.infoNotaCredito`, 'fechaEmisionDocSustento'),
          ruleRequired(inf, `${p}.infoNotaCredito`, 'totalSinImpuestos'),
          ruleRequired(inf, `${p}.infoNotaCredito`, 'valorModificacion'),
          ruleRequired(inf, `${p}.infoNotaCredito`, 'motivo'),
        ], e, w);
        if (inf.totalConImpuestos?.totalImpuesto) {
          const imps = Array.isArray(inf.totalConImpuestos.totalImpuesto)
            ? inf.totalConImpuestos.totalImpuesto : [inf.totalConImpuestos.totalImpuesto];
          imps.forEach((imp: any, i: number) => validateImpuesto(imp, `${p}.infoNotaCredito.totalConImpuestos.totalImpuesto[${i}]`, e, w));
        } else {
          e.push({ path: `${p}.infoNotaCredito.totalConImpuestos`, message: 'totalConImpuestos requerido', severity: 'error' });
        }
      },
      (o, p, e, w) => {
        const detalles = o.detalles?.detalle;
        if (!detalles) { e.push({ path: `${p}.detalles`, message: 'detalles requerido', severity: 'error' }); return; }
        const arr = Array.isArray(detalles) ? detalles : [detalles];
        arr.forEach((d: any, i: number) => {
          const dp = `${p}.detalles.detalle[${i}]`;
          applyRules(d, dp, [
            ruleRequired(d, dp, 'codigoPrincipal'),
            ruleRequired(d, dp, 'descripcion'),
            ruleRequired(d, dp, 'cantidad'),
            ruleRequired(d, dp, 'precioUnitario'),
            ruleRequired(d, dp, 'descuento'),
            ruleRequired(d, dp, 'precioTotalSinImpuesto'),
          ], e, w);
        });
      },
    ],
  },
  '05': {
    element: 'notaDebito',
    version: '1.0.0',
    allowInfoAdicional: true,
    rules: [
      (o, p, e, w) => validateInfoTributaria(o.infoTributaria, `${p}.infoTributaria`, e, w),
      (o, p, e, w) => {
        const inf = o.infoNotaDebito;
        if (!inf) { e.push({ path: `${p}.infoNotaDebito`, message: 'infoNotaDebito requerido', severity: 'error' }); return; }
        applyRules(inf, `${p}.infoNotaDebito`, [
          ruleRequired(inf, `${p}.infoNotaDebito`, 'fechaEmision'),
          ruleRequired(inf, `${p}.infoNotaDebito`, 'tipoIdentificacionComprador'),
          ruleRequired(inf, `${p}.infoNotaDebito`, 'razonSocialComprador'),
          ruleRequired(inf, `${p}.infoNotaDebito`, 'identificacionComprador'),
          ruleRequired(inf, `${p}.infoNotaDebito`, 'obligadoContabilidad'),
          ruleRequired(inf, `${p}.infoNotaDebito`, 'codDocModificado'),
          ruleRequired(inf, `${p}.infoNotaDebito`, 'numDocModificado'),
          ruleRequired(inf, `${p}.infoNotaDebito`, 'fechaEmisionDocSustento'),
          ruleRequired(inf, `${p}.infoNotaDebito`, 'totalSinImpuestos'),
          ruleRequired(inf, `${p}.infoNotaDebito`, 'valorTotal'),
        ], e, w);
      },
      (o, p, e, w) => {
        if (o.impuestos?.impuesto) {
          const imps = Array.isArray(o.impuestos.impuesto) ? o.impuestos.impuesto : [o.impuestos.impuesto];
          imps.forEach((imp: any, i: number) => validateImpuesto(imp, `${p}.impuestos.impuesto[${i}]`, e, w));
        } else {
          e.push({ path: `${p}.impuestos`, message: 'impuestos requerido en nota de débito', severity: 'error' });
        }
      },
      (o, p, e, w) => {
        if (o.motivos?.motivo) {
          const mts = Array.isArray(o.motivos.motivo) ? o.motivos.motivo : [o.motivos.motivo];
          mts.forEach((m: any, i: number) => {
            applyRules(m, `${p}.motivos.motivo[${i}]`, [
              ruleRequired(m, `${p}.motivos.motivo[${i}]`, 'razon'),
              ruleRequired(m, `${p}.motivos.motivo[${i}]`, 'valor'),
              ruleDecimal(m, `${p}.motivos.motivo[${i}]`, 'valor', 2),
            ], e, w);
          });
        } else {
          e.push({ path: `${p}.motivos`, message: 'motivos requerido', severity: 'error' });
        }
      },
    ],
  },
  '06': {
    element: 'guiaRemision',
    version: '1.1.0',
    allowInfoAdicional: true,
    rules: [
      (o, p, e, w) => validateInfoTributaria(o.infoTributaria, `${p}.infoTributaria`, e, w),
      (o, p, e, w) => {
        const inf = o.infoGuiaRemision;
        if (!inf) { e.push({ path: `${p}.infoGuiaRemision`, message: 'infoGuiaRemision requerido', severity: 'error' }); return; }
        applyRules(inf, `${p}.infoGuiaRemision`, [
          ruleRequired(inf, `${p}.infoGuiaRemision`, 'fechaEmision'),
          ruleRequired(inf, `${p}.infoGuiaRemision`, 'dirPartida'),
          ruleRequired(inf, `${p}.infoGuiaRemision`, 'razonSocialTransportista'),
          ruleRequired(inf, `${p}.infoGuiaRemision`, 'tipoIdentificacionTransportista'),
          ruleRequired(inf, `${p}.infoGuiaRemision`, 'rucTransportista'),
          ruleRequired(inf, `${p}.infoGuiaRemision`, 'obligadoContabilidad'),
          ruleRequired(inf, `${p}.infoGuiaRemision`, 'fechaIniTransporte'),
          ruleRequired(inf, `${p}.infoGuiaRemision`, 'fechaFinTransporte'),
          ruleRequired(inf, `${p}.infoGuiaRemision`, 'placa'),
        ], e, w);
      },
      (o, p, e, w) => {
        const d = o.destinatarios?.destinatario;
        if (!d) { e.push({ path: `${p}.destinatarios`, message: 'destinatarios requerido', severity: 'error' }); return; }
        const arr = Array.isArray(d) ? d : [d];
        arr.forEach((dest: any, i: number) => {
          const dp = `${p}.destinatarios.destinatario[${i}]`;
          applyRules(dest, dp, [
            ruleRequired(dest, dp, 'identificacionDestinatario'),
            ruleRequired(dest, dp, 'razonSocialDestinatario'),
            ruleRequired(dest, dp, 'motivoTraslado'),
            ruleRequired(dest, dp, 'codDocSustento'),
            ruleRequired(dest, dp, 'numDocSustento'),
            ruleRequired(dest, dp, 'numAutDocSustento'),
            ruleRequired(dest, dp, 'fechaEmisionDocSustento'),
          ], e, w);
          if (dest.detalles?.detalle) {
            const darr = Array.isArray(dest.detalles.detalle) ? dest.detalles.detalle : [dest.detalles.detalle];
            darr.forEach((dt: any, j: number) => {
              applyRules(dt, `${dp}.detalles.detalle[${j}]`, [
                ruleRequired(dt, `${dp}.detalles.detalle[${j}]`, 'codigoInterno'),
                ruleRequired(dt, `${dp}.detalles.detalle[${j}]`, 'descripcion'),
                ruleRequired(dt, `${dp}.detalles.detalle[${j}]`, 'cantidad'),
                ruleDecimal(dt, `${dp}.detalles.detalle[${j}]`, 'cantidad', 6),
              ], e, w);
            });
          } else {
            e.push({ path: `${dp}.detalles`, message: 'detalles requerido en destinatario', severity: 'error' });
          }
        });
      },
    ],
  },
  '07': {
    element: 'comprobanteRetencion',
    version: '2.0.0',
    allowInfoAdicional: true,
    rules: [
      (o, p, e, w) => validateInfoTributaria(o.infoTributaria, `${p}.infoTributaria`, e, w),
      (o, p, e, w) => {
        const inf = o.infoCompRetencion;
        if (!inf) { e.push({ path: `${p}.infoCompRetencion`, message: 'infoCompRetencion requerido', severity: 'error' }); return; }
        applyRules(inf, `${p}.infoCompRetencion`, [
          ruleRequired(inf, `${p}.infoCompRetencion`, 'fechaEmision'),
          ruleRequired(inf, `${p}.infoCompRetencion`, 'obligadoContabilidad'),
          ruleRequired(inf, `${p}.infoCompRetencion`, 'tipoIdentificacionSujetoRetenido'),
          ruleRequired(inf, `${p}.infoCompRetencion`, 'razonSocialSujetoRetenido'),
          ruleRequired(inf, `${p}.infoCompRetencion`, 'identificacionSujetoRetenido'),
          ruleRequired(inf, `${p}.infoCompRetencion`, 'periodoFiscal'),
        ], e, w);
      },
      (o, p, e, w) => {
        const docs = o.docsSustento?.docSustento;
        if (!docs) { e.push({ path: `${p}.docsSustento`, message: 'docsSustento requerido', severity: 'error' }); return; }
        const arr = Array.isArray(docs) ? docs : [docs];
        arr.forEach((doc: any, i: number) => {
          const dp = `${p}.docsSustento.docSustento[${i}]`;
          applyRules(doc, dp, [
            ruleRequired(doc, dp, 'codSustento'),
            ruleRequired(doc, dp, 'codDocSustento'),
            ruleRequired(doc, dp, 'numDocSustento'),
            ruleRequired(doc, dp, 'fechaEmisionDocSustento'),
            ruleRequired(doc, dp, 'totalSinImpuestos'),
            ruleRequired(doc, dp, 'importeTotal'),
          ], e, w);
          if (doc.impuestosDocSustento?.impuestoDocSustento) {
            const imps = Array.isArray(doc.impuestosDocSustento.impuestoDocSustento)
              ? doc.impuestosDocSustento.impuestoDocSustento : [doc.impuestosDocSustento.impuestoDocSustento];
            imps.forEach((imp: any, j: number) => {
              applyRules(imp, `${dp}.impuestosDocSustento.impuestoDocSustento[${j}]`, [
                ruleRequired(imp, `${dp}.impuestosDocSustento.impuestoDocSustento[${j}]`, 'codImpuestoDocSustento'),
                ruleRequired(imp, `${dp}.impuestosDocSustento.impuestoDocSustento[${j}]`, 'codigoPorcentaje'),
                ruleRequired(imp, `${dp}.impuestosDocSustento.impuestoDocSustento[${j}]`, 'baseImponible'),
                ruleRequired(imp, `${dp}.impuestosDocSustento.impuestoDocSustento[${j}]`, 'tarifa'),
                ruleRequired(imp, `${dp}.impuestosDocSustento.impuestoDocSustento[${j}]`, 'valorImpuesto'),
              ], e, w);
            });
          }
          if (doc.retenciones?.retencion) {
            const rets = Array.isArray(doc.retenciones.retencion) ? doc.retenciones.retencion : [doc.retenciones.retencion];
            rets.forEach((ret: any, j: number) => {
              applyRules(ret, `${dp}.retenciones.retencion[${j}]`, [
                ruleRequired(ret, `${dp}.retenciones.retencion[${j}]`, 'codigo'),
                ruleRequired(ret, `${dp}.retenciones.retencion[${j}]`, 'codigoRetencion'),
                ruleRequired(ret, `${dp}.retenciones.retencion[${j}]`, 'baseImponible'),
                ruleRequired(ret, `${dp}.retenciones.retencion[${j}]`, 'porcentajeRetener'),
                ruleRequired(ret, `${dp}.retenciones.retencion[${j}]`, 'valorRetenido'),
              ], e, w);
            });
          } else {
            e.push({ path: `${dp}.retenciones`, message: 'retenciones requerido en docSustento', severity: 'error' });
          }
        });
      },
    ],
  },
};

function detectTipo(obj: any): string | null {
  if (obj.factura) return '01';
  if (obj.liquidacionCompra) return '03';
  if (obj.notaCredito) return '04';
  if (obj.notaDebito) return '05';
  if (obj.guiaRemision) return '06';
  if (obj.comprobanteRetencion) return '07';
  return null;
}

export const xsdValidator = {
  detectTipo,

  validate(obj: any, tipoOverride?: string): ValidationResult {
    const tipo = tipoOverride || detectTipo(obj);
    if (!tipo) {
      return { valid: false, errors: [{ path: '$', message: 'No se pudo detectar el tipo de comprobante', severity: 'error' }], warnings: [] };
    }

    const schema = rootRules[tipo];
    if (!schema) {
      return { valid: false, errors: [{ path: '$', message: `Tipo de comprobante '${tipo}' no soportado` , severity: 'error' }], warnings: [] };
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    const root = obj[schema.element];
    if (!root) {
      errors.push({ path: '$', message: `Elemento raíz '${schema.element}' no encontrado`, severity: 'error' });
      return { valid: false, tipo, errors, warnings };
    }

    if (root.$?.version !== schema.version) {
      warnings.push({ path: `$.${schema.element}`, message: `Versión esperada '${schema.version}', se encontró '${root.$?.version}'`, severity: 'warning' });
    }

    for (const rule of schema.rules) {
      rule(root, `$.${schema.element}`, errors, warnings);
    }

    return { valid: errors.length === 0, tipo, errors, warnings };
  },

  validateXml(xml: string, tipoOverride?: string): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
      parser.parseStringPromise(xml)
        .then((obj) => resolve(this.validate(obj, tipoOverride)))
        .catch((err) => resolve({
          valid: false,
          errors: [{ path: '$', message: `Error de parseo XML: ${err.message}`, severity: 'error' }],
          warnings: [],
        }));
    });
  },

  getSoportedTipos(): { codigo: string; elemento: string; version: string }[] {
    return Object.entries(rootRules).map(([codigo, schema]) => ({
      codigo,
      elemento: schema.element,
      version: schema.version,
    }));
  },
};
