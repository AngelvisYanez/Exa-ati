import * as xml2js from 'xml2js';

export const FACTURA_VERSION = '1.1.0';
export const NOTA_CREDITO_VERSION = '1.1.0';
export const NOTA_DEBITO_VERSION = '1.0.0';
export const RETENCION_VERSION = '2.0.0';
export const GUIA_REMISION_VERSION = '1.1.0';
export const LIQUIDACION_COMPRA_VERSION = '1.1.0';

const builder = new xml2js.Builder({
  xmldec: { version: '1.0', encoding: 'UTF-8' },
  renderOpts: { pretty: true, indent: '  ' },
  headless: false,
});

function formatDecimal(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

function buildInfoTributaria(info: any): Record<string, any> {
  const result: Record<string, any> = {
    ambiente: info.ambiente,
    tipoEmision: info.tipoEmision,
    razonSocial: info.razonSocial,
  };

  if (info.nombreComercial) {
    result.nombreComercial = info.nombreComercial;
  }

  result.ruc = info.ruc;
  result.claveAcceso = info.claveAcceso;
  result.codDoc = info.codDoc;
  result.estab = info.estab;
  result.ptoEmi = info.ptoEmi;
  result.secuencial = info.secuencial;
  result.dirMatriz = info.dirMatriz;

  if (info.agenteRetencion) {
    result.agenteRetencion = info.agenteRetencion;
  }

  if (info.contribuyenteRimpe) {
    result.contribuyenteRimpe = info.contribuyenteRimpe;
  }

  return result;
}

function buildInfoFactura(info: any): Record<string, any> {
  const result: Record<string, any> = {
    fechaEmision: info.fechaEmision,
  };

  if (info.dirEstablecimiento) {
    result.dirEstablecimiento = info.dirEstablecimiento;
  }

  if (info.contribuyenteEspecial) {
    result.contribuyenteEspecial = info.contribuyenteEspecial;
  }

  result.obligadoContabilidad = info.obligadoContabilidad;
  result.tipoIdentificacionComprador = info.tipoIdentificacionComprador;

  if (info.guiaRemision) {
    result.guiaRemision = info.guiaRemision;
  }

  result.razonSocialComprador = info.razonSocialComprador;
  result.identificacionComprador = info.identificacionComprador;

  if (info.direccionComprador) {
    result.direccionComprador = info.direccionComprador;
  }

  result.totalSinImpuestos = formatDecimal(info.totalSinImpuestos, 2);
  result.totalDescuento = formatDecimal(info.totalDescuento, 2);

  result.totalConImpuestos = {
    totalImpuesto: info.totalConImpuestos.map((imp: any) => ({
      codigo: imp.codigo,
      codigoPorcentaje: imp.codigoPorcentaje,
      baseImponible: formatDecimal(imp.baseImponible, 2),
      tarifa:
        imp.tarifa !== undefined
          ? formatDecimal(imp.tarifa, 2)
          : undefined,
      valor: formatDecimal(imp.valor, 2),
    })),
  };

  if (info.propina !== undefined) {
    result.propina = formatDecimal(info.propina, 2);
  }

  result.importeTotal = formatDecimal(info.importeTotal, 2);

  if (info.moneda) {
    result.moneda = info.moneda;
  }

  result.pagos = {
    pago: info.pagos.map((p: any) => {
      const pago: Record<string, any> = {
        formaPago: p.formaPago,
        total: formatDecimal(p.total, 2),
      };
      if (p.plazo !== undefined) {
        pago.plazo = p.plazo;
        pago.unidadTiempo = p.unidadTiempo || 'dias';
      }
      return pago;
    }),
  };

  return result;
}

function buildDetalleFactura(detalle: any): Record<string, any> {
  const result: Record<string, any> = {
    codigoPrincipal: detalle.codigoPrincipal,
  };

  if (detalle.codigoAuxiliar) {
    result.codigoAuxiliar = detalle.codigoAuxiliar;
  }

  result.descripcion = detalle.descripcion;

  if (detalle.unidadMedida) {
    result.unidadMedida = detalle.unidadMedida;
  }

  result.cantidad = formatDecimal(detalle.cantidad, 6);
  result.precioUnitario = formatDecimal(detalle.precioUnitario, 6);
  result.descuento = formatDecimal(detalle.descuento, 2);
  result.precioTotalSinImpuesto = formatDecimal(
    detalle.precioTotalSinImpuesto,
    2
  );

  if (detalle.detallesAdicionales && detalle.detallesAdicionales.length > 0) {
    result.detallesAdicionales = {
      detAdicional: detalle.detallesAdicionales.map((d: any) => ({
        $: { nombre: d.nombre, valor: d.valor },
      })),
    };
  }

  result.impuestos = {
    impuesto: detalle.impuestos.map((imp: any) => ({
      codigo: imp.codigo,
      codigoPorcentaje: imp.codigoPorcentaje,
      tarifa: formatDecimal(imp.tarifa, 2),
      baseImponible: formatDecimal(imp.baseImponible, 2),
      valor: formatDecimal(imp.valor, 2),
    })),
  };

  return result;
}

function buildInfoNotaCredito(info: any): Record<string, any> {
  const result: Record<string, any> = {
    fechaEmision: info.fechaEmision,
  };

  if (info.dirEstablecimiento) {
    result.dirEstablecimiento = info.dirEstablecimiento;
  }

  result.tipoIdentificacionComprador = info.tipoIdentificacionComprador;
  result.razonSocialComprador = info.razonSocialComprador;
  result.identificacionComprador = info.identificacionComprador;

  if (info.contribuyenteEspecial) {
    result.contribuyenteEspecial = info.contribuyenteEspecial;
  }

  if (info.obligadoContabilidad) {
    result.obligadoContabilidad = info.obligadoContabilidad;
  }

  if (info.rise) {
    result.rise = info.rise;
  }

  result.codDocModificado = info.codDocModificado;
  result.numDocModificado = info.numDocModificado;
  result.fechaEmisionDocSustento = info.fechaEmisionDocSustento;
  result.totalSinImpuestos = formatDecimal(info.totalSinImpuestos, 2);
  result.valorModificacion = formatDecimal(info.valorModificacion, 2);

  if (info.moneda) {
    result.moneda = info.moneda;
  }

  result.totalConImpuestos = {
    totalImpuesto: info.totalConImpuestos.map((imp: any) => ({
      codigo: imp.codigo,
      codigoPorcentaje: imp.codigoPorcentaje,
      baseImponible: formatDecimal(imp.baseImponible, 2),
      tarifa: imp.tarifa !== undefined ? formatDecimal(imp.tarifa, 2) : undefined,
      valor: formatDecimal(imp.valor, 2),
    })),
  };

  result.motivo = info.motivo;

  return result;
}

export const xmlBuilder = {
  buildFactura(factura: any): string {
    const xmlObj = {
      factura: {
        $: {
          id: 'comprobante',
          version: FACTURA_VERSION,
        },
        infoTributaria: buildInfoTributaria(factura.infoTributaria),
        infoFactura: buildInfoFactura(factura.infoFactura),
        detalles: {
          detalle: factura.detalles.map((d: any) => buildDetalleFactura(d)),
        },
      },
    };

    if (factura.retenciones && factura.retenciones.length > 0) {
      (xmlObj.factura as any).retenciones = {
        retencion: factura.retenciones.map((r: any) => ({
          codigo: r.codigo,
          codigoPorcentaje: r.codigoPorcentaje,
          tarifa: formatDecimal(r.tarifa, 2),
          valor: formatDecimal(r.valor, 2),
        })),
      };
    }

    if (factura.infoAdicional && factura.infoAdicional.length > 0) {
      (xmlObj.factura as any).infoAdicional = {
        campoAdicional: factura.infoAdicional.map((campo: any) => ({
          $: { nombre: campo.nombre },
          _: campo.valor,
        })),
      };
    }

    return builder.buildObject(xmlObj);
  },

  buildNotaCredito(notaCredito: any): string {
    const xmlObj = {
      notaCredito: {
        $: {
          id: 'comprobante',
          version: NOTA_CREDITO_VERSION,
        },
        infoTributaria: buildInfoTributaria(notaCredito.infoTributaria),
        infoNotaCredito: buildInfoNotaCredito(notaCredito.infoNotaCredito),
        detalles: {
          detalle: notaCredito.detalles.map((d: any) => buildDetalleFactura(d)),
        },
      },
    };

    if (notaCredito.infoAdicional && notaCredito.infoAdicional.length > 0) {
      (xmlObj.notaCredito as any).infoAdicional = {
        campoAdicional: notaCredito.infoAdicional.map((campo: any) => ({
          $: { nombre: campo.nombre },
          _: campo.valor,
        })),
      };
    }

    return builder.buildObject(xmlObj);
  },

  buildRetencion(retencion: any): string {
    const docsMap = new Map<string, any>();

    for (const imp of retencion.impuestos) {
      const key = `${imp.codDocSustento}-${imp.numDocSustento}`;
      if (!docsMap.has(key)) {
        docsMap.set(key, {
          codSustento: imp.codSustento || imp.codDocSustento,
          codDocSustento: imp.codDocSustento,
          numDocSustento: imp.numDocSustento,
          fechaEmisionDocSustento: imp.fechaEmisionDocSustento,
          pagoLocExt: imp.pagoLocExt || '01',
          totalSinImpuestos: imp.totalSinImpuestos,
          importeTotal: imp.importeTotal,
          formaPago: imp.formaPago || '01',
          impuestosDocSustento: imp.impuestosDocSustento,
          retenciones: [],
        });
      }

      const doc = docsMap.get(key);
      doc.retenciones.push({
        codigo: imp.codigo,
        codigoRetencion: imp.codigoRetencion,
        baseImponible: formatDecimal(imp.baseImponible, 2),
        porcentajeRetener: formatDecimal(imp.porcentajeRetener, 2),
        valorRetenido: formatDecimal(imp.valorRetenido, 2),
      });
    }

    const docsSustento = Array.from(docsMap.values()).map((doc) => ({
      codSustento: doc.codSustento,
      codDocSustento: doc.codDocSustento,
      numDocSustento: doc.numDocSustento.replace(/-/g, ''),
      fechaEmisionDocSustento: doc.fechaEmisionDocSustento,
      pagoLocExt: doc.pagoLocExt,
      totalSinImpuestos: formatDecimal(doc.totalSinImpuestos, 2),
      importeTotal: formatDecimal(doc.importeTotal, 2),
      impuestosDocSustento: {
        impuestoDocSustento: doc.impuestosDocSustento.map((impDoc: any) => ({
          codImpuestoDocSustento: impDoc.codImpuestoDocSustento,
          codigoPorcentaje: impDoc.codigoPorcentaje,
          baseImponible: formatDecimal(impDoc.baseImponible, 2),
          tarifa: formatDecimal(impDoc.tarifa, 2),
          valorImpuesto: formatDecimal(impDoc.valorImpuesto, 2),
        })),
      },
      retenciones: {
        retencion: doc.retenciones,
      },
      pagos: {
        pago: {
          formaPago: doc.formaPago,
          total: formatDecimal(doc.importeTotal, 2),
        },
      },
    }));

    const xmlObj = {
      comprobanteRetencion: {
        $: {
          id: 'comprobante',
          version: RETENCION_VERSION,
        },
        infoTributaria: buildInfoTributaria(retencion.infoTributaria),
        infoCompRetencion: {
          fechaEmision: retencion.infoCompRetencion.fechaEmision,
          dirEstablecimiento: retencion.infoCompRetencion.dirEstablecimiento || undefined,
          contribuyenteEspecial: retencion.infoCompRetencion.contribuyenteEspecial || undefined,
          obligadoContabilidad: retencion.infoCompRetencion.obligadoContabilidad,
          tipoIdentificacionSujetoRetenido: retencion.infoCompRetencion.tipoIdentificacionSujetoRetenido,
          tipoSujetoRetenido: String(retencion.infoCompRetencion.tipoIdentificacionSujetoRetenido) === '08' 
            ? retencion.infoCompRetencion.tipoSujetoRetenido 
            : undefined,
          parteRel: retencion.infoCompRetencion.parteRel || 'NO',
          razonSocialSujetoRetenido: retencion.infoCompRetencion.razonSocialSujetoRetenido,
          identificacionSujetoRetenido: retencion.infoCompRetencion.identificacionSujetoRetenido,
          periodoFiscal: retencion.infoCompRetencion.periodoFiscal,
        },
        docsSustento: {
          docSustento: docsSustento,
        },
      },
    };

    if (retencion.infoAdicional && retencion.infoAdicional.length > 0) {
      (xmlObj.comprobanteRetencion as any).infoAdicional = {
        campoAdicional: retencion.infoAdicional.map((campo: any) => ({
          $: { nombre: campo.nombre },
          _: campo.valor,
        })),
      };
    }

    return builder.buildObject(xmlObj);
  },

  buildLiquidacionCompra(liquidacion: any): string {
    const infoLC = liquidacion.infoLiquidacionCompra || {};

    const xmlObj: Record<string, any> = {
      liquidacionCompra: {
        $: {
          id: 'comprobante',
          version: LIQUIDACION_COMPRA_VERSION,
        },
        infoTributaria: buildInfoTributaria(liquidacion.infoTributaria),
        infoLiquidacionCompra: {
          fechaEmision: infoLC.fechaEmision,
          dirEstablecimiento: infoLC.dirEstablecimiento || undefined,
          contribuyenteEspecial: infoLC.contribuyenteEspecial || undefined,
          obligadoContabilidad: infoLC.obligadoContabilidad,
          tipoIdentificacionProveedor: infoLC.tipoIdentificacionProveedor,
          razonSocialProveedor: infoLC.razonSocialProveedor,
          identificacionProveedor: infoLC.identificacionProveedor,
          direccionProveedor: infoLC.direccionProveedor || undefined,
          totalSinImpuestos: formatDecimal(infoLC.totalSinImpuestos, 2),
          totalDescuento: formatDecimal(infoLC.totalDescuento, 2),
        },
        totalConImpuestos: {
          totalImpuesto: (liquidacion.totalConImpuestos || []).map((imp: any) => ({
            codigo: imp.codigo,
            codigoPorcentaje: imp.codigoPorcentaje,
            descuentoAdicional: imp.descuentoAdicional !== undefined ? formatDecimal(imp.descuentoAdicional, 2) : undefined,
            baseImponible: formatDecimal(imp.baseImponible, 2),
            tarifa: imp.tarifa !== undefined ? formatDecimal(imp.tarifa, 2) : undefined,
            valor: formatDecimal(imp.valor, 2),
          })),
        },
        importeTotal: formatDecimal(liquidacion.importeTotal, 2),
        moneda: liquidacion.moneda || 'USD',
        pagos: {
          pago: (liquidacion.pagos || []).map((p: any) => {
            const pago: Record<string, any> = {
              formaPago: p.formaPago,
              total: formatDecimal(p.total, 2),
            };
            if (p.plazo !== undefined) {
              pago.plazo = p.plazo;
              pago.unidadTiempo = p.unidadTiempo || 'dias';
            }
            return pago;
          }),
        },
        detalles: {
          detalle: (liquidacion.detalles || []).map((d: any) => {
            const detalle: Record<string, any> = {
              codigoPrincipal: d.codigoPrincipal,
            };
            if (d.codigoAuxiliar) {
              detalle.codigoAuxiliar = d.codigoAuxiliar;
            }
            detalle.descripcion = d.descripcion;
            if (d.unidadMedida) {
              detalle.unidadMedida = d.unidadMedida;
            }
            detalle.cantidad = formatDecimal(d.cantidad, 6);
            detalle.precioUnitario = formatDecimal(d.precioUnitario, 6);
            detalle.descuento = formatDecimal(d.descuento, 2);
            detalle.precioTotalSinImpuesto = formatDecimal(d.precioTotalSinImpuesto, 2);

            if (d.detallesAdicionales && d.detallesAdicionales.length > 0) {
              detalle.detallesAdicionales = {
                detAdicional: d.detallesAdicionales.map((da: any) => ({
                  $: { nombre: da.nombre, valor: da.valor },
                })),
              };
            }

            detalle.impuestos = {
              impuesto: d.impuestos.map((imp: any) => ({
                codigo: imp.codigo,
                codigoPorcentaje: imp.codigoPorcentaje,
                tarifa: formatDecimal(imp.tarifa, 2),
                baseImponible: formatDecimal(imp.baseImponible, 2),
                valor: formatDecimal(imp.valor, 2),
              })),
            };

            if (d.reembolsos && d.reembolsos.length > 0) {
              detalle.reembolsos = {
                reembolsoDetalle: d.reembolsos.map((r: any) => ({
                  tipoIdentificacionProveedorReembolso: r.tipoIdentificacionProveedorReembolso,
                  identificacionProveedorReembolso: r.identificacionProveedorReembolso,
                  codPaisPagoPorProvReembolso: r.codPaisPagoPorProvReembolso,
                  tipoProvReembolso: r.tipoProvReembolso || '01',
                  codDocReembolso: r.codDocReembolso || '01',
                  estabDocReembolso: r.estabDocReembolso,
                  ptoEmiDocReembolso: r.ptoEmiDocReembolso,
                  secuencialDocReembolso: r.secuencialDocReembolso,
                  fechaEmisionDocReembolso: r.fechaEmisionDocReembolso,
                  numeroAutorizacionDocReembolso: r.numeroAutorizacionDocReembolso,
                  detalleImpuestos: {
                    detalleImpuesto: (r.detalleImpuestos || []).map((di: any) => ({
                      codigo: di.codigo,
                      codigoPorcentaje: di.codigoPorcentaje,
                      baseImponibleReembolso: formatDecimal(di.baseImponibleReembolso, 2),
                      tarifa: formatDecimal(di.tarifa, 2),
                      valorReembolso: formatDecimal(di.valorReembolso, 2),
                    })),
                  },
                })),
              };
            }

            return detalle;
          }),
        },
      },
    };

    if (infoLC.codDocReembolso) {
      (xmlObj.liquidacionCompra.infoLiquidacionCompra as any).codDocReembolso = infoLC.codDocReembolso;
      if (infoLC.totalComprobantesReembolso !== undefined) {
        (xmlObj.liquidacionCompra.infoLiquidacionCompra as any).totalComprobantesReembolso = formatDecimal(infoLC.totalComprobantesReembolso, 2);
      }
      if (infoLC.totalBaseImponibleReembolso !== undefined) {
        (xmlObj.liquidacionCompra.infoLiquidacionCompra as any).totalBaseImponibleReembolso = formatDecimal(infoLC.totalBaseImponibleReembolso, 2);
      }
      if (infoLC.totalImpuestoReembolso !== undefined) {
        (xmlObj.liquidacionCompra.infoLiquidacionCompra as any).totalImpuestoReembolso = formatDecimal(infoLC.totalImpuestoReembolso, 2);
      }
    }

    if (liquidacion.maquinaFiscal) {
      (xmlObj.liquidacionCompra as any).maquinaFiscal = {
        marca: liquidacion.maquinaFiscal.marca,
        modelo: liquidacion.maquinaFiscal.modelo,
        serie: liquidacion.maquinaFiscal.serie,
      };
    }

    if (liquidacion.infoAdicional && liquidacion.infoAdicional.length > 0) {
      (xmlObj.liquidacionCompra as any).infoAdicional = {
        campoAdicional: liquidacion.infoAdicional.map((campo: any) => ({
          $: { nombre: campo.nombre },
          _: campo.valor,
        })),
      };
    }

    return builder.buildObject(xmlObj);
  },

  buildGuiaRemision(guia: any): string {
    const xmlObj: Record<string, any> = {
      guiaRemision: {
        $: {
          id: 'comprobante',
          version: GUIA_REMISION_VERSION,
        },
        infoTributaria: buildInfoTributaria(guia.infoTributaria),
        infoGuiaRemision: {
          dirEstablecimiento: guia.infoGuiaRemision.dirEstablecimiento || undefined,
          dirPartida: guia.infoGuiaRemision.dirPartida,
          razonSocialTransportista: guia.infoGuiaRemision.razonSocialTransportista,
          tipoIdentificacionTransportista: guia.infoGuiaRemision.tipoIdentificacionTransportista,
          rucTransportista: guia.infoGuiaRemision.rucTransportista,
          rise: guia.infoGuiaRemision.rise || undefined,
          obligadoContabilidad: guia.infoGuiaRemision.obligadoContabilidad,
          contribuyenteEspecial: guia.infoGuiaRemision.contribuyenteEspecial || undefined,
          fechaIniTransporte: guia.infoGuiaRemision.fechaIniTransporte,
          fechaFinTransporte: guia.infoGuiaRemision.fechaFinTransporte,
          placa: guia.infoGuiaRemision.placa,
        },
        destinatarios: {
          destinatario: (guia.destinatarios || []).map((dest: any): Record<string, any> => {
            const destinatario: Record<string, any> = {
              identificacionDestinatario: dest.identificacionDestinatario,
              razonSocialDestinatario: dest.razonSocialDestinatario,
              dirDestinatario: dest.dirDestinatario || undefined,
              motivoTraslado: dest.motivoTraslado,
              docAduaneroUnico: dest.docAduaneroUnico || undefined,
              codEstabDestino: dest.codEstabDestino || undefined,
              ruta: dest.ruta || undefined,
              codDocSustento: dest.codDocSustento,
              numDocSustento: dest.numDocSustento,
              numAutDocSustento: dest.numAutDocSustento,
              fechaEmisionDocSustento: dest.fechaEmisionDocSustento,
              detalles: {
                detalle: (dest.detalles || []).map((d: any) => {
                  const detalle: Record<string, any> = {
                    codigoInterno: d.codigoInterno,
                  };
                  if (d.codigoAdicional) {
                    detalle.codigoAdicional = d.codigoAdicional;
                  }
                  detalle.descripcion = d.descripcion;
                  detalle.cantidad = formatDecimal(d.cantidad, 6);

                  if (d.detallesAdicionales && d.detallesAdicionales.length > 0) {
                    detalle.detallesAdicionales = {
                      detAdicional: d.detallesAdicionales.map((da: any) => ({
                        $: { nombre: da.nombre, valor: da.valor },
                      })),
                    };
                  }

                  return detalle;
                }),
              },
            };

            return destinatario;
          }),
        },
      },
    };

    if (guia.infoAdicional && guia.infoAdicional.length > 0) {
      (xmlObj.guiaRemision as any).infoAdicional = {
        campoAdicional: guia.infoAdicional.map((campo: any) => ({
          $: { nombre: campo.nombre },
          _: campo.valor,
        })),
      };
    }

    return builder.buildObject(xmlObj);
  },

  async parseXml<T>(xml: string): Promise<T> {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
    });
    return parser.parseStringPromise(xml);
  }
};
