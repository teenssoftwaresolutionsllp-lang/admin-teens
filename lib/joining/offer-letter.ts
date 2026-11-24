
import PDFDocument from "pdfkit";

export interface OfferSalaryLine {
  label: string;
  monthlyAmount: number;
  annualAmount: number;
}

export interface OfferEmployerContribution {
  label: string;
  monthlyAmount: number;
  annualAmount: number;
  includedInCtc: boolean;
}

export interface OfferEmployeeDeduction {
  label: string;
  monthlyAmount: number | null;
  annualAmount?: number | null;
  note?: string;
}

export interface OfferSalaryBreakdown {
  annualCtc: number;
  monthlyCtc: number;
  monthlyGross: number;
  earnings: OfferSalaryLine[];
  employerContributions: OfferEmployerContribution[];
  employeeDeductions: OfferEmployeeDeduction[];
  estimatedMonthlyTakeHome: number;
  takeHomeNote?: string;
}

export interface OfferLetterDetails {
  firstName: string;
  lastName: string;
  designation: string;
  annualCtc: number;
  candidateId: string;
  department: string;
  employmentType: string;
  workLocation: string;
  pfEligible: boolean;
  esiEligible: boolean;
  ptEligible: boolean;
  tdsEligible: boolean;
  salaryBreakdown: OfferSalaryBreakdown;
}

function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrentDate(): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

function formatEmploymentType(value: string): string {
  const types: Record<string, string> = {
    full_time: "Full-time",
    contract: "Contract",
    intern: "Intern",
  };

  return types[value] || value;
}

function isValidAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validateSalaryBreakdown(
  breakdown: OfferSalaryBreakdown,
  annualCtc: number
): void {
  if (
    !breakdown ||
    !isValidAmount(breakdown.annualCtc) ||
    !isValidAmount(breakdown.monthlyCtc) ||
    !isValidAmount(breakdown.monthlyGross) ||
    !isValidAmount(breakdown.estimatedMonthlyTakeHome) ||
    !Array.isArray(breakdown.earnings) ||
    !Array.isArray(breakdown.employerContributions) ||
    !Array.isArray(breakdown.employeeDeductions)
  ) {
    throw new Error("Invalid offer salary breakdown.");
  }

  if (Math.abs(breakdown.annualCtc - annualCtc) > 1) {
    throw new Error(
      "The salary breakdown CTC does not match the candidate's annual CTC."
    );
  }

  for (const item of breakdown.earnings) {
    if (
      !item.label?.trim() ||
      !isValidAmount(item.monthlyAmount) ||
      !isValidAmount(item.annualAmount)
    ) {
      throw new Error("Invalid salary earnings component.");
    }
  }

  for (const item of breakdown.employerContributions) {
    if (
      !item.label?.trim() ||
      !isValidAmount(item.monthlyAmount) ||
      !isValidAmount(item.annualAmount) ||
      typeof item.includedInCtc !== "boolean"
    ) {
      throw new Error("Invalid employer contribution component.");
    }
  }

  for (const item of breakdown.employeeDeductions) {
    if (
      !item.label?.trim() ||
      (item.monthlyAmount !== null &&
        !isValidAmount(item.monthlyAmount)) ||
      (item.annualAmount !== undefined &&
        item.annualAmount !== null &&
        !isValidAmount(item.annualAmount))
    ) {
      throw new Error("Invalid employee deduction component.");
    }
  }
}

