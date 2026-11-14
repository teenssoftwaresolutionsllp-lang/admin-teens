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
  totalRow?: {
    label: string;
    sums: Record<string, number>;
  };
};

export async function exportToExcel({
  fileName,
  sheetName,
  title,
  subtitle,
  columns,
  rows,
  totalsRow = false,
  totalRow,
}: ExportToExcelOptions) {
  const ExcelJS = await import("exceljs");

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));

  // Column widths
  columns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width ?? 18;
  });

  // Company title
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

    row.getCell(1).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
  }

  // Subtitle
  if (subtitle) {
    const row = worksheet.addRow([subtitle]);

    worksheet.mergeCells(row.number, 1, row.number, columns.length);

    row.getCell(1).font = {
      italic: true,
      color: { argb: "FF666666" },
    };

    row.getCell(1).alignment = {
      horizontal: "center",
    };
  }

  // Column headers
  const headerRow = worksheet.addRow(
    columns.map((column) => column.header),
  );

  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

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

  // Employee data
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

  // Separate final TOTAL row
  if (totalRow && rows.length > 0) {
    const totalValues = columns.map((column, index) => {
      if (index === 0) {
        return totalRow.label;
      }

      return totalRow.sums[column.key] ?? "";
    });

    const totalExcelRow = worksheet.addRow(totalValues);

    totalExcelRow.height = 24;

    columns.forEach((column, index) => {
      const cell = totalExcelRow.getCell(index + 1);

      if (column.numFmt && totalRow.sums[column.key] !== undefined) {
        cell.numFmt = column.numFmt;
      }
    });

    totalExcelRow.font = {
      bold: true,
      size: 11,
    };

    totalExcelRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2F0D9" },
      };

      cell.border = {
        top: {
          style: "thin",
          color: { argb: "FF548235" },
        },
      };

      cell.alignment = {
        vertical: "middle",
      };
    });
  }

  // Preserve old totalsRow behavior for existing callers
  if (totalsRow && rows.length > 0 && !totalRow) {
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

  // Freeze header
  worksheet.views = [
    {
      state: "frozen",
      ySplit: headerRow.number,
    },
  ];

  // Enable header filtering
  worksheet.autoFilter = {
    from: {
      row: headerRow.number,
      column: 1,
    },
    to: {
      row: headerRow.number,
      column: columns.length,
    },
  };

  // Generate Excel file
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