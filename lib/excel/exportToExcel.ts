
type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
};

type ExportToExcelOptions = {
  fileName: string;
  sheetName: string;
  title?: string;
  subtitle?: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
  totalsRow?: boolean;
};

export async function exportToExcel({
  fileName,
  sheetName,
  title,
  subtitle,
  columns,
  rows,
  totalsRow = false,
}: ExportToExcelOptions) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));

  columns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width ?? 18;
  });

  if (title) {
    const row = worksheet.addRow([title]);
    worksheet.mergeCells(row.number, 1, row.number, columns.length);
    row.height = 30;
    row.getCell(1).font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    row.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" },
    };
    row.getCell(1).alignment = { horizontal: "center" };
  }

  if (subtitle) {
    const row = worksheet.addRow([subtitle]);
    worksheet.mergeCells(row.number, 1, row.number, columns.length);
    row.getCell(1).font = { italic: true, color: { argb: "FF666666" } };
    row.getCell(1).alignment = { horizontal: "center" };
  }

  const headerRow = worksheet.addRow(columns.map((c) => c.header));
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  });

  rows.forEach((data) => {
    const row = worksheet.addRow(
      columns.map((column) => data[column.key] ?? ""),
    );

    columns.forEach((column, index) => {
      if (column.numFmt) {
        row.getCell(index + 1).numFmt = column.numFmt;
      }
    });
  });

  if (totalsRow && rows.length > 0) {
    const lastRow = worksheet.lastRow;
    if (lastRow) {
      lastRow.font = { bold: true };
      lastRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2F0D9" },
        };
      });
    }
  }

  worksheet.views = [
    { state: "frozen", ySplit: headerRow.number },
  ];

  worksheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName.toLowerCase().endsWith(".xlsx")
    ? fileName
    : `${fileName}.xlsx`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