export async function generateOfferLetterPdf(
  details: OfferLetterDetails
): Promise<Buffer> {
  if (
    !details.firstName?.trim() ||
    !details.lastName?.trim() ||
    !details.designation?.trim() ||
    !Number.isFinite(details.annualCtc) ||
    details.annualCtc <= 0 ||
    !details.candidateId?.trim() ||
    !details.department?.trim() ||
    !details.employmentType?.trim() ||
    !details.workLocation?.trim() ||
    typeof details.pfEligible !== "boolean" ||
    typeof details.esiEligible !== "boolean" ||
    typeof details.ptEligible !== "boolean" ||
    typeof details.tdsEligible !== "boolean"
  ) {
    throw new Error("Invalid offer letter details.");
  }

  validateSalaryBreakdown(details.salaryBreakdown, details.annualCtc);

  const breakdown = details.salaryBreakdown;

  const document = new PDFDocument({
    size: "A4",
    margins: {
      top: 55,
      bottom: 55,
      left: 45,
      right: 45,
    },
    info: {
      Title: "Offer Letter",
      Author: "TEENS SOFTWARE SOLUTIONS LLP",
      Subject: "Employment Offer",
    },
  });

  const chunks: Buffer[] = [];

  const pdfBuffer = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });

    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    document.on("error", reject);
  });

  const left = 45;
  const right = 550;
  const contentWidth = right - left;
  const pageBottom = 787;

  // Check available space before drawing a section or block.
  const ensureSpace = (height = 35) => {
    if (document.y + height > pageBottom) {
      document.addPage();
    }
  };

  const addSection = (heading: string) => {
    ensureSpace(40);

    document.moveDown(0.6);

    document
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#111827")
      .text(heading, left, document.y, {
        width: contentWidth,
      });

    document.moveDown(0.35);

    document
      .moveTo(left, document.y)
      .lineTo(right, document.y)
      .strokeColor("#CBD5E1")
      .lineWidth(0.7)
      .stroke();

    document.moveDown(0.5);
  };

  const addText = (value: string, fontSize = 10) => {
    ensureSpace(30);

    document
      .font("Helvetica")
      .fontSize(fontSize)
      .fillColor("#222222")
      .text(value, {
        width: contentWidth,
        lineGap: 2,
      });
  };

  type SalaryPanelRow = {
    label: string;
    monthly: number | null;
    annual?: number | null;
    note?: string;
  };

  const PANEL_HEADER_HEIGHT = 32;
  const PANEL_ROW_HEIGHT = 34;
  const PANEL_FOOTER_HEIGHT = 42;
  const PANEL_BOTTOM_PADDING = 12;

  // Calculate panel height without drawing it.
  const calculatePanelHeight = (rows: SalaryPanelRow[]): number => {
    return (
      PANEL_HEADER_HEIGHT +
      rows.length * PANEL_ROW_HEIGHT +
      PANEL_FOOTER_HEIGHT +
      PANEL_BOTTOM_PADDING
    );
  };

  // Draw one payslip-style salary panel.
  const drawSalaryPanel = (
    x: number,
    y: number,
    width: number,
    title: string,
    rows: SalaryPanelRow[],
    totalLabel: string,
    totalAmount: number,
    options?: {
      showAnnual?: boolean;
      totalNote?: string;
    }
  ): number => {
    const panelHeight = calculatePanelHeight(rows);

    // Panel border.
    document
      .roundedRect(x, y, width, panelHeight, 3)
      .lineWidth(0.8)
      .strokeColor("#CBD5E1")
      .stroke();

    // Header background.
    document
      .rect(x, y, width, PANEL_HEADER_HEIGHT)
      .fillColor("#EEF2F7")
      .fill();

    document
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#111827")
      .text(title, x + 7, y + 10, {
        width: width - 14,
        align: "center",
      });

    let rowY = y + PANEL_HEADER_HEIGHT + 12;

    for (const row of rows) {
      const labelWidth = width * 0.54;
      const amountWidth = width - labelWidth - 16;

      // Component label.
      document
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#374151")
        .text(row.label, x + 8, rowY, {
          width: labelWidth,
          height: 19,
          lineGap: 0,
        });

      // Monthly amount.
      const monthlyText =
        row.monthly === null
          ? "TBD"
          : formatIndianCurrency(row.monthly);

      document
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor("#111827")
        .text(monthlyText, x + width - amountWidth - 8, rowY, {
          width: amountWidth,
          align: "right",
          lineBreak: false,
        });

      // Annual amount.
      if (options?.showAnnual) {
        const annualText =
          row.annual === null || row.annual === undefined
            ? "Annual: TBD"
            : `Annual: ${formatIndianCurrency(row.annual)}`;

        document
          .font("Helvetica")
          .fontSize(6)
          .fillColor("#64748B")
          .text(annualText, x + 8, rowY + 14, {
            width: width - 16,
            align: "right",
            lineBreak: false,
          });
      }

      rowY += PANEL_ROW_HEIGHT;
    }

    // Footer separator.
    const footerY = y + panelHeight - PANEL_FOOTER_HEIGHT;

    document
      .moveTo(x + 8, footerY)
      .lineTo(x + width - 8, footerY)
      .strokeColor("#CBD5E1")
      .lineWidth(0.7)
      .stroke();

    // Total label.
    document
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor("#111827")
      .text(totalLabel, x + 8, footerY + 9, {
        width: width - 16,
        align: "left",
      });

    // Total amount.
    document
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#111827")
      .text(formatIndianCurrency(totalAmount), x + 8, footerY + 22, {
        width: width - 16,
        align: "right",
      });

    if (options?.totalNote) {
      document
        .font("Helvetica")
        .fontSize(5.5)
        .fillColor("#64748B")
        .text(options.totalNote, x + 8, footerY + 33, {
          width: width - 16,
          lineBreak: false,
        });
    }

    return panelHeight;
  };

  // ============================================================
  // COMPANY HEADER
  // ============================================================

  document
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("#111827")
    .text("TEENS SOFTWARE SOLUTIONS LLP", {
      align: "center",
    });

  document
    .moveDown(0.3)
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#555555")
    .text("Hyderabad, Telangana, India", {
      align: "center",
    });

  document.moveDown(1.2);

  document
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#111827")
    .text("EMPLOYMENT OFFER LETTER", {
      align: "center",
    });

  document.moveDown(1.2);

  // ============================================================
  // CANDIDATE DETAILS
  // ============================================================

  addText(`Date: ${formatCurrentDate()}`);
  document.moveDown(0.4);

  addText(`Candidate: ${details.firstName} ${details.lastName}`);
  document.moveDown(0.4);

  addText(`Dear ${details.firstName},`);
  document.moveDown(0.4);

  addText(
    "We are pleased to extend an employment offer to you at " +
      "TEENS SOFTWARE SOLUTIONS LLP, subject to the terms and " +
      "conditions set out in the final employment agreement."
  );

  // ============================================================
  // EMPLOYMENT DETAILS
  // ============================================================

  addSection("Offer Details");

  addText(`Position: ${details.designation}`);
  addText(`Department: ${details.department}`);
  addText(`Employment Type: ${formatEmploymentType(details.employmentType)}`);
  addText(`Work Location: ${details.workLocation}`);

  // ============================================================
  // THREE-COLUMN SALARY BREAKDOWN
  // ============================================================

  const gap = 8;
  const panelWidth = (contentWidth - gap * 2) / 3;

  // Standard salary components.
  const standardSalaryRows: SalaryPanelRow[] =
    breakdown.earnings.map((item) => ({
      label: item.label,
      monthly: item.monthlyAmount,
      annual: item.annualAmount,
    }));

  // Employer contributions included in CTC.
  // These are not employee deductions.
  for (const contribution of breakdown.employerContributions) {
    if (contribution.includedInCtc) {
      standardSalaryRows.push({
        label: `${contribution.label} (Employer)`,
        monthly: contribution.monthlyAmount,
        annual: contribution.annualAmount,
      });
    }
  }

  const standardTotal = breakdown.monthlyCtc;

  // Earnings summary.
  const earningsRows: SalaryPanelRow[] = [
    {
      label: "Monthly Gross Earnings",
      monthly: breakdown.monthlyGross,
      annual: Math.round(breakdown.monthlyGross * 12),
    },
    {
      label: "Arrears",
      monthly: 0,
      annual: 0,
    },
    {
      label: "Incentive / Bonus",
      monthly: 0,
      annual: 0,
    },
  ];

  // Employee deductions.
  const deductionRows: SalaryPanelRow[] =
    breakdown.employeeDeductions.map((item) => ({
      label: item.label,
      monthly: item.monthlyAmount,
      annual: item.annualAmount,
      note: item.note,
    }));

  // Only known deductions are totalled.
  // Unknown TDS is not falsely displayed as zero.
  const knownDeductions = deductionRows.reduce(
    (total, item) => total + (item.monthly ?? 0),
    0
  );

  const hasPendingDeduction = deductionRows.some(
    (item) => item.monthly === null
  );

  // Calculate all panel heights before drawing.
  const standardPanelHeight = calculatePanelHeight(standardSalaryRows);
  const earningsPanelHeight = calculatePanelHeight(earningsRows);
  const deductionsPanelHeight = calculatePanelHeight(deductionRows);

  const panelHeight = Math.max(
    standardPanelHeight,
    earningsPanelHeight,
    deductionsPanelHeight
  );

  // Reserve space for heading + all three panels + spacing.
  // If they cannot fit, move the entire salary section to a new page.
  ensureSpace(60 + panelHeight + 16);

  addSection("Salary Components");

  const panelY = document.y;

  // Draw each panel exactly once.
  drawSalaryPanel(
    left,
    panelY,
    panelWidth,
    "Standard Monthly Salary",
    standardSalaryRows,
    "Monthly CTC",
    standardTotal,
    { showAnnual: true }
  );

  drawSalaryPanel(
    left + panelWidth + gap,
    panelY,
    panelWidth,
    "Earnings",
    earningsRows,
    "Gross Earnings",
    breakdown.monthlyGross,
    { showAnnual: true }
  );

  drawSalaryPanel(
    left + (panelWidth + gap) * 2,
    panelY,
    panelWidth,
    "Deductions",
    deductionRows,
    hasPendingDeduction
      ? "Known Deductions"
      : "Total Deductions",
    knownDeductions,
    {
      showAnnual: true,
      totalNote: hasPendingDeduction
        ? "Additional deduction pending"
        : undefined,
    }
  );

  // Update document cursor after the complete three-column layout.
  document.y = panelY + panelHeight + 16;

  // ============================================================
  // ADDITIONAL EMPLOYER COSTS
  // ============================================================

  const additionalEmployerCosts =
    breakdown.employerContributions.filter(
      (item) => !item.includedInCtc
    );

  if (additionalEmployerCosts.length > 0) {
    const additionalCostText = additionalEmployerCosts
      .map(
        (item) =>
          `${item.label}: ${formatIndianCurrency(item.monthlyAmount)} per month`
      )
      .join(" | ");

    addText(
      `Additional employer costs (not deducted from employee salary): ${additionalCostText}`,
      7.5
    );

    document.moveDown(0.4);
  }

  // ============================================================
  // MONTHLY SALARY SUMMARY
  // ============================================================

  const summaryBoxHeight = 108;

  // Reserve the heading and entire summary box together.
  ensureSpace(60 + summaryBoxHeight + 12);

  addSection("Monthly Salary Summary");

  const summaryBoxY = document.y;

  document
    .roundedRect(left, summaryBoxY, contentWidth, summaryBoxHeight, 3)
    .lineWidth(0.8)
    .strokeColor("#CBD5E1")
    .stroke();

  const summaryRows = [
    {
      label: "Gross Earnings (Before Employee Deductions)",
      amount: formatIndianCurrency(breakdown.monthlyGross),
    },
    {
      label: "Employee Deductions (Known)",
      amount: `- ${formatIndianCurrency(knownDeductions)}`,
    },
  ];

  let summaryRowY = summaryBoxY + 15;

  for (const item of summaryRows) {
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#1F2937")
      .text(item.label, left + 12, summaryRowY, {
        width: 340,
      });

    document
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#111827")
      .text(item.amount, left + 355, summaryRowY, {
        width: 135,
        align: "right",
      });

    summaryRowY += 24;
  }

  document
    .moveTo(left + 10, summaryRowY)
    .lineTo(right - 10, summaryRowY)
    .strokeColor("#CBD5E1")
    .stroke();

  summaryRowY += 12;

  document
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111827")
    .text("Estimated Monthly Take-Home", left + 12, summaryRowY, {
      width: 340,
    });

  document
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#15803D")
    .text(
      formatIndianCurrency(breakdown.estimatedMonthlyTakeHome),
      left + 355,
      summaryRowY - 2,
      {
        width: 135,
        align: "right",
      }
    );

  document.y = summaryBoxY + summaryBoxHeight + 12;

  // ============================================================
  // TAKE-HOME NOTES
  // ============================================================

  if (hasPendingDeduction) {
    addText(
      "Important: One or more deductions, such as TDS, are pending calculation. " +
        "The estimated take-home shown above excludes those unknown deductions " +
        "and may be lower after final payroll calculation.",
      8
    );
  }

  addText(
    breakdown.takeHomeNote ||
      "This is an estimated full-month take-home based on the current Master Payroll Engine. Actual payroll may vary based on statutory deductions, tax withholding, attendance and other payroll adjustments.",
    8
  );

  // ============================================================
  // OFFER ACCEPTANCE
  // ============================================================

  addSection("Offer Acceptance");

  addText(
    "Please review this offer and use the acceptance or decline instructions " +
      "provided in the accompanying email. Your final employment terms will " +
      "be documented in the applicable employment agreement."
  );

  // ============================================================
  // SIGNATURE
  // ============================================================

  document.moveDown(1.2);

  addText("Regards,");

  document.moveDown(0.3);

  ensureSpace(45);

  document
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#222222")
    .text("HR Team");

  document
    .font("Helvetica")
    .text("TEENS SOFTWARE SOLUTIONS LLP");

  // ============================================================
  // INTERNAL REFERENCE
  // ============================================================

  document.moveDown(1.2);

  ensureSpace(25);

  document
    .font("Helvetica")
    .fontSize(8)
    .fillColor("gray")
    .text(`Internal Candidate Reference: ${details.candidateId}`);

  document.end();

  return pdfBuffer;
}