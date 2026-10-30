import PDFDocument from "pdfkit";

export interface JoiningLetterDetails {
  firstName: string;
  lastName: string;
  designation: string;
  joiningDate: string;
  annualCtc: number;
  candidateId: string;
  department: string;
  employmentType: string;
  workLocation: string;
  probationPeriodMonths: number;
}

function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (match) {
    const [, year, month, day] = match;
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(
      new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    );
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid joining date.");
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function formatEmploymentType(value: string): string {
  const labels: Record<string, string> = {
    full_time: "Full-time",
    contract: "Contract",
    intern: "Intern",
  };

  return labels[value] ?? value;
}

function formatProbation(months: number): string {
  if (months === 0) return "No probation";

  return `${months} ${months === 1 ? "month" : "months"}`;
}

export async function generateJoiningLetterPdf(
  details: JoiningLetterDetails
): Promise<Buffer> {
  if (
    !details.firstName.trim() ||
    !details.lastName.trim() ||
    !details.designation.trim() ||
    !details.department.trim() ||
    !details.employmentType.trim() ||
    !details.workLocation.trim() ||
    !details.candidateId.trim() ||
    !Number.isFinite(details.annualCtc) ||
    details.annualCtc < 0 ||
    !Number.isInteger(details.probationPeriodMonths) ||
    ![0, 3, 6, 12].includes(details.probationPeriodMonths)
  ) {
    throw new Error("Invalid joining letter details.");
  }

  const formattedJoiningDate = formatDate(details.joiningDate);

  const document = new PDFDocument({
    size: "A4",
    margins: {
      top: 55,
      bottom: 55,
      left: 55,
      right: 55,
    },
    info: {
      Title: "Joining Letter",
      Author: "TEENS SOFTWARE SOLUTIONS LLP",
      Subject: "Employment Joining Confirmation",
    },
  });

  const chunks: Buffer[] = [];

  const pdfBuffer = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });

    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  document
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("#172554")
    .text("TEENS SOFTWARE SOLUTIONS LLP", { align: "center" });

  document
    .moveDown(0.3)
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#444444")
    .text("Hyderabad, Telangana, India", { align: "center" });

  document.moveDown(1.5);

  document
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#172554")
    .text("JOINING LETTER", { align: "center" });

  document.moveDown(1.5);

  document
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#222222")
    .text(`Date: ${formatDate(new Date().toISOString().slice(0, 10))}`);

  document.moveDown();

  document.text(`Candidate: ${details.firstName} ${details.lastName}`);
  document.moveDown();

  document.text(`Dear ${details.firstName},`);
  document.moveDown();

  document.text(
    "We are pleased to confirm your joining with TEENS SOFTWARE " +
      "SOLUTIONS LLP. We welcome you to our team and look forward " +
      "to your contributions."
  );

  document.moveDown();

  document
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("Employment Details");

  document.moveDown(0.5);

  document.font("Helvetica").fontSize(11);

  const employmentDetails: [string, string][] = [
    ["Designation", details.designation],
    ["Department", details.department],
    ["Employment Type", formatEmploymentType(details.employmentType)],
    ["Work Location", details.workLocation],
    ["Date of Joining", formattedJoiningDate],
    ["Annual CTC", formatIndianCurrency(details.annualCtc)],
    [
      "Probation Period",
      formatProbation(details.probationPeriodMonths),
    ],
  ];

  for (const [label, value] of employmentDetails) {
    document.text(`${label}: ${value}`, {
      lineGap: 4,
    });
  }

  document.moveDown();

  document.text(
    "Please report to the appropriate team on your joining date. " +
      "Your employment will be governed by the applicable company " +
      "policies, terms of employment, and any agreements provided " +
      "to you by the company."
  );

  document.moveDown();

  document.text(
    "Please contact the HR team if you need clarification regarding " +
      "your joining arrangements or employment details."
  );

  document.moveDown(2);

  document.text("We welcome you to TEENS SOFTWARE SOLUTIONS LLP.");
  document.moveDown();

  document.text("Regards,");
  document.moveDown(0.5);

  document.font("Helvetica-Bold").text("HR Team");
  document.font("Helvetica").text("TEENS SOFTWARE SOLUTIONS LLP");

  document.moveDown(2);

  document
    .fontSize(8)
    .fillColor("gray")
    .text(`Internal Candidate Reference: ${details.candidateId}`);

  document.end();

  return pdfBuffer;
}
