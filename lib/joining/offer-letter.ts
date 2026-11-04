import PDFDocument from "pdfkit";

export interface OfferLetterDetails {
  firstName: string;
  lastName: string;
  designation: string;
  annualCtc: number;
  candidateId: string;
  department: string;
  employmentType: string;
  workLocation: string;
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

function formatJoiningDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid joining date.");
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatEmploymentType(value: string): string {
  const types: Record<string, string> = {
    full_time: "Full-time",
    contract: "Contract",
    intern: "Intern",
  };

  return types[value] || value;
}

function formatProbation(months: number): string {
  if (months === 0) return "No probation";

  return `${months} ${months === 1 ? "month" : "months"}`;
}

export async function generateOfferLetterPdf(
  details: OfferLetterDetails
): Promise<Buffer> {
  if (
    !details.firstName?.trim() ||
    !details.lastName?.trim() ||
    !details.designation?.trim() ||
    !Number.isFinite(details.annualCtc) ||
    details.annualCtc < 0 ||
    !details.candidateId?.trim() ||
    !details.department?.trim() ||
    !details.employmentType?.trim() ||
    !details.workLocation?.trim() 
  ) {
    throw new Error("Invalid offer letter details.");
  }

  const document = new PDFDocument({
    size: "A4",
    margins: {
      top: 55,
      bottom: 55,
      left: 55,
      right: 55,
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

  document
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("TEENS SOFTWARE SOLUTIONS LLP", {
      align: "center",
    });

  document
    .moveDown(0.3)
    .font("Helvetica")
    .fontSize(10)
    .text("Hyderabad, Telangana, India", {
      align: "center",
    });

  document.moveDown(1.5);

  document
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("EMPLOYMENT OFFER LETTER", {
      align: "center",
    });

  document.moveDown(1.5);

  document
    .font("Helvetica")
    .fontSize(11)
    .text(`Date: ${formatCurrentDate()}`);

  document.moveDown();

  document.text(
    `Candidate: ${details.firstName} ${details.lastName}`
  );

  document.moveDown();

  document.text(`Dear ${details.firstName},`);

  document.moveDown();

  document.text(
    "We are pleased to extend an employment offer to you at " +
      "TEENS SOFTWARE SOLUTIONS LLP, subject to the terms and " +
      "conditions set out in the final employment agreement."
  );

  document.moveDown();

  document.font("Helvetica-Bold").text("Offer Details");

  document.moveDown(0.5);

  document.font("Helvetica");

  document.text(`Position: ${details.designation}`);
  document.text(`Department: ${details.department}`);
  document.text(
    `Employment Type: ${formatEmploymentType(details.employmentType)}`
  );
  document.text(`Work Location: ${details.workLocation}`);

  document.text(
    `Annual CTC: ${formatIndianCurrency(details.annualCtc)}`
  );

  document.moveDown();

  document.text(
    "Please review this offer and use the acceptance or decline " +
      "instructions provided in the accompanying email. Your final " +
      "employment terms will be documented in the applicable " +
      "employment agreement."
  );

  document.moveDown(2);

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
