import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { createAdminClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

// ============================================================
// TESSERACT WORKER
// ============================================================

const TESSERACT_WORKER_PATH = path.join(
  process.cwd(),
  "node_modules",
  "tesseract.js",
  "src",
  "worker-script",
  "node",
  "index.js"
);

console.log(
  "Tesseract worker absolute path:",
  TESSERACT_WORKER_PATH
);

// ============================================================
// CLOUDINARY
// ============================================================

cloudinary.config({
  cloud_name:
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:
    process.env.CLOUDINARY_API_KEY,
  api_secret:
    process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ============================================================
// DOCUMENT CONFIGURATION
// ============================================================

const MULTIPLE_DOCUMENT_TYPES = [
  "Experience Letter",
  "Other",
];

const ID_DOCUMENT_TYPES = [
  "Aadhar Card",
  "PAN Card",
  "Passport",
];

// ============================================================
// ALLOWED FILE TYPES
// ============================================================

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const ALLOWED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
];

// ============================================================
// MASK SENSITIVE ID FOR LOGGING
// ============================================================

function maskIdentityNumber(
  value: string | null
): string {
  if (!value) {
    return "none";
  }

  if (value.length <= 4) {
    return "****";
  }

  return `${"*".repeat(
    Math.max(0, value.length - 4)
  )}${value.slice(-4)}`;
}

// ============================================================
// AADHAAR VERHOEFF VALIDATION
// ============================================================
//
// Aadhaar numbers use the Verhoeff checksum.
//
// This prevents OCR from blindly saving any random
// 12-digit number as Aadhaar.
// ============================================================

const VERHOEFF_D = [
  [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  ],
  [
    1, 2, 3, 4, 0, 6, 7, 8, 9, 5,
  ],
  [
    2, 3, 4, 0, 1, 7, 8, 9, 5, 6,
  ],
  [
    3, 4, 0, 1, 2, 8, 9, 5, 6, 7,
  ],
  [
    4, 0, 1, 2, 3, 9, 5, 6, 7, 8,
  ],
  [
    5, 9, 8, 7, 6, 0, 4, 3, 2, 1,
  ],
  [
    6, 5, 9, 8, 7, 1, 0, 4, 3, 2,
  ],
  [
    7, 6, 5, 9, 8, 2, 1, 0, 4, 3,
  ],
  [
    8, 7, 6, 5, 9, 3, 2, 1, 0, 4,
  ],
  [
    9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
  ],
];

const VERHOEFF_P = [
  [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  ],
  [
    1, 5, 7, 6, 2, 8, 3, 0, 9, 4,
  ],
  [
    5, 8, 0, 3, 7, 9, 6, 1, 4, 2,
  ],
  [
    8, 9, 1, 6, 0, 4, 3, 5, 2, 7,
  ],
  [
    9, 4, 5, 3, 1, 2, 6, 8, 7, 0,
  ],
  [
    4, 2, 8, 6, 5, 7, 3, 9, 0, 1,
  ],
  [
    2, 7, 9, 3, 8, 0, 6, 4, 1, 5,
  ],
  [
    7, 0, 4, 6, 9, 1, 3, 2, 5, 8,
  ],
];

const VERHOEFF_INV = [
  0, 4, 3, 2, 1, 5, 6, 7, 8, 9,
];

function isValidAadhaar(
  aadhaar: string
): boolean {
  const digits = aadhaar.replace(
    /\D/g,
    ""
  );

  // Aadhaar must contain exactly 12 digits.
  if (digits.length !== 12) {
    return false;
  }

  // Aadhaar cannot start with 0 or 1.
  if (
    digits.startsWith("0") ||
    digits.startsWith("1")
  ) {
    return false;
  }

  // Reject obvious repeated values.
  if (
    /^(\d)\1{11}$/.test(digits)
  ) {
    return false;
  }

  // Verhoeff checksum.
  let checksum = 0;

  const reversed = digits
    .split("")
    .reverse();

  for (
    let i = 0;
    i < reversed.length;
    i++
  ) {
    const digit = Number(
      reversed[i]
    );

    checksum =
      VERHOEFF_D[checksum][
        VERHOEFF_P[i % 8][digit]
      ];
  }

  return checksum === 0;
}

// ============================================================
// EXTRACT AADHAAR NUMBER
// ============================================================

function extractAadhaar(
  text: string
): string | null {
  if (!text) {
    return null;
  }

  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const candidates: string[] = [];

  // ----------------------------------------------------------
  // 1. Aadhaar near Aadhaar-related words
  // ----------------------------------------------------------

  const contextMatches =
    normalized.matchAll(
      /(?:aadhaar|aadhar|uid|unique identification)[\s:#-]*(\d{4}[\s-]?\d{4}[\s-]?\d{4})/gi
    );

  for (
    const match of contextMatches
  ) {
    if (match[1]) {
      candidates.push(
        match[1].replace(
          /\D/g,
          ""
        )
      );
    }
  }

  // ----------------------------------------------------------
  // 2. Standard Aadhaar format
  // ----------------------------------------------------------

  const formattedMatches =
    normalized.match(
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
    );

  if (formattedMatches) {
    for (
      const match of formattedMatches
    ) {
      candidates.push(
        match.replace(
          /\D/g,
          ""
        )
      );
    }
  }

  // ----------------------------------------------------------
  // 3. Plain 12-digit OCR result
  // ----------------------------------------------------------

  const plainMatches =
    normalized.match(
      /\b\d{12}\b/g
    );

  if (plainMatches) {
    candidates.push(
      ...plainMatches
    );
  }

  // ----------------------------------------------------------
  // 4. OCR sometimes inserts spaces between digits.
  //
  // Try digit groups but do NOT blindly accept them.
  // Every candidate must pass Verhoeff.
  // ----------------------------------------------------------

  const digitStream =
    normalized.replace(
      /[^0-9]/g,
      ""
    );

  if (digitStream.length >= 12) {
    for (
      let i = 0;
      i <= digitStream.length - 12;
      i++
    ) {
      candidates.push(
        digitStream.substring(
          i,
          i + 12
        )
      );
    }
  }

  // ----------------------------------------------------------
  // Validate every candidate.
  // Only a valid Aadhaar is returned.
  // ----------------------------------------------------------

  const uniqueCandidates =
    Array.from(
      new Set(
        candidates.filter(
          (candidate) =>
            candidate.length === 12
        )
      )
    );

  for (
    const candidate of
      uniqueCandidates
  ) {
    if (
      isValidAadhaar(
        candidate
      )
    ) {
      console.log(
        "Valid Aadhaar detected:",
        maskIdentityNumber(
          candidate
        )
      );

      return candidate;
    }
  }

  console.warn(
    "No valid Aadhaar number found by OCR."
  );

  return null;
}

// ============================================================
// EXTRACT PAN NUMBER
// ============================================================

function extractPAN(
  text: string
): string | null {
  if (!text) {
    return null;
  }

  const normalized = text
    .toUpperCase()
    .replace(/\r/g, "\n");

  // ----------------------------------------------------------
  // PAN near PAN label
  // ----------------------------------------------------------

  const contextMatch =
    normalized.match(
      /(?:PAN|PERMANENT ACCOUNT NUMBER)[\s:#-]*([A-Z]{5}[\s-]?\d{4}[\s-]?[A-Z])/i
    );

  if (contextMatch?.[1]) {
    const pan =
      contextMatch[1]
        .replace(
          /[^A-Z0-9]/gi,
          ""
        )
        .toUpperCase();

    if (
      /^[A-Z]{5}\d{4}[A-Z]$/.test(
        pan
      )
    ) {
      return pan;
    }
  }

  // ----------------------------------------------------------
  // Normal PAN format
  // ----------------------------------------------------------

  const matches =
    normalized.match(
      /\b[A-Z]{5}[\s-]?\d{4}[\s-]?[A-Z]\b/g
    );

  if (matches) {
    for (
      const value of matches
    ) {
      const pan =
        value
          .replace(
            /[^A-Z0-9]/gi,
            ""
          )
          .toUpperCase();

      if (
        /^[A-Z]{5}\d{4}[A-Z]$/.test(
          pan
        )
      ) {
        return pan;
      }
    }
  }

  // ----------------------------------------------------------
  // OCR may insert spaces
  // ----------------------------------------------------------

  const compact =
    normalized.replace(
      /[^A-Z0-9]/g,
      ""
    );

  const compactMatch =
    compact.match(
      /[A-Z]{5}\d{4}[A-Z]/
    );

  if (compactMatch?.[0]) {
    const pan =
      compactMatch[0]
        .toUpperCase();

    if (
      /^[A-Z]{5}\d{4}[A-Z]$/.test(
        pan
      )
    ) {
      return pan;
    }
  }

  return null;
}

// ============================================================
// EXTRACT PASSPORT NUMBER
// ============================================================

function extractPassport(
  text: string
): string | null {
  if (!text) {
    return null;
  }

  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .toUpperCase()
    .trim();

  // ----------------------------------------------------------
  // Indian passport format: A1234567
  // ----------------------------------------------------------

  const contextMatch =
    normalized.match(
      /(?:PASSPORT|PASSPORT NO|PASSPORT NUMBER|DOCUMENT NO)[\s:#-]*([A-Z]\d{7})/i
    );

  if (contextMatch?.[1]) {
    const passport =
      contextMatch[1]
        .replace(
          /[\s-]/g,
          ""
        )
        .toUpperCase();

    if (
      /^[A-Z]\d{7}$/.test(
        passport
      )
    ) {
      return passport;
    }
  }

  // ----------------------------------------------------------
  // Fallback
  // ----------------------------------------------------------

  const matches =
    normalized.match(
      /\b[A-Z]\d{7}\b/g
    );

  if (matches) {
    for (
      const match of matches
    ) {
      const passport =
        match
          .replace(
            /[\s-]/g,
            ""
          )
          .toUpperCase();

      if (
        /^[A-Z]\d{7}$/.test(
          passport
        )
      ) {
        return passport;
      }
    }
  }

  return null;
}

// ============================================================
// EXTRACT DOCUMENT NUMBER
// ============================================================

function extractDocumentNumber(
  documentType: string,
  text: string
): string | null {
  switch (documentType) {
    case "Aadhar Card":
      return extractAadhaar(
        text
      );

    case "PAN Card":
      return extractPAN(
        text
      );

    case "Passport":
      return extractPassport(
        text
      );

    default:
      return null;
  }
}

// ============================================================
// DOCUMENT TYPE DETECTION
// ============================================================
//
// SOFT VALIDATION ONLY.
// It NEVER blocks the upload.
// ============================================================

function validateDocumentType(
  documentType: string,
  text: string
): boolean {
  const normalized = text
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return false;
  }

  const hasMultipleKeywords = (
    keywords: string[],
    minimumMatches = 2
  ) => {
    const matches =
      keywords.filter(
        (keyword) =>
          normalized.includes(
            keyword
          )
      );

    console.log(
      `${documentType} keyword matches:`,
      matches
    );

    return (
      matches.length >=
      minimumMatches
    );
  };

  switch (documentType) {
    case "Aadhar Card":
      return !!extractAadhaar(
        normalized
      );

    case "PAN Card":
      return !!extractPAN(
        normalized
      );

    case "Passport": {
      const passportNumber =
        extractPassport(
          normalized
        );

      const hasPassportKeyword =
        normalized.includes(
          "PASSPORT"
        ) ||
        normalized.includes(
          "REPUBLIC OF INDIA"
        ) ||
        normalized.includes(
          "SURNAME"
        ) ||
        normalized.includes(
          "GIVEN NAME"
        ) ||
        normalized.includes(
          "NATIONALITY"
        );

      return (
        !!passportNumber &&
        hasPassportKeyword
      );
    }

    case "Resume":
      return hasMultipleKeywords(
        [
          "RESUME",
          "CURRICULUM VITAE",
          "WORK EXPERIENCE",
          "PROFESSIONAL EXPERIENCE",
          "EDUCATION",
          "SKILLS",
        ],
        2
      );

    case "10th Certificate":
      return hasMultipleKeywords(
        [
          "SECONDARY SCHOOL",
          "SECONDARY SCHOOL CERTIFICATE",
          "SSC",
          "10TH CLASS",
          "10TH STANDARD",
          "MATRICULATION",
        ],
        2
      );

    case "12th Certificate":
      return hasMultipleKeywords(
        [
          "HIGHER SECONDARY",
          "HIGHER SECONDARY CERTIFICATE",
          "HSC",
          "12TH CLASS",
          "12TH STANDARD",
          "INTERMEDIATE",
        ],
        2
      );

    case "Graduation Certificate":
      return hasMultipleKeywords(
        [
          "BACHELOR",
          "BACHELOR OF TECHNOLOGY",
          "BACHELOR OF ENGINEERING",
          "BACHELOR OF SCIENCE",
          "BACHELOR OF COMMERCE",
          "BACHELOR OF COMPUTER APPLICATIONS",
          "DEGREE",
          "GRADUATION",
          "UNIVERSITY",
        ],
        2
      );

    case "Post-Graduation Certificate":
      return hasMultipleKeywords(
        [
          "MASTER",
          "MASTER OF TECHNOLOGY",
          "MASTER OF ENGINEERING",
          "MASTER OF SCIENCE",
          "MASTER OF COMPUTER APPLICATIONS",
          "MASTER OF BUSINESS ADMINISTRATION",
          "POST GRADUATION",
          "POSTGRADUATION",
          "POST-GRADUATE",
        ],
        2
      );

    case "Experience Letter":
      return hasMultipleKeywords(
        [
          "EXPERIENCE LETTER",
          "WORK EXPERIENCE",
          "EMPLOYMENT CERTIFICATE",
          "TO WHOMSOEVER IT MAY CONCERN",
          "EMPLOYED WITH",
        ],
        2
      );

    case "Relieving Letter":
      return hasMultipleKeywords(
        [
          "RELIEVING LETTER",
          "RELIEVED FROM",
          "RELIEVING DATE",
          "RELIEVED OF HIS",
          "RELIEVED OF HER",
        ],
        2
      );

    case "Offer Letter":
      return hasMultipleKeywords(
        [
          "OFFER LETTER",
          "LETTER OF OFFER",
          "EMPLOYMENT OFFER",
          "OFFER OF EMPLOYMENT",
          "JOINING DATE",
          "CTC",
          "COMPENSATION",
        ],
        2
      );

    case "Other":
      return true;

    default:
      return false;
  }
}

// ============================================================
// OCR IMAGE
// ============================================================

async function runOCR(
  imageBuffer: Buffer
): Promise<string> {
  console.log(
    "Starting Tesseract OCR..."
  );

  const worker =
    await createWorker(
      "eng",
      1,
      {
        workerPath:
          TESSERACT_WORKER_PATH,
      }
    );

  try {
    const result =
      await worker.recognize(
        imageBuffer
      );

    const text =
      result.data.text || "";

    console.log(
      "OCR text length:",
      text.length
    );

    console.log(
      "OCR RESULT:",
      JSON.stringify(
        text.substring(
          0,
          2000
        )
      )
    );

    return text;
  } catch (error) {
    console.error(
      "OCR failed:",
      error
    );

    return "";
  } finally {
    try {
      await worker.terminate();
    } catch (terminateError) {
      console.error(
        "Could not terminate Tesseract worker:",
        terminateError
      );
    }
  }
}

// ============================================================
// EXTRACT PDF TEXT
// ============================================================

async function extractTextFromPDF(
  buffer: Buffer
): Promise<string> {
  const parser =
    new PDFParse({
      data: buffer,
    });

  try {
    // ========================================================
    // 1. NORMAL PDF TEXT EXTRACTION
    // ========================================================

    let extractedText = "";

    try {
      const textResult =
        await parser.getText();

      extractedText =
        (textResult.text || "")
          .replace(
            /--\s*\d+\s+of\s+\d+\s*--/gi,
            ""
          )
          .trim();

      const meaningfulText =
        extractedText.replace(
          /[^A-Za-z0-9]/g,
          ""
        );

      console.log(
        "Meaningful PDF text length:",
        meaningfulText.length
      );

      if (
        meaningfulText.length > 10
      ) {
        console.log(
          "PDF text extraction successful"
        );

        return extractedText;
      }
    } catch (textError) {
      console.error(
        "PDF text extraction failed:",
        textError
      );
    }

    // ========================================================
    // 2. OCR EMBEDDED IMAGES
    // ========================================================

    console.log(
      "PDF contains no useful text. Starting OCR..."
    );

    let ocrText = "";

    try {
      const imageResult =
        await parser.getImage({
          imageThreshold: 0,
          imageBuffer: true,
          imageDataUrl: false,
        });

      console.log(
        "PDF image pages:",
        imageResult.pages?.length ||
          0
      );

      for (
        const page of
          imageResult.pages || []
      ) {
        console.log(
          `Page ${page.pageNumber}: images = ${
            page.images?.length || 0
          }`
        );

        for (
          const image of
            page.images || []
        ) {
          if (!image.data) {
            continue;
          }

          try {
            const pageText =
              await runOCR(
                Buffer.from(
                  image.data
                )
              );

            if (
              pageText.trim()
            ) {
              ocrText +=
                `\n${pageText}`;
            }
          } catch (ocrError) {
            console.error(
              "Embedded image OCR error:",
              ocrError
            );
          }
        }
      }
    } catch (imageError) {
      console.error(
        "Embedded image extraction failed:",
        imageError
      );
    }

    // ========================================================
    // 3. RENDER PDF PAGES AND OCR
    // ========================================================

    if (!ocrText.trim()) {
      console.log(
        "Embedded image OCR returned no text."
      );

      console.log(
        "Rendering PDF pages for OCR..."
      );

      try {
        const screenshotResult =
          await parser.getScreenshot({
            first: 3,
            desiredWidth: 2000,
            imageBuffer: true,
            imageDataUrl: false,
          });

        console.log(
          "Screenshot pages:",
          screenshotResult
            .pages?.length || 0
        );

        for (
          const page of
            screenshotResult.pages ||
            []
        ) {
          if (!page.data) {
            continue;
          }

          try {
            const pageText =
              await runOCR(
                Buffer.from(
                  page.data
                )
              );

            if (
              pageText.trim()
            ) {
              ocrText +=
                `\n${pageText}`;
            }
          } catch (ocrError) {
            console.error(
              "Rendered page OCR error:",
              ocrError
            );
          }
        }
      } catch (
        screenshotError
      ) {
        console.error(
          "PDF screenshot OCR failed:",
          screenshotError
        );
      }
    }

    return ocrText.trim();
  } finally {
    await parser.destroy();
  }
}

// ============================================================
// CLOUDINARY DELETE HELPER
// ============================================================

async function deleteCloudinaryFile(
  publicId: string,
  resourceType?: string
) {
  if (!publicId) {
    return;
  }

  try {
    const actualResourceType =
      resourceType || "image";

    console.log(
      "Deleting Cloudinary file:",
      {
        publicId,
        resourceType:
          actualResourceType,
      }
    );

    const result =
      await cloudinary.uploader.destroy(
        publicId,
        {
          resource_type:
            actualResourceType,
          invalidate: true,
        }
      );

    console.log(
      "Cloudinary delete result:",
      result
    );

    return result;
  } catch (error) {
    console.error(
      "Cloudinary cleanup error:",
      error
    );

    return null;
  }
}

// ============================================================
// GET EXISTING DOCUMENT
// ============================================================

async function getExistingDocument(
  supabaseAdmin: any,
  employeeId: string,
  documentType: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "employee_documents"
    )
    .select("*")
    .eq(
      "employee_id",
      employeeId
    )
    .eq(
      "document_type",
      documentType
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not check existing document: ${error.message}`
    );
  }

  return data;
}

// ============================================================
// POST
// ============================================================

export async function POST(
  request: Request
) {
  let uploadResult:
    | {
        public_id?: string;
        secure_url?: string;
        resource_type?: string;
      }
    | null = null;

  try {
    // ========================================================
    // SUPABASE ADMIN
    // ========================================================

    const supabaseAdmin =
      await createAdminClient();

    // ========================================================
    // FORM DATA
    // ========================================================

    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      ) as File | null;

    const employee_id =
      formData.get(
        "employee_id"
      ) as string | null;

    const document_type =
      formData.get(
        "document_type"
      ) as string | null;

    const document_name =
      formData.get(
        "document_name"
      ) as string | null;

    // ========================================================
    // REQUIRED FIELDS
    // ========================================================

    if (
      !file ||
      !employee_id ||
      !document_type ||
      !document_name?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "File, employee, document type, and document name are required",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // FILE SIZE
    // ========================================================

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            "File size exceeds 5MB limit",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // EMPTY FILE
    // ========================================================

    if (file.size === 0) {
      return NextResponse.json(
        {
          error:
            "The uploaded file is empty.",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // FILE TYPE
    // ========================================================

    const extension =
      file.name
        .toLowerCase()
        .split(".")
        .pop();

    const validMime =
      ALLOWED_MIME_TYPES.includes(
        file.type
      );

    const validExtension =
      ALLOWED_EXTENSIONS.includes(
        extension || ""
      );

    if (
      !validMime &&
      !validExtension
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Please upload a PDF, JPG, JPEG, PNG, or WEBP file.",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // FILE BUFFER
    // ========================================================

    let fileBuffer: Buffer;

    try {
      fileBuffer =
        Buffer.from(
          await file.arrayBuffer()
        );
    } catch (error) {
      console.error(
        "Could not read uploaded file:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Could not read the uploaded file.",
        },
        {
          status: 422,
        }
      );
    }

    // ========================================================
    // OCR / PDF TEXT
    // ========================================================

    let extractedText = "";

    try {
      const isPDF =
        file.type ===
          "application/pdf" ||
        file.name
          .toLowerCase()
          .endsWith(".pdf");

      if (isPDF) {
        extractedText =
          await extractTextFromPDF(
            fileBuffer
          );
      } else {
        extractedText =
          await runOCR(
            fileBuffer
          );
      }

      console.log(
        `Extracted text length for ${document_type}:`,
        extractedText.length
      );
    } catch (
      extractionError
    ) {
      console.error(
        "Document text extraction error:",
        extractionError
      );

      // OCR failure must NOT stop upload.
      extractedText = "";
    }

    // ========================================================
    // SOFT DOCUMENT VALIDATION
    // ========================================================

    const isDocumentMatching =
      validateDocumentType(
        document_type,
        extractedText
      );

    console.log(
      `Document OCR validation: ${document_type} = ${isDocumentMatching}`
    );

    if (!isDocumentMatching) {
      console.warn(
        `OCR could not confidently identify ${document_type}. Upload will continue.`
      );
    }

    // ========================================================
    // EXTRACT ID NUMBER
    // ========================================================

    let identityNumber:
      | string
      | null = null;

    if (
      ID_DOCUMENT_TYPES.includes(
        document_type
      )
    ) {
      identityNumber =
        extractDocumentNumber(
          document_type,
          extractedText
        );

      console.log(
        `${document_type} number detected:`,
        maskIdentityNumber(
          identityNumber
        )
      );
    }

    // ========================================================
    // MULTIPLE DOCUMENT CHECK
    // ========================================================

    const allowsMultiple =
      MULTIPLE_DOCUMENT_TYPES.includes(
        document_type
      );

    // ========================================================
    // FIND EXISTING DOCUMENT
    //
    // IMPORTANT:
    // Use ADMIN client.
    //
    // The previous code used createClient().
    // RLS could hide the existing row and then INSERT
    // caused:
    //
    // duplicate key value violates unique constraint
    // "employee_one_document_type"
    // ========================================================

    let existingDocument:
      | Record<string, any>
      | null = null;

    if (!allowsMultiple) {
      existingDocument =
        await getExistingDocument(
          supabaseAdmin,
          employee_id,
          document_type
        );

      console.log(
        "Existing document found:",
        !!existingDocument
      );
    }

    // ========================================================
    // CLOUDINARY UPLOAD
    // ========================================================

    const base64Data =
      fileBuffer.toString(
        "base64"
      );

    const mimeType =
      file.type ||
      "application/octet-stream";

    const dataURI =
      `data:${mimeType};base64,${base64Data}`;

    uploadResult =
      await new Promise<{
        public_id: string;
        secure_url: string;
        resource_type: string;
      }>(
        (
          resolve,
          reject
        ) => {
          cloudinary.uploader.upload(
            dataURI,
            {
              folder:
                "teens-hr/documents",

              resource_type:
                "auto",

              use_filename:
                true,

              unique_filename:
                true,
            },
            (
              error,
              result
            ) => {
              if (error) {
                reject(error);
              } else if (
                result
              ) {
                resolve(
                  result as {
                    public_id: string;
                    secure_url: string;
                    resource_type: string;
                  }
                );
              } else {
                reject(
                  new Error(
                    "Cloudinary returned no result."
                  )
                );
              }
            }
          );
        }
      );

    console.log(
      "Cloudinary upload successful:",
      {
        public_id:
          uploadResult.public_id,
        resource_type:
          uploadResult.resource_type,
      }
    );

    // ========================================================
    // IDENTITY DATABASE FIELDS
    // ========================================================

    const identityFields = {
      aadhaar_number:
        document_type ===
        "Aadhar Card"
          ? identityNumber
          : null,

      pan_number:
        document_type ===
        "PAN Card"
          ? identityNumber
          : null,

      passport_number:
        document_type ===
        "Passport"
          ? identityNumber
          : null,
    };

    // ========================================================
    // UPDATE EXISTING DOCUMENT
    // ========================================================

    if (
      existingDocument
    ) {
      const {
        data:
          updatedDocument,
        error:
          updateError,
      } = await supabaseAdmin
        .from(
          "employee_documents"
        )
        .update({
          document_name:
            document_name.trim(),

          document_url:
            uploadResult.secure_url,

          cloudinary_public_id:
            uploadResult.public_id,

          cloudinary_resource_type:
            uploadResult.resource_type,

          ...identityFields,
        })
        .eq(
          "id",
          existingDocument.id
        )
        .select()
        .single();

      if (
        updateError
      ) {
        console.error(
          "Error updating document record:",
          updateError
        );

        // Delete NEW Cloudinary file
        // because DB update failed.
        if (
          uploadResult.public_id
        ) {
          await deleteCloudinaryFile(
            uploadResult.public_id,
            uploadResult.resource_type
          );
        }

        return NextResponse.json(
          {
            error:
              `File uploaded but document record could not be updated: ${updateError.message}`,
          },
          {
            status: 500,
          }
        );
      }

      // ======================================================
      // DB UPDATE SUCCESS
      //
      // Now delete OLD Cloudinary file.
      // ======================================================

      if (
        existingDocument.cloudinary_public_id &&
        existingDocument.cloudinary_public_id !==
          uploadResult.public_id
      ) {
        await deleteCloudinaryFile(
          existingDocument.cloudinary_public_id,
          existingDocument.cloudinary_resource_type
        );
      }

      // ======================================================
      // REVALIDATE
      // ======================================================

      revalidatePath(
        `/dashboard/employees/${employee_id}`
      );

      return NextResponse.json({
        message:
          `${document_type} replaced successfully`,

        url:
          uploadResult.secure_url,

        public_id:
          uploadResult.public_id,

        document:
          updatedDocument,

        replaced: true,

        ocrVerified:
          isDocumentMatching,

        identityNumberFound:
          !!identityNumber,
      });
    }

    // ========================================================
    // INSERT NEW DOCUMENT
    // ========================================================

    const {
      data:
        documentRecord,
      error:
        insertError,
    } = await supabaseAdmin
      .from(
        "employee_documents"
      )
      .insert({
        employee_id,

        document_type,

        document_name:
          document_name.trim(),

        document_url:
          uploadResult.secure_url,

        cloudinary_public_id:
          uploadResult.public_id,

        cloudinary_resource_type:
          uploadResult.resource_type,

        ...identityFields,
      })
      .select()
      .single();

    // ========================================================
    // INSERT ERROR
    // ========================================================

    if (
      insertError
    ) {
      console.error(
        "Error saving document record:",
        insertError
      );

      // ======================================================
      // DUPLICATE KEY / RACE CONDITION
      // ======================================================
      //
      // Another request may have inserted the same
      // employee + document type between our SELECT
      // and INSERT.
      //
      // Instead of returning an error, find that record
      // and replace it.
      // ======================================================

      if (
        insertError.code ===
        "23505"
      ) {
        console.warn(
          "Duplicate document detected. Re-fetching existing document..."
        );

        const duplicateDocument =
          await getExistingDocument(
            supabaseAdmin,
            employee_id,
            document_type
          );

        if (
          duplicateDocument
        ) {
          const {
            data:
              replacedDocument,
            error:
              replaceError,
          } = await supabaseAdmin
            .from(
              "employee_documents"
            )
            .update({
              document_name:
                document_name.trim(),

              document_url:
                uploadResult.secure_url,

              cloudinary_public_id:
                uploadResult.public_id,

              cloudinary_resource_type:
                uploadResult.resource_type,

              ...identityFields,
            })
            .eq(
              "id",
              duplicateDocument.id
            )
            .select()
            .single();

          if (
            replaceError
          ) {
            console.error(
              "Duplicate recovery update failed:",
              replaceError
            );

            if (
              uploadResult.public_id
            ) {
              await deleteCloudinaryFile(
                uploadResult.public_id,
                uploadResult.resource_type
              );
            }

            return NextResponse.json(
              {
                error:
                  `File uploaded but document record could not be saved: ${replaceError.message}`,
              },
              {
                status: 500,
              }
            );
          }

          // Delete the old Cloudinary file
          // only after the replacement DB record succeeds.
          if (
            duplicateDocument.cloudinary_public_id &&
            duplicateDocument.cloudinary_public_id !==
              uploadResult.public_id
          ) {
            await deleteCloudinaryFile(
              duplicateDocument.cloudinary_public_id,
              duplicateDocument.cloudinary_resource_type
            );
          }

          revalidatePath(
            `/dashboard/employees/${employee_id}`
          );

          return NextResponse.json({
            message:
              `${document_type} replaced successfully`,

            url:
              uploadResult.secure_url,

            public_id:
              uploadResult.public_id,

            document:
              replacedDocument,

            replaced: true,

            ocrVerified:
              isDocumentMatching,

            identityNumberFound:
              !!identityNumber,
          });
        }
      }

      // ======================================================
      // NORMAL INSERT FAILURE
      // ======================================================

      if (
        uploadResult.public_id
      ) {
        await deleteCloudinaryFile(
          uploadResult.public_id,
          uploadResult.resource_type
        );
      }

      return NextResponse.json(
        {
          error:
            `File uploaded but document record could not be saved: ${insertError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // SUCCESS
    // ========================================================

    revalidatePath(
      `/dashboard/employees/${employee_id}`
    );

    return NextResponse.json({
      message:
        `${document_type} uploaded successfully`,

      url:
        uploadResult.secure_url,

      public_id:
        uploadResult.public_id,

      document:
        documentRecord,

      replaced: false,

      ocrVerified:
        isDocumentMatching,

      identityNumberFound:
        !!identityNumber,
    });
  } catch (error: unknown) {
    console.error(
      "Upload error:",
      error
    );

    // ========================================================
    // FINAL CLOUDINARY CLEANUP
    // ========================================================

    if (
      uploadResult?.public_id
    ) {
      await deleteCloudinaryFile(
        uploadResult.public_id,
        uploadResult.resource_type
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "An error occurred during file upload";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}