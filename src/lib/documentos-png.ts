import type { Comprobante } from "@/lib/sriClient";

export function downloadComprobantePng(
  doc: Comprobante,
  _options?: { activeRuc?: string | null }
): void {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexto de Canvas no soportado");

  // Fondo
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 800, 1000);

  // Banner Superior
  ctx.fillStyle = "#0F172A"; // Navy oscuro
  ctx.fillRect(20, 20, 760, 100);

  // Texto de Banner
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("COMPROBANTE ELECTRÓNICO - RIDE", 40, 65);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "14px monospace";
  ctx.fillText(`Clave de Acceso: ${doc.claveAcceso}`, 40, 95);

  // Datos Emisor
  ctx.fillStyle = "#1E293B";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("DATOS DEL EMISOR", 40, 160);

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 170);
  ctx.lineTo(760, 170);
  ctx.stroke();

  const emisorNombre = doc.emisor?.razonSocial || "—";
  const emisorRucVal = doc.emisor?.ruc || "—";

  ctx.fillStyle = "#334155";
  ctx.font = "14px sans-serif";
  ctx.fillText(`Razón Social: ${emisorNombre}`, 40, 195);
  ctx.fillText(`RUC: ${emisorRucVal}`, 40, 215);
  ctx.fillText(
    `Establecimiento / Secuencial: ${doc.serie || "001-001"} · ${doc.secuencial}`,
    40,
    235
  );

  // Datos Receptor
  ctx.fillStyle = "#1E293B";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("DATOS DEL RECEPTOR", 40, 290);

  ctx.beginPath();
  ctx.moveTo(40, 300);
  ctx.lineTo(760, 300);
  ctx.stroke();

  ctx.fillStyle = "#334155";
  ctx.fillText(
    `Razón Social: ${doc.receptorRazonSocial || "CONSUMIDOR FINAL"}`,
    40,
    325
  );
  ctx.fillText(
    `Identificación: ${doc.receptorIdentificacion || "9999999999999"}`,
    40,
    345
  );
  ctx.fillText(
    `Fecha de Emisión: ${
      doc.fechaEmision
        ? new Date(doc.fechaEmision).toLocaleDateString("es-EC")
        : "—"
    }`,
    40,
    365
  );
  if (doc.receptorEmail) {
    ctx.fillText(`Email: ${doc.receptorEmail}`, 40, 385);
  }

  // Detalle/Tabla
  ctx.fillStyle = "#1E293B";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("DETALLE DEL COMPROBANTE", 40, 440);

  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(40, 455, 720, 35);

  ctx.fillStyle = "#475569";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("Descripción", 55, 477);
  ctx.fillText("Total", 680, 477);

  ctx.fillStyle = "#334155";
  ctx.font = "14px sans-serif";
  const desc =
    doc.tipoComprobante === "07"
      ? "Servicios de Retención de Impuestos"
      : "Consumo / Servicios profesionales de asesoría";
  ctx.fillText(desc, 55, 520);
  ctx.fillText(`$${(doc.importeTotal || 0).toFixed(2)}`, 680, 520);

  ctx.strokeStyle = "#E2E8F0";
  ctx.beginPath();
  ctx.moveTo(40, 540);
  ctx.lineTo(760, 540);
  ctx.stroke();

  // Totales
  const rightAlignX = 520;
  const valAlignX = 680;
  let totalY = 580;

  ctx.fillStyle = "#475569";
  ctx.font = "14px sans-serif";
  ctx.fillText("Subtotal sin Impuestos:", rightAlignX, totalY);
  ctx.fillText(`$${(doc.subtotal || 0).toFixed(2)}`, valAlignX, totalY);

  totalY += 25;
  ctx.fillText("Total Descuento:", rightAlignX, totalY);
  ctx.fillText(`$0.00`, valAlignX, totalY);

  totalY += 25;
  const ivaVal =
    doc.tipoComprobante === "07"
      ? 0
      : doc.importeTotal - (doc.subtotal || 0);
  ctx.fillText("IVA 15%:", rightAlignX, totalY);
  ctx.fillText(`$${Math.max(0, ivaVal).toFixed(2)}`, valAlignX, totalY);

  totalY += 35;
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(480, totalY - 20, 280, 40);
  ctx.strokeStyle = "#CBD5E1";
  ctx.strokeRect(480, totalY - 20, 280, 40);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText("VALOR TOTAL:", rightAlignX, totalY + 5);
  ctx.fillText(
    `$${(doc.importeTotal || 0).toFixed(2)}`,
    valAlignX,
    totalY + 5
  );

  // Clave de acceso (código de barras real en XML autorizado del SRI)
  ctx.fillStyle = "#000000";
  const barcodeX = 40;
  const barcodeY = 750;
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("CLAVE DE ACCESO", barcodeX, barcodeY - 10);
  ctx.font = "11px monospace";
  ctx.fillText(doc.claveAcceso || "—", barcodeX, barcodeY + 10);

  // Pie
  ctx.fillStyle = "#94A3B8";
  ctx.font = "12px sans-serif";
  ctx.fillText(
    "Generado automáticamente por OFSERCONT IA - Ecuador",
    40,
    950
  );

  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `comprobante_${doc.claveAcceso}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
