import ExcelJS from "exceljs";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export async function generateExcelReport(options: {
  title: string;
  subtitle?: string;
  columns: ExcelColumn[];
  data: Record<string, any>[];
  filename: string;
}): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OFSERCONT IA - Sistema Contable SRI";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(options.title.slice(0, 31));

  // Title row
  const titleRow = worksheet.addRow([options.title.toUpperCase()]);
  titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF990000" } };
  worksheet.mergeCells(1, 1, 1, Math.max(options.columns.length, 4));

  if (options.subtitle) {
    const subRow = worksheet.addRow([options.subtitle]);
    subRow.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF666666" } };
    worksheet.mergeCells(2, 1, 2, Math.max(options.columns.length, 4));
  }

  // Blank row
  worksheet.addRow([]);

  // Header row
  const headers = options.columns.map((c) => c.header);
  const headerRow = worksheet.addRow(headers);

  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF990000" }, // Brand Red
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF666666" } },
    };
  });

  // Data rows
  options.data.forEach((item, index) => {
    const rowValues = options.columns.map((col) => item[col.key] ?? "");
    const row = worksheet.addRow(rowValues);

    const isEven = index % 2 === 0;
    row.eachCell((cell) => {
      cell.font = { name: "Arial", size: 9.5 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEven ? "FFFFFFFF" : "FFF8F9FA" },
      };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // Set column widths
  worksheet.columns = options.columns.map((col) => ({
    key: col.key,
    width: col.width || Math.max(col.header.length + 5, 15),
  }));

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = options.filename.endsWith(".xlsx") ? options.filename : `${options.filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
