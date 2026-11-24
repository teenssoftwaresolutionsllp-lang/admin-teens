import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

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
  gender?: string | null;
  personalEmail?: string | null;
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
  joiningDate?: string | null;
  offerDate?: string | null;
  acceptanceDeadlineDate?: string | null;
  hrName?: string | null;
  hrTitle?: string | null;
}

function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyAmount(amount: number): string {
  return "₹ " + new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrentDate(dateStr?: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

function formatAcceptanceDate(offerDateStr?: string | null, days = 7): string {
  const base = offerDateStr ? new Date(offerDateStr) : new Date();
  base.setDate(base.getDate() + days);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(base);
}

function getSalutation(gender?: string | null): string {
  const g = String(gender || "").trim().toLowerCase();
  if (g === "female" || g === "f") {
    return "Miss/Mrs.";
  }
  return "Mr.";
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

  // A4 paper dimensions: 595.28 x 841.89
  const document = new PDFDocument({
    size: "A4",
    margins: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    info: {
      Title: "Offer Letter - Teens Software Solutions LLP",
      Author: "TEENS SOFTWARE SOLUTIONS LLP",
      Subject: "Employment Offer Letter",
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

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 36;
  const contentWidth = pageWidth - marginX * 2; // 523.28

  // ============================================================
  // 1. TOP-RIGHT & BOTTOM-RIGHT GEOMETRIC BLUE ACCENTS
  // ============================================================

  // Top-Right Geometric Triangles / Polygons
  document.save();
  // Cyan/sky blue background angle
  document
    .polygon([390, 0], [450, 0], [pageWidth, 145], [pageWidth, 85])
    .fillColor("#38BDF8")
    .fill();

  // Vibrant medium blue accent
  document
    .polygon([440, 0], [490, 0], [pageWidth, 115], [pageWidth, 65])
    .fillColor("#0284C7")
    .fill();

  // Deep Navy main corner polygon
  document
    .polygon([480, 0], [pageWidth, 0], [pageWidth, 145], [540, 145])
    .fillColor("#0B3B60")
    .fill();
  document.restore();

  // Bottom-Right Geometric Triangles / Polygons
  document.save();
  // Sky blue lower triangle
  document
    .polygon([380, pageHeight], [pageWidth, pageHeight - 140], [pageWidth, pageHeight])
    .fillColor("#38BDF8")
    .fill();

  // Vibrant blue mid triangle
  document
    .polygon([430, pageHeight], [pageWidth, pageHeight - 110], [pageWidth, pageHeight])
    .fillColor("#0284C7")
    .fill();

  // Deep navy corner triangle
  document
    .polygon([490, pageHeight], [pageWidth, pageHeight - 75], [pageWidth, pageHeight])
    .fillColor("#0B3B60")
    .fill();
  document.restore();

  // ============================================================
  // 2. HEADER: COMPANY LOGO & SLOGAN
  // ============================================================
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  if (fs.existsSync(logoPath)) {
    try {
      document.image(logoPath, marginX, 22, { width: 145 });
    } catch {
      // Fallback text if logo load fails
      document
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#0B3B60")
        .text("TEENS", marginX, 24)
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#0369A1")
        .text("SOFTWARE SOLUTIONS LLP", marginX, 42);
    }
  } else {
    document
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#0B3B60")
      .text("TEENS", marginX, 24)
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#0369A1")
      .text("SOFTWARE SOLUTIONS LLP", marginX, 42);
  }

  // Vertical separator beside logo
  document
    .moveTo(192, 25)
    .lineTo(192, 57)
    .strokeColor("#94A3B8")
    .lineWidth(1)
    .stroke();

  // Slogan
  document
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#0369A1")
    .text("Innovate  •  Build  •  Grow", 202, 36);

  // ============================================================
  // 3. CENTER PILL BADGE: "OFFER LETTER"
  // ============================================================
  const pillW = 180;
  const pillH = 26;
  const pillX = (pageWidth - pillW) / 2;
  const pillY = 68;

  document
    .roundedRect(pillX, pillY, pillW, pillH, 13)
    .fillColor("#0B3B60")
    .fill();

  document
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#FFFFFF")
    .text("OFFER LETTER", pillX, pillY + 7, {
      width: pillW,
      align: "center",
    });

  // ============================================================
  // 4. CANDIDATE ADDRESSING & INTRO
  // ============================================================
  const salutation = getSalutation(details.gender);
  const formattedDate = formatCurrentDate(details.offerDate);
  const acceptanceDate = details.acceptanceDeadlineDate || formatAcceptanceDate(details.offerDate, 7);

  let curY = 104;

  document
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#1E293B")
    .text(`Date: ${formattedDate}`, marginX, curY);

  curY += 14;
  document
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#1E293B")
    .text("To,", marginX, curY);

  curY += 12;
  document
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#0F172A")
    .text(`${salutation} ${details.firstName} ${details.lastName}`, marginX, curY);

  if (details.personalEmail) {
    curY += 12;
    document
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#475569")
      .text(details.personalEmail, marginX, curY);
  }

  curY += 14;
  document
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#0F172A")
    .text("Subject: Offer of Employment", marginX, curY);

  curY += 14;
  document
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#0F172A")
    .text(`Dear ${details.firstName},`, marginX, curY);

  curY += 13;
  // Intro paragraph with bold designation and company
  document
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#1E293B")
    .text("We are pleased to offer you the position of ", marginX, curY, {
      continued: true,
      width: contentWidth,
      lineGap: 2.5,
    })
    .font("Helvetica-Bold")
    .text(details.designation, { continued: true })
    .font("Helvetica")
    .text(" at ")
    .font("Helvetica-Bold")
    .text("Teens Software Solutions LLP.", { continued: true })
    .font("Helvetica")
    .text(" We are impressed with your skills and experience, and we are excited to have you join our team.");

  curY = document.y + 3;
  document
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#1E293B")
    .text("This offer is subject to the following terms and conditions:", marginX, curY);

  // ============================================================
  // 5. SALARY BREAKUP TABLE (TWO-COLUMN DUAL GRID)
  // ============================================================
  const tableY = curY + 14;
  const tableW = contentWidth; // 523.28

  // Main Header (Navy Blue rounded top)
  document
    .roundedRect(marginX, tableY, tableW, 19, 4)
    .fillColor("#0B3B60")
    .fill();

  document
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#FFFFFF")
    .text("Salary Breakup (Per Month & Per Annum)", marginX, tableY + 5.5, {
      width: tableW,
      align: "center",
    });

  // Table Column Coordinates:
  // Left side: 261.64 pt total
  //   Col 1 (Component): 111.64 pt
  //   Col 2 (Per Month): 75.00 pt
  //   Col 3 (Per Annum): 75.00 pt
  // Right side: 261.64 pt total
  //   Col 4 (Deductions): 111.64 pt
  //   Col 5 (Per Month): 75.00 pt
  //   Col 6 (Per Annum): 75.00 pt
  const colW1 = 111.64;
  const colW2 = 75;
  const colW3 = 75;
  const colW4 = 111.64;
  const colW5 = 75;
  const colW6 = 75;

  const colX1 = marginX;
  const colX2 = colX1 + colW1;
  const colX3 = colX2 + colW2;
  const colX4 = colX3 + colW3;
  const colX5 = colX4 + colW4;
  const colX6 = colX5 + colW5;

  // Sub-header Row (Light Blue #E0F2FE)
  const subHeaderY = tableY + 19;
  const subHeaderH = 22;

  document
    .rect(marginX, subHeaderY, tableW, subHeaderH)
    .fillColor("#E0F2FE")
    .fill();

  // Grid line for sub-header
  document
    .rect(marginX, subHeaderY, tableW, subHeaderH)
    .strokeColor("#BAE6FD")
    .lineWidth(0.6)
    .stroke();

  // Sub-header vertical divider lines
  [colX2, colX3, colX4, colX5, colX6].forEach((x) => {
    document
      .moveTo(x, subHeaderY)
      .lineTo(x, subHeaderY + subHeaderH)
      .strokeColor("#BAE6FD")
      .lineWidth(0.6)
      .stroke();
  });

  // Sub-header texts
  document
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor("#0F172A")
    .text("Component", colX1 + 6, subHeaderY + 7, { width: colW1 - 12 })
    .text("Per Month\n(INR)", colX2, subHeaderY + 3, { width: colW2, align: "center" })
    .text("Per Annum\n(INR)", colX3, subHeaderY + 3, { width: colW3, align: "center" })
    .text("Deductions", colX4 + 6, subHeaderY + 7, { width: colW4 - 12 })
    .text("Per Month\n(INR)", colX5, subHeaderY + 3, { width: colW5, align: "center" })
    .text("Per Annum\n(INR)", colX6, subHeaderY + 3, { width: colW6, align: "center" });

  // Map earnings items
  const earningsMap = new Map<string, OfferSalaryLine>();
  breakdown.earnings.forEach((e) => {
    const key = e.label.toLowerCase();
    earningsMap.set(key, e);
  });

  const getEarning = (keySubstr: string) => {
    for (const [k, v] of earningsMap.entries()) {
      if (k.includes(keySubstr)) return v;
    }
    return null;
  };

  const basicItem = getEarning("basic") || { label: "Basic Salary", monthlyAmount: Math.round(breakdown.monthlyGross * 0.5), annualAmount: Math.round(breakdown.monthlyGross * 0.5 * 12) };
  const hraItem = getEarning("hra") || getEarning("house rent") || { label: "HRA", monthlyAmount: Math.round(breakdown.monthlyGross * 0.2), annualAmount: Math.round(breakdown.monthlyGross * 0.2 * 12) };
  const convItem = getEarning("conveyance") || { label: "Conveyance Allowance", monthlyAmount: 1600, annualAmount: 19200 };
  const medItem = getEarning("medical") || { label: "Medical Allowance", monthlyAmount: 1250, annualAmount: 15000 };
  const specialItem = getEarning("special") || {
    label: "Special Allowance",
    monthlyAmount: Math.max(0, breakdown.monthlyGross - (basicItem.monthlyAmount + hraItem.monthlyAmount + convItem.monthlyAmount + medItem.monthlyAmount)),
    annualAmount: Math.max(0, breakdown.monthlyGross - (basicItem.monthlyAmount + hraItem.monthlyAmount + convItem.monthlyAmount + medItem.monthlyAmount)) * 12,
  };

  // Map deduction items
  const deductionMap = new Map<string, OfferEmployeeDeduction>();
  breakdown.employeeDeductions.forEach((d) => {
    const key = d.label.toLowerCase();
    deductionMap.set(key, d);
  });

  const getDeduction = (keySubstr: string) => {
    for (const [k, v] of deductionMap.entries()) {
      if (k.includes(keySubstr)) return v;
    }
    return null;
  };

  const pfItem = details.pfEligible
    ? (getDeduction("pf") || getDeduction("provident") || { label: "Provident Fund (PF) (12% of Basic)", monthlyAmount: Math.round(basicItem.monthlyAmount * 0.12), annualAmount: Math.round(basicItem.monthlyAmount * 0.12 * 12) })
    : { label: "Provident Fund (PF)", monthlyAmount: null, annualAmount: null, note: "Not Applicable" };

  const esiItem = details.esiEligible
    ? (getDeduction("esi") || { label: "Employee State Insurance (ESI) (0.75% of Gross)", monthlyAmount: Math.round(breakdown.monthlyGross * 0.0075), annualAmount: Math.round(breakdown.monthlyGross * 0.0075 * 12) })
    : { label: "Employee State Insurance (ESI)", monthlyAmount: null, annualAmount: null, note: "Not Applicable" };

  const ptItem = details.ptEligible
    ? (getDeduction("pt") || getDeduction("professional") || { label: "Professional Tax (PT)*", monthlyAmount: 200, annualAmount: 2400 })
    : { label: "Professional Tax (PT)*", monthlyAmount: null, annualAmount: null, note: "Not Applicable" };

  const tdsItem = {
    label: "Income Tax (TDS)**",
    monthlyText: "As per slab",
    annualText: "As per slab",
  };

  // Calculate total monthly and annual deductions
  let totalDeductionsMonthly = 0;
  let totalDeductionsAnnual = 0;

  if (details.pfEligible && pfItem.monthlyAmount) {
    totalDeductionsMonthly += pfItem.monthlyAmount;
    totalDeductionsAnnual += pfItem.annualAmount || pfItem.monthlyAmount * 12;
  }
  if (details.esiEligible && esiItem.monthlyAmount) {
    totalDeductionsMonthly += esiItem.monthlyAmount;
    totalDeductionsAnnual += esiItem.annualAmount || esiItem.monthlyAmount * 12;
  }
  if (details.ptEligible && ptItem.monthlyAmount) {
    totalDeductionsMonthly += ptItem.monthlyAmount;
    totalDeductionsAnnual += ptItem.annualAmount || ptItem.monthlyAmount * 12;
  }

  const annualGross = breakdown.monthlyGross * 12;
  const netTakeHomeMonthly = breakdown.estimatedMonthlyTakeHome > 0
    ? breakdown.estimatedMonthlyTakeHome
    : breakdown.monthlyGross - totalDeductionsMonthly;
  const netTakeHomeAnnual = netTakeHomeMonthly * 12;

  // Grid Data Rows: 6 structured rows
  type TableRowDef = {
    leftLabel: string;
    leftMonthly?: string;
    leftAnnual?: string;
    isLeftHeader?: boolean;
    rightLabel?: string;
    rightMonthly?: string;
    rightAnnual?: string;
    rowHeight: number;
  };

  const rows: TableRowDef[] = [
    {
      leftLabel: "Earnings",
      isLeftHeader: true,
      rightLabel: details.pfEligible
        ? "Provident Fund (PF)\n(12% of Basic)"
        : "Provident Fund (PF)\n(Not Applicable)",
      rightMonthly: details.pfEligible && pfItem.monthlyAmount ? formatCurrencyAmount(pfItem.monthlyAmount) : "—",
      rightAnnual: details.pfEligible && pfItem.annualAmount ? formatCurrencyAmount(pfItem.annualAmount) : "—",
      rowHeight: 20,
    },
    {
      leftLabel: "Basic Salary",
      leftMonthly: formatCurrencyAmount(basicItem.monthlyAmount),
      leftAnnual: formatCurrencyAmount(basicItem.annualAmount),
      rightLabel: details.esiEligible
        ? "Employee State Insurance (ESI)\n(0.75% of Gross)"
        : "Employee State Insurance (ESI)\n(Not Applicable)",
      rightMonthly: details.esiEligible && esiItem.monthlyAmount ? formatCurrencyAmount(esiItem.monthlyAmount) : "—",
      rightAnnual: details.esiEligible && esiItem.annualAmount ? formatCurrencyAmount(esiItem.annualAmount) : "—",
      rowHeight: 20,
    },
    {
      leftLabel: "HRA",
      leftMonthly: formatCurrencyAmount(hraItem.monthlyAmount),
      leftAnnual: formatCurrencyAmount(hraItem.annualAmount),
      rightLabel: details.ptEligible
        ? "Professional Tax (PT)*"
        : "Professional Tax (PT)* (N/A)",
      rightMonthly: details.ptEligible && ptItem.monthlyAmount ? formatCurrencyAmount(ptItem.monthlyAmount) : "—",
      rightAnnual: details.ptEligible && ptItem.annualAmount ? formatCurrencyAmount(ptItem.annualAmount) : "—",
      rowHeight: 16,
    },
    {
      leftLabel: "Conveyance Allowance",
      leftMonthly: formatCurrencyAmount(convItem.monthlyAmount),
      leftAnnual: formatCurrencyAmount(convItem.annualAmount),
      rightLabel: "Income Tax (TDS)**",
      rightMonthly: tdsItem.monthlyText,
      rightAnnual: tdsItem.annualText,
      rowHeight: 16,
    },
    {
      leftLabel: "Medical Allowance",
      leftMonthly: formatCurrencyAmount(medItem.monthlyAmount),
      leftAnnual: formatCurrencyAmount(medItem.annualAmount),
      rightLabel: "",
      rightMonthly: "",
      rightAnnual: "",
      rowHeight: 15,
    },
    {
      leftLabel: "Special Allowance",
      leftMonthly: formatCurrencyAmount(specialItem.monthlyAmount),
      leftAnnual: formatCurrencyAmount(specialItem.annualAmount),
      rightLabel: "",
      rightMonthly: "",
      rightAnnual: "",
      rowHeight: 15,
    },
  ];

  let currentTableRowY = subHeaderY + subHeaderH;

  rows.forEach((r) => {
    // Row background (white)
    document
      .rect(marginX, currentTableRowY, tableW, r.rowHeight)
      .fillColor("#FFFFFF")
      .fill();

    // Row borders
    document
      .rect(marginX, currentTableRowY, tableW, r.rowHeight)
      .strokeColor("#BAE6FD")
      .lineWidth(0.5)
      .stroke();

    // Vertical column borders
    [colX2, colX3, colX4, colX5, colX6].forEach((x) => {
      document
        .moveTo(x, currentTableRowY)
        .lineTo(x, currentTableRowY + r.rowHeight)
        .strokeColor("#BAE6FD")
        .lineWidth(0.5)
        .stroke();
    });

    // Left Col content
    if (r.isLeftHeader) {
      document
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor("#0F172A")
        .text(r.leftLabel, colX1 + 6, currentTableRowY + 5, { width: colW1 - 12 });
    } else {
      document
        .font("Helvetica")
        .fontSize(7.2)
        .fillColor("#334155")
        .text(r.leftLabel, colX1 + 6, currentTableRowY + 4, { width: colW1 - 12 });

      if (r.leftMonthly) {
        document
          .font("Helvetica")
          .fontSize(7.2)
          .fillColor("#0F172A")
          .text(r.leftMonthly, colX2, currentTableRowY + 4, { width: colW2 - 8, align: "right" });
      }
      if (r.leftAnnual) {
        document
          .font("Helvetica")
          .fontSize(7.2)
          .fillColor("#0F172A")
          .text(r.leftAnnual, colX3, currentTableRowY + 4, { width: colW3 - 8, align: "right" });
      }
    }

    // Right Col content
    if (r.rightLabel) {
      document
        .font("Helvetica")
        .fontSize(7.0)
        .fillColor("#334155")
        .text(r.rightLabel, colX4 + 6, currentTableRowY + (r.rightLabel.includes("\n") ? 2 : 4), {
          width: colW4 - 12,
          lineGap: 1,
        });

      if (r.rightMonthly) {
        const isMText = r.rightMonthly.includes("per");
        document
          .font(isMText ? "Helvetica" : "Helvetica")
          .fontSize(isMText ? 6.5 : 7.2)
          .fillColor("#0F172A")
          .text(r.rightMonthly, colX5, currentTableRowY + 4, {
            width: colW5 - 6,
            align: isMText ? "center" : "right",
          });
      }

      if (r.rightAnnual) {
        const isAText = r.rightAnnual.includes("per");
        document
          .font(isAText ? "Helvetica" : "Helvetica")
          .fontSize(isAText ? 6.5 : 7.2)
          .fillColor("#0F172A")
          .text(r.rightAnnual, colX6, currentTableRowY + 4, {
            width: colW6 - 6,
            align: isAText ? "center" : "right",
          });
      }
    }

    currentTableRowY += r.rowHeight;
  });

  // Gross Salary & Total Deductions Row (Light Blue Accent #E0F2FE)
  const totalRowH = 17;
  document
    .rect(marginX, currentTableRowY, tableW, totalRowH)
    .fillColor("#E0F2FE")
    .fill();

  document
    .rect(marginX, currentTableRowY, tableW, totalRowH)
    .strokeColor("#93C5FD")
    .lineWidth(0.6)
    .stroke();

  [colX2, colX3, colX4, colX5, colX6].forEach((x) => {
    document
      .moveTo(x, currentTableRowY)
      .lineTo(x, currentTableRowY + totalRowH)
      .strokeColor("#93C5FD")
      .lineWidth(0.6)
      .stroke();
  });

  document
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor("#0F172A")
    .text("Gross Salary", colX1 + 6, currentTableRowY + 4.5, { width: colW1 - 12 })
    .text(formatCurrencyAmount(breakdown.monthlyGross), colX2, currentTableRowY + 4.5, {
      width: colW2 - 8,
      align: "right",
    })
    .text(formatCurrencyAmount(annualGross), colX3, currentTableRowY + 4.5, {
      width: colW3 - 8,
      align: "right",
    })
    .text("Total Deductions", colX4 + 6, currentTableRowY + 4.5, { width: colW4 - 12 })
    .text(formatCurrencyAmount(totalDeductionsMonthly), colX5, currentTableRowY + 4.5, {
      width: colW5 - 6,
      align: "right",
    })
    .text(formatCurrencyAmount(totalDeductionsAnnual), colX6, currentTableRowY + 4.5, {
      width: colW6 - 6,
      align: "right",
    });

  currentTableRowY += totalRowH;

  // Bottom Net Take-Home Salary Row (Navy Blue #0B3B60)
  const netRowH = 19;
  document
    .roundedRect(marginX, currentTableRowY, tableW, netRowH, 4)
    .fillColor("#0B3B60")
    .fill();

  // Spans left side
  document
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#FFFFFF")
    .text("Net Take-Home Salary (Approx.)", colX1 + 6, currentTableRowY + 5.5, {
      width: colW1 + colW2 + colW3 - 12,
      align: "center",
    });

  // Right side monthly & annual take home
  document
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#FFFFFF")
    .text(formatCurrencyAmount(netTakeHomeMonthly), colX5, currentTableRowY + 5.5, {
      width: colW5 - 6,
      align: "right",
    })
    .text(formatCurrencyAmount(netTakeHomeAnnual), colX6, currentTableRowY + 5.5, {
      width: colW6 - 6,
      align: "right",
    });

  currentTableRowY += netRowH;

  // Notes under table
  const notesY = currentTableRowY + 4;
  document
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .fillColor("#0F172A")
    .text("Notes:", marginX, notesY);

  document
    .font("Helvetica")
    .fontSize(6)
    .fillColor("#475569")
    .text("*   Professional Tax (PT) is applicable as per state rules.", marginX + 3, notesY + 8)
    .text("**  Income Tax (TDS) will be deducted as per your applicable tax slab and declarations.", marginX + 3, notesY + 16);

  // ============================================================
  // 6. OTHER TERMS SECTION
  // ============================================================
  const termsPillY = notesY + 28;
  const termsPillW = 120;
  const termsPillH = 17;

  document
    .roundedRect(marginX, termsPillY, termsPillW, termsPillH, 8.5)
    .fillColor("#0B3B60")
    .fill();

  document
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor("#FFFFFF")
    .text("3. Other Terms", marginX, termsPillY + 4.5, {
      width: termsPillW,
      align: "center",
    });

  let termItemY = termsPillY + termsPillH + 6;
  const termItems = [
    { num: "1.", title: "Probation Period: ", text: "You will be on probation for a period of 6 months from your date of joining." },
    { num: "2.", title: "Working Hours: ", text: "9:00 AM to 6:00 PM, Monday to Friday (as per project requirements)." },
    { num: "3.", title: "Leave Policy: ", text: "As per company policy." },
    { num: "4.", title: "Confidentiality: ", text: "You are expected to maintain the confidentiality of company information." },
    { num: "5.", title: "Termination: ", text: "Either party may terminate the employment with one month’s notice or payment in lieu thereof." },
  ];

  termItems.forEach((item) => {
    document
      .font("Helvetica-Bold")
      .fontSize(7.2)
      .fillColor("#0F172A")
      .text(item.num, marginX + 8, termItemY, { width: 14 })
      .text(item.title, marginX + 22, termItemY, { continued: true })
      .font("Helvetica")
      .fillColor("#334155")
      .text(item.text);

    termItemY = document.y + 2.5;
  });

  // ============================================================
  // 7. CLOSING PARAGRAPHS & ACCEPTANCE
  // ============================================================
  curY = termItemY + 6;

  document
    .font("Helvetica")
    .fontSize(7.4)
    .fillColor("#1E293B")
    .text(
      "We believe that your skills and dedication will be valuable assets to our team. We look forward to your positive confirmation and welcoming you to Teens Software Solutions LLP.",
      marginX,
      curY,
      { width: contentWidth, lineGap: 1.5 }
    );

  curY = document.y + 4;
  document
    .font("Helvetica")
    .fontSize(7.4)
    .fillColor("#1E293B")
    .text(
      `Please confirm your acceptance of this offer by signing and returning a copy of this letter by ${acceptanceDate}.`,
      marginX,
      curY,
      { width: contentWidth }
    );

  curY = document.y + 4;
  document
    .font("Helvetica")
    .fontSize(7.4)
    .fillColor("#1E293B")
    .text("Congratulations and best wishes for a successful career with us!", marginX, curY);

  // ============================================================
  // 8. SIGN-OFF & SIGNATURE
  // ============================================================
  curY = document.y + 6;
  document
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor("#1E293B")
    .text("Yours sincerely,", marginX, curY);

  curY = document.y + 2;
  document
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#0F172A")
    .text("For Teens Software Solutions LLP", marginX, curY);

  // Stylized cursive HR signature matching the image
  const sigX = marginX + 6;
  const sigY = curY + 12;

  document.save();
  document
    .moveTo(sigX, sigY + 14)
    .bezierCurveTo(sigX + 10, sigY - 10, sigX + 18, sigY + 16, sigX + 32, sigY + 4)
    .bezierCurveTo(sigX + 44, sigY - 4, sigX + 54, sigY + 12, sigX + 70, sigY + 3)
    .bezierCurveTo(sigX + 80, sigY - 2, sigX + 90, sigY + 10, sigX + 110, sigY + 2)
    .moveTo(sigX + 8, sigY + 16)
    .lineTo(sigX + 75, sigY + 16)
    .strokeColor("#0284C7")
    .lineWidth(1.2)
    .stroke();
  document.restore();

  // HR Signatory Name & Title
  const hrName = details.hrName || "Rohit Sharma";
  const hrTitle = details.hrTitle || "Head – Human Resources";

  const hrTextY = sigY + 24;
  document
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#0F172A")
    .text(hrName, marginX, hrTextY);

  document
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor("#475569")
    .text(hrTitle, marginX, hrTextY + 10);

  // ============================================================
  // 9. FOOTER BAR & SLOGAN
  // ============================================================
  const footerDividerY = pageHeight - 48;

  // Thin line divider
  document
    .moveTo(marginX, footerDividerY)
    .lineTo(pageWidth - marginX, footerDividerY)
    .strokeColor("#CBD5E1")
    .lineWidth(0.8)
    .stroke();

  // Contact Info Row
  const contactY = footerDividerY + 6;
  const contactText = "Plot No. 123, Tech Park, Hyderabad – 500081, India   |   hr@teenssoftwaresolutions.com   |   www.teenssoftwaresolutions.com";

  document
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor("#334155")
    .text(contactText, marginX, contactY, {
      width: contentWidth,
      align: "center",
    });

  // Bottom tagline slogan
  document
    .font("Helvetica-Oblique")
    .fontSize(7.5)
    .fillColor("#0369A1")
    .text("Together for a Better Tomorrow", marginX, pageHeight - 24, {
      width: contentWidth,
      align: "right",
    });

  document.end();

  return pdfBuffer;
}
