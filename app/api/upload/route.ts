import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getPath } from 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';
import { createWorker, PSM } from 'tesseract.js';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

PDFParse.setWorker(getPath());

// ======================================================
// TESSERACT WORKER
// ======================================================

const TESSERACT_WORKER_PATH = path.join(
  process.cwd(),
  'node_modules',
  'tesseract.js',
  'src',
  'worker-script',
  'node',
  'index.js'
);

console.log(
  'Tesseract worker absolute path:',
  TESSERACT_WORKER_PATH
);

// ======================================================
// CLOUDINARY
// ======================================================

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ======================================================
// CONSTANTS
// ======================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
];

// These document types can have multiple files
const MULTIPLE_DOCUMENT_TYPES = [
  'Experience Letter',
  'Other',
];

// These documents require number extraction
const ID_DOCUMENT_TYPES = [
  'Aadhar Card',
  'PAN Card',
  'Passport',
];

// ======================================================
// EXTRACT AADHAAR NUMBER
// ======================================================

function extractAadhaar(text: string): string | null {
  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();

  // --------------------------------------------------
  // 1. Standard format
  //
  // 1234 5678 9012
  // 1234-5678-9012
  // 123456789012
  // --------------------------------------------------

  const standardMatches = normalized.match(
    /\b\d{4}\s*[-]?\s*\d{4}\s*[-]?\s*\d{4}\b/g
  );

  if (standardMatches) {
    for (const match of standardMatches) {
      const digits = match.replace(/\D/g, '');

      if (digits.length === 12) {
        console.log(
          'Aadhaar found - standard:',
          digits
        );

        return digits;
      }
    }
  }

  // --------------------------------------------------
  // 2. Aadhaar-related text nearby
  // --------------------------------------------------

  const lines = normalized.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      /aadhaar|aadhar|uidai|unique identification/i.test(
        line
      )
    ) {
      const nearbyText = lines
        .slice(
          Math.max(0, i - 2),
          Math.min(lines.length, i + 4)
        )
        .join(' ');

      const nearbyMatch = nearbyText.match(
        /\b\d{4}\s*[-]?\s*\d{4}\s*[-]?\s*\d{4}\b/
      );

      if (nearbyMatch) {
        const digits =
          nearbyMatch[0].replace(/\D/g, '');

        if (digits.length === 12) {
          console.log(
            'Aadhaar found - nearby Aadhaar text:',
            digits
          );

          return digits;
        }
      }
    }
  }

  // --------------------------------------------------
  // 3. Three separate 4-digit groups
  //
  // We DO NOT automatically accept these.
  // This prevents DOB and unrelated numbers from
  // becoming Aadhaar numbers.
  // --------------------------------------------------

  const groups =
    normalized.match(/\b\d{4}\b/g) || [];

  for (
    let i = 0;
    i < groups.length - 2;
    i++
  ) {
    const candidate =
      groups[i] +
      groups[i + 1] +
      groups[i + 2];

    if (
      candidate.startsWith('0101') ||
      candidate.startsWith('0102') ||
      candidate.startsWith('0103') ||
      candidate.startsWith('011')
    ) {
      continue;
    }

    if (candidate.length === 12) {
      console.log(
        'Possible Aadhaar candidate:',
        candidate
      );
    }
  }

  console.log(
    'NO RELIABLE AADHAAR NUMBER FOUND'
  );

  return null;
}

// ======================================================
// EXTRACT PAN NUMBER
// ======================================================

function extractPAN(text: string): string | null {
  const normalized = text
    .toUpperCase()
    .replace(/\r/g, '\n');

  // --------------------------------------------------
  // PAN near PAN label
  // --------------------------------------------------

  const contextMatch = normalized.match(
    /(?:PAN|PERMANENT ACCOUNT NUMBER)[\s:#-]*([A-Z]{5}[\s-]?\d{4}[\s-]?[A-Z])/i
  );

  if (contextMatch?.[1]) {
    const pan = contextMatch[1]
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase();

    if (/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
      console.log(
        'PAN found - context:',
        pan
      );

      return pan;
    }
  }

  // --------------------------------------------------
  // Standard PAN format
  // --------------------------------------------------

  const matches = normalized.match(
    /\b[A-Z]{5}[\s-]?\d{4}[\s-]?[A-Z]\b/g
  );

  if (matches) {
    for (const value of matches) {
      const pan = value
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase();

      if (/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
        console.log(
          'PAN found - standard:',
          pan
        );

        return pan;
      }
    }
  }

  console.log(
    'NO RELIABLE PAN NUMBER FOUND'
  );

  return null;
}

// ======================================================
// EXTRACT PASSPORT NUMBER
// ======================================================

function extractPassport(
  text: string
): string | null {
  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .toUpperCase()
    .trim();

  // --------------------------------------------------
  // Passport number near passport label
  // Indian passport format generally:
  //
  // A1234567
  // B1234567
  // etc.
  // --------------------------------------------------

  const contextMatch = normalized.match(
    /(?:PASSPORT|PASSPORT NO|PASSPORT NUMBER|DOCUMENT NO)[\s:#-]*([A-Z]\d{7})/i
  );

  if (contextMatch?.[1]) {
    const passport = contextMatch[1]
      .replace(/[\s-]/g, '')
      .toUpperCase();

    if (/^[A-Z]\d{7}$/.test(passport)) {
      console.log(
        'Passport found - context:',
        passport
      );

      return passport;
    }
  }

  // --------------------------------------------------
  // Standard passport number
  // --------------------------------------------------

  const matches = normalized.match(
    /\b[A-Z]\d{7}\b/g
  );

  if (matches) {
    for (const match of matches) {
      const passport = match
        .replace(/[\s-]/g, '')
        .toUpperCase();

      if (/^[A-Z]\d{7}$/.test(passport)) {
        console.log(
          'Passport found - standard:',
          passport
        );

        return passport;
      }
    }
  }

  console.log(
    'NO RELIABLE PASSPORT NUMBER FOUND'
  );

  return null;
}

// ======================================================
// EXTRACT NUMBER BASED ON DOCUMENT TYPE
// ======================================================

function extractDocumentNumber(
  documentType: string,
  text: string
): string | null {
  switch (documentType) {
    case 'Aadhar Card':
      return extractAadhaar(text);

    case 'PAN Card':
      return extractPAN(text);

    case 'Passport':
      return extractPassport(text);

    default:
      return null;
  }
}

// ======================================================
// DOCUMENT TYPE VALIDATION
// ======================================================

function validateDocumentType(
  documentType: string,
  text: string
): boolean {
  const normalized = text
    .toUpperCase()
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!normalized) {
    console.log(
      `Document validation failed: ${documentType} has no OCR text`
    );

    return false;
  }

  console.log(
    `========== VALIDATING ${documentType.toUpperCase()} ==========`
  );


  // ==================================================
  // HELPER
  // ==================================================

  const containsAny = (
    keywords: string[]
  ): boolean => {
    return keywords.some((keyword) =>
      normalized.includes(keyword)
    );
  };

  const matchedKeywords = (
    keywords: string[]
  ): string[] => {
    return keywords.filter((keyword) =>
      normalized.includes(keyword)
    );
  };

  const hasKeywordGroups = (
    groups: string[][],
    minimumGroups: number
  ): boolean => {
    let matchedGroups = 0;

    for (const group of groups) {
      if (containsAny(group)) {
        matchedGroups++;
      }
    }

    console.log(
      `${documentType} matched keyword groups:`,
      matchedGroups,
      '/',
      groups.length
    );

    return matchedGroups >= minimumGroups;
  };

  // ==================================================
  // AADHAAR CARD
  // ==================================================

  switch (documentType) {
    case 'Aadhar Card': {
      const aadhaarNumber =
        extractAadhaar(normalized);

      const aadhaarGroups = [
        [
          'AADHAAR',
          'AADHAR',
          'UIDAI',
          'UNIQUE IDENTIFICATION',
        ],
        [
          'GOVERNMENT OF INDIA',
          'GOVERNMENT OF INDIA',
        ],
        [
          'DATE OF BIRTH',
          'DOB',
          'YEAR OF BIRTH',
        ],
        [
          'MALE',
          'FEMALE',
          'TRANSGENDER',
        ],
      ];

      const matched =
        aadhaarGroups.filter((group) =>
          containsAny(group)
        );

      console.log(
        'Aadhaar number found:',
        !!aadhaarNumber
      );

      console.log(
        'Aadhaar matched groups:',
        matched.length
      );

      /*
       * Strict requirement:
       *
       * 1. Valid Aadhaar number
       * 2. At least 2 Aadhaar document indicators
       */

      return (
        !!aadhaarNumber &&
        matched.length >= 2
      );
    }

    // ==================================================
    // PAN CARD
    // ==================================================

    case 'PAN Card': {
      const panNumber =
        extractPAN(normalized);

      const panGroups = [
        [
          'PERMANENT ACCOUNT NUMBER',
          'PAN',
        ],
        [
          'INCOME TAX DEPARTMENT',
          'INCOME TAX',
        ],
        [
          'GOVERNMENT OF INDIA',
          'GOVT OF INDIA',
        ],
        [
          'NAME',
          'FATHER',
          "FATHER'S NAME",
        ],
        [
          'DATE OF BIRTH',
          'DOB',
        ],
      ];

      const matched =
        panGroups.filter((group) =>
          containsAny(group)
        );

      console.log(
        'PAN number found:',
        !!panNumber
      );

      console.log(
        'PAN matched groups:',
        matched.length
      );

      /*
       * Strict:
       * Valid PAN number
       * + at least 2 PAN-specific groups
       */

      return (
        !!panNumber &&
        matched.length >= 2
      );
    }

    // ==================================================
    // PASSPORT
    // ==================================================

    case 'Passport': {
      const passportNumber =
        extractPassport(normalized);

      const passportGroups = [
        [
          'PASSPORT',
        ],
        [
          'REPUBLIC OF INDIA',
          'REPUBLIC OF INDIA',
        ],
        [
          'SURNAME',
          'GIVEN NAME',
        ],
        [
          'NATIONALITY',
          'INDIAN',
        ],
        [
          'DATE OF BIRTH',
          'DATE OF ISSUE',
          'DATE OF EXPIRY',
        ],
        [
          'PLACE OF BIRTH',
          'PLACE OF ISSUE',
        ],
      ];

      const matched =
        passportGroups.filter((group) =>
          containsAny(group)
        );

      console.log(
        'Passport number found:',
        !!passportNumber
      );

      console.log(
        'Passport matched groups:',
        matched.length
      );

      /*
       * Strict:
       * Valid passport number
       * + at least 3 passport groups
       */

      return (
        !!passportNumber &&
        matched.length >= 3
      );
    }

    // ==================================================
    // RESUME
    // ==================================================

    case 'Resume': {
      const resumeGroups = [
        [
          'RESUME',
          'CURRICULUM VITAE',
          'CV',
        ],
        [
          'CAREER OBJECTIVE',
          'OBJECTIVE',
          'PROFESSIONAL SUMMARY',
          'SUMMARY',
        ],
        [
          'WORK EXPERIENCE',
          'PROFESSIONAL EXPERIENCE',
          'EMPLOYMENT HISTORY',
          'EXPERIENCE',
        ],
        [
          'EDUCATION',
          'EDUCATIONAL QUALIFICATION',
          'ACADEMIC QUALIFICATION',
        ],
        [
          'SKILLS',
          'TECHNICAL SKILLS',
          'CORE SKILLS',
        ],
        [
          'PROJECTS',
          'PROJECT EXPERIENCE',
        ],
        [
          'CERTIFICATIONS',
          'CERTIFICATION',
        ],
      ];

      const result =
        hasKeywordGroups(
          resumeGroups,
          4
        );

      console.log(
        'Resume validation:',
        result
      );

      return result;
    }

    // ==================================================
    // 10TH CERTIFICATE
    // ==================================================

    case '10th Certificate': {
      const tenthGroups = [
        [
          'SECONDARY SCHOOL CERTIFICATE',
          'SECONDARY SCHOOL',
          'SECONDARY EDUCATION',
          'SSC',
        ],
        [
          '10TH CLASS',
          '10TH STANDARD',
          'TENTH CLASS',
          'TENTH STANDARD',
          'CLASS X',
          'STANDARD X',
          'X STANDARD',
        ],
        [
          'MATRICULATION',
          'HIGH SCHOOL CERTIFICATE',
        ],
        [
          'BOARD OF SECONDARY EDUCATION',
          'BOARD OF EDUCATION',
          'SECONDARY EDUCATION BOARD',
        ],
        [
          'MARKS',
          'MARKS OBTAINED',
          'MARKSHEET',
          'MARK SHEET',
          'GRADE',
          'PERCENTAGE',
        ],
        [
          'CERTIFICATE',
          'CERTIFIED',
        ],
      ];

      const result =
        hasKeywordGroups(
          tenthGroups,
          3
        );

      console.log(
        '10th Certificate validation:',
        result
      );

      return result;
    }

    // ==================================================
    // 12TH CERTIFICATE
    // ==================================================

    case '12th Certificate': {
      const twelfthGroups = [
        [
          'HIGHER SECONDARY CERTIFICATE',
          'HIGHER SECONDARY',
          'HIGHER SECONDARY EDUCATION',
          'HSC',
        ],
        [
          '12TH CLASS',
          '12TH STANDARD',
          'TWELFTH CLASS',
          'TWELFTH STANDARD',
          'CLASS XII',
          'STANDARD XII',
          'XII STANDARD',
        ],
        [
          'INTERMEDIATE',
          'SENIOR SECONDARY',
          'SENIOR SECONDARY CERTIFICATE',
        ],
        [
          'BOARD OF INTERMEDIATE EDUCATION',
          'BOARD OF SECONDARY EDUCATION',
          'BOARD OF EDUCATION',
        ],
        [
          'MARKS',
          'MARKS OBTAINED',
          'MARKSHEET',
          'MARK SHEET',
          'GRADE',
          'PERCENTAGE',
        ],
        [
          'CERTIFICATE',
          'CERTIFIED',
        ],
      ];

      const result =
        hasKeywordGroups(
          twelfthGroups,
          3
        );

      console.log(
        '12th Certificate validation:',
        result
      );

      return result;
    }

    // ==================================================
    // GRADUATION CERTIFICATE
    // ==================================================

    case 'Graduation Certificate': {
      const graduationGroups = [
        [
          'BACHELOR',
          'BACHELOR OF TECHNOLOGY',
          'BACHELOR OF ENGINEERING',
          'BACHELOR OF SCIENCE',
          'BACHELOR OF COMMERCE',
          'BACHELOR OF ARTS',
          'BACHELOR OF COMPUTER APPLICATIONS',
          'BACHELOR OF BUSINESS ADMINISTRATION',
          'B.TECH',
          'B.E.',
          'B.SC',
          'B.COM',
          'B.A.',
          'BCA',
          'BBA',
        ],
        [
          'DEGREE',
          'GRADUATION',
          'UNDERGRADUATE',
        ],
        [
          'UNIVERSITY',
          'COLLEGE',
          'INSTITUTE',
        ],
        [
          'DEGREE CERTIFICATE',
          'PROVISIONAL CERTIFICATE',
          'CONVOCATION',
          'CERTIFICATE',
        ],
        [
          'AWARDED',
          'CONFERRED',
          'SUCCESSFULLY COMPLETED',
          'COMPLETED',
        ],
      ];

      const result =
        hasKeywordGroups(
          graduationGroups,
          3
        );

      console.log(
        'Graduation Certificate validation:',
        result
      );

      return result;
    }

    // ==================================================
    // POST-GRADUATION CERTIFICATE
    // ==================================================

    case 'Post-Graduation Certificate': {
      const postGraduationGroups = [
        [
          'MASTER',
          'MASTER OF TECHNOLOGY',
          'MASTER OF ENGINEERING',
          'MASTER OF SCIENCE',
          'MASTER OF COMMERCE',
          'MASTER OF ARTS',
          'MASTER OF COMPUTER APPLICATIONS',
          'MASTER OF BUSINESS ADMINISTRATION',
          'M.TECH',
          'M.E.',
          'M.SC',
          'M.COM',
          'M.A.',
          'MCA',
          'MBA',
        ],
        [
          'POST GRADUATION',
          'POSTGRADUATION',
          'POST-GRADUATE',
          'POST GRADUATE',
        ],
        [
          'DEGREE',
          'MASTER DEGREE',
          'POSTGRADUATE DEGREE',
        ],
        [
          'UNIVERSITY',
          'COLLEGE',
          'INSTITUTE',
        ],
        [
          'DEGREE CERTIFICATE',
          'PROVISIONAL CERTIFICATE',
          'CONVOCATION',
          'CERTIFICATE',
        ],
        [
          'AWARDED',
          'CONFERRED',
          'SUCCESSFULLY COMPLETED',
          'COMPLETED',
        ],
      ];

      const result =
        hasKeywordGroups(
          postGraduationGroups,
          3
        );

      console.log(
        'Post-Graduation Certificate validation:',
        result
      );

      return result;
    }

    // ==================================================
    // EXPERIENCE LETTER
    // ==================================================

    case 'Experience Letter': {
      const experienceGroups = [
        [
          'EXPERIENCE LETTER',
          'CERTIFICATE OF EXPERIENCE',
          'EMPLOYMENT CERTIFICATE',
          'EXPERIENCE CERTIFICATE',
        ],
        [
          'WORK EXPERIENCE',
          'EMPLOYED WITH',
          'WORKED WITH',
          'DURING HIS EMPLOYMENT',
          'DURING HER EMPLOYMENT',
          'DURING THE PERIOD OF EMPLOYMENT',
        ],
        [
          'DESIGNATION',
          'POSITION',
          'ROLE',
          'JOB TITLE',
        ],
        [
          'DATE OF JOINING',
          'JOINING DATE',
          'DATE OF COMMENCEMENT',
        ],
        [
          'DATE OF RELIEVING',
          'RELIEVING DATE',
          'LAST WORKING DAY',
          'LAST WORKING DATE',
        ],
        [
          'TENURE',
          'PERIOD',
          'YEARS',
          'MONTHS',
        ],
        [
          'TO WHOMSOEVER IT MAY CONCERN',
          'TO WHOM IT MAY CONCERN',
        ],
      ];

      const result =
        hasKeywordGroups(
          experienceGroups,
          4
        );

      console.log(
        'Experience Letter validation:',
        result
      );

      return result;
    }

    // ==================================================
    // RELIEVING LETTER
    // ==================================================

    case 'Relieving Letter': {
      const relievingGroups = [
        [
          'RELIEVING LETTER',
          'RELIEVING CERTIFICATE',
        ],
        [
          'RELIEVED FROM',
          'RELIEVED OF',
          'RELIEVED FROM SERVICES',
          'RELIEVED',
        ],
        [
          'LAST WORKING DAY',
          'LAST WORKING DATE',
          'DATE OF RELIEVING',
          'RELIEVING DATE',
        ],
        [
          'EMPLOYMENT',
          'EMPLOYED',
          'SERVICES',
          'TENURE',
        ],
        [
          'FULL AND FINAL',
          'NO DUES',
          'HANDOVER',
        ],
        [
          'DESIGNATION',
          'POSITION',
          'ROLE',
        ],
      ];

      const result =
        hasKeywordGroups(
          relievingGroups,
          4
        );

      console.log(
        'Relieving Letter validation:',
        result
      );

      return result;
    }

    // ==================================================
    // OFFER LETTER
    // ==================================================

    case 'Offer Letter': {
      const offerGroups = [
        [
          'OFFER LETTER',
          'LETTER OF OFFER',
          'OFFER OF EMPLOYMENT',
          'EMPLOYMENT OFFER',
        ],
        [
          'EMPLOYMENT',
          'APPOINTMENT',
          'EMPLOYMENT TERMS',
          'TERMS OF EMPLOYMENT',
        ],
        [
          'JOINING DATE',
          'DATE OF JOINING',
          'START DATE',
        ],
        [
          'CTC',
          'COMPENSATION',
          'SALARY',
          'REMUNERATION',
        ],
        [
          'DESIGNATION',
          'POSITION',
          'JOB TITLE',
          'ROLE',
        ],
        [
          'TERMS AND CONDITIONS',
          'TERMS & CONDITIONS',
          'CONDITIONS OF EMPLOYMENT',
        ],
      ];

      const result =
        hasKeywordGroups(
          offerGroups,
          4
        );

      console.log(
        'Offer Letter validation:',
        result
      );

      return result;
    }

    // ==================================================
    // OTHER
    // ==================================================

    case 'Other': {
      /*
       * "Other" is intentionally not tied to one
       * document format.
       *
       * But it still cannot be completely empty.
       *
       * Require enough readable OCR text so that a
       * random/blank image is rejected.
       */

      const meaningfulText =
        normalized.replace(
          /[^A-Z0-9]/g,
          ''
        );

      console.log(
        'Other document meaningful text length:',
        meaningfulText.length
      );

      return meaningfulText.length >= 30;
    }

    // ==================================================
    // UNKNOWN DOCUMENT TYPE
    // ==================================================

    default:
      console.log(
        'Unknown document type:',
        documentType
      );

      return false;
  }
}

// ======================================================
// OCR IMAGE
// ======================================================

async function runOCR(
  imageBuffer: Buffer
): Promise<string> {
  console.log(
    'Starting Tesseract OCR...'
  );

  console.log(
    'Tesseract worker path:',
    TESSERACT_WORKER_PATH
  );

  const worker = await createWorker(
    'eng',
    1,
    {
      workerPath:
        TESSERACT_WORKER_PATH,
    }
  );

  try {
    // ==================================================
    // OCR PASS 1 - NORMAL
    // ==================================================

    await worker.setParameters({tessedit_pageseg_mode: PSM.AUTO,});

    const normalResult = await worker.recognize(imageBuffer);

    const normalText = normalResult.data.text || '';


    console.log(
      'Normal OCR confidence:',
      normalResult.data.confidence
    );

    // ==================================================
    // OCR PASS 2 - SPARSE
    // ==================================================

    await worker.setParameters({
      tessedit_pageseg_mode:
        PSM.SPARSE_TEXT,
    });

    const sparseResult =
      await worker.recognize(
        imageBuffer
      );

    const sparseText =
      sparseResult.data.text || '';

    console.log(
      '========== SPARSE OCR =========='
    );

    console.log(
      sparseText.substring(
        0,
        4000
      )
    );

    console.log(
      'Sparse OCR confidence:',
      sparseResult.data.confidence
    );

    // ==================================================
    // COMBINE OCR
    // ==================================================

    const combinedText = [
      normalText,
      sparseText,
    ]
      .filter(Boolean)
      .join('\n');

    console.log(
      '========== COMBINED OCR =========='
    );

    console.log(
      combinedText.substring(
        0,
        6000
      )
    );

    return combinedText;

  } catch (error) {
    console.error(
      'OCR failed:',
      error
    );

    return '';

  } finally {
    await worker.terminate();
  }
}

// ======================================================
// EXTRACT PDF TEXT
// ======================================================

async function extractTextFromPDF(
  buffer: Buffer
): Promise<string> {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    // ==================================================
    // 1. NORMAL PDF TEXT EXTRACTION
    // ==================================================

    const textResult =
      await parser.getText();

    const extractedText =
      (textResult.text || '')
        .replace(
          /--\s*\d+\s+of\s+\d+\s*--/gi,
          ''
        )
        .trim();

    const meaningfulText =
      extractedText.replace(
        /[^A-Za-z0-9]/g,
        ''
      );

    console.log(
      'PDF raw text:',
      JSON.stringify(
        textResult.text || ''
      )
    );

    console.log(
      'PDF text after removing page markers:',
      JSON.stringify(
        extractedText
      )
    );

    console.log(
      'Meaningful PDF text length:',
      meaningfulText.length
    );

    if (
      meaningfulText.length > 10
    ) {
      console.log(
        'PDF text extraction successful'
      );

      return extractedText;
    }

    console.log(
      'PDF contains no real text. Starting OCR...'
    );

    // ==================================================
    // 2. OCR EMBEDDED IMAGES
    // ==================================================

    let ocrText = '';

    try {
      const imageResult =
        await parser.getImage({
          imageThreshold: 0,
          imageBuffer: true,
          imageDataUrl: false,
        });

      console.log(
        'PDF image pages:',
        imageResult.pages?.length ||
          0
      );

      for (
        const page of
        imageResult.pages || []
      ) {
        console.log(
          `Page ${page.pageNumber}: images =`,
          page.images?.length || 0
        );

        for (
          const image of
          page.images || []
        ) {
          if (!image.data) {
            continue;
          }

          console.log(
            `Running OCR on embedded image from page ${page.pageNumber}`
          );

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
        }
      }

    } catch (imageError) {
      console.error(
        'Embedded image extraction failed:',
        imageError
      );
    }

    // ==================================================
    // 3. RENDER PDF AND OCR
    // ==================================================

    if (!ocrText.trim()) {
      console.log(
        'Embedded image OCR returned no text.'
      );

      console.log(
        'Rendering PDF pages for OCR...'
      );

      try {
        const screenshotResult =
          await parser.getScreenshot({
            first: 3,
            desiredWidth: 3000,
            imageBuffer: true,
            imageDataUrl: false,
          });

        console.log(
          'Screenshot pages:',
          screenshotResult.pages
            ?.length || 0
        );

        for (
          const page of
          screenshotResult.pages || []
        ) {
          if (!page.data) {
            continue;
          }

          console.log(
            `Running OCR on rendered page ${page.pageNumber}`
          );

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
        }

      } catch (screenshotError) {
        console.error(
          'PDF screenshot OCR failed:',
          screenshotError
        );
      }
    }

    console.log(
      'Final OCR text:',
      JSON.stringify(
        ocrText.substring(
          0,
          2000
        )
      )
    );

    return ocrText.trim();

  } finally {
    await parser.destroy();
  }
}

// ======================================================
// POST
// ======================================================

export async function POST(
  request: Request
) {
  let uploadResult: any = null;

  try {
    // ==================================================
    // FORM DATA
    // ==================================================

    const formData =
      await request.formData();

    const file =
      formData.get(
        'file'
      ) as File;

    const employee_id =
      formData.get(
        'employee_id'
      ) as string;

    const document_type =
      formData.get(
        'document_type'
      ) as string;

    const document_name =
      formData.get(
        'document_name'
      ) as string;

    // ==================================================
    // REQUIRED FIELDS
    // ==================================================

    if (
      !file ||
      !employee_id ||
      !document_type ||
      !document_name?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            'File, employee, document type, and document name are required',
        },
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // FILE SIZE
    // ==================================================

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            'File size exceeds 5MB limit',
        },
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // FILE TYPE
    // ==================================================

    if (
      !ALLOWED_FILE_TYPES.includes(
        file.type
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG file.',
        },
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // EXTRACT TEXT + OCR
    // ==================================================

    let extractedText = '';

    let identityNumber:
      string | null = null;

    let fileBuffer: Buffer;

    try {
      fileBuffer =
        Buffer.from(
          await file.arrayBuffer()
        );

      const isPDF =
        file.type ===
          'application/pdf' ||
        file.name
          .toLowerCase()
          .endsWith('.pdf');

      if (isPDF) {
        // PDF:
        //
        // 1. Normal PDF text
        // 2. Embedded images
        // 3. Rendered page OCR

        extractedText =
          await extractTextFromPDF(
            fileBuffer
          );

      } else {
        // JPG / PNG
        //
        // Direct OCR

        extractedText =
          await runOCR(
            fileBuffer
          );
      }

      console.log(
        `Extracted text for ${document_type}:`,
        extractedText.substring(
          0,
          3000
        )
      );

    } catch (
      extractionError
    ) {
      console.error(
        'Document text extraction error:',
        extractionError
      );

      return NextResponse.json(
        {
          error:
            `Could not read the uploaded ${document_type}. Please upload a clear PDF or image.`,
        },
        {
          status: 422,
        }
      );
    }

    // ==================================================
    // DOCUMENT TYPE VALIDATION
    // ==================================================

    const isDocumentMatching =
      validateDocumentType(
        document_type,
        extractedText
      );

    console.log(
      `Document validation: ${document_type} = ${isDocumentMatching}`
    );

    if (
      !isDocumentMatching
    ) {
      return NextResponse.json(
        {
          error:
            `Invalid document. The uploaded file does not appear to be a ${document_type}. Please upload the correct document.`,
        },
        {
          status: 422,
        }
      );
    }

    // ==================================================
    // ID DOCUMENT NUMBER
    // ==================================================

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

      if (!identityNumber) {
        return NextResponse.json(
          {
            error:
              `Could not find a valid ${document_type} number in the uploaded document.`,
          },
          {
            status: 422,
          }
        );
      }

      console.log(
        `${document_type} detected:`,
        identityNumber
      );
    }

    // ==================================================
    // SUPABASE
    // ==================================================

    const supabase =
      await createClient();

    const allowsMultiple =
      MULTIPLE_DOCUMENT_TYPES.includes(
        document_type
      );

    // ==================================================
    // FIND EXISTING DOCUMENT
    // ==================================================

    let existingDocument:
      any = null;

    if (!allowsMultiple) {
      const {
        data,
        error:
          existingError,
      } = await supabase
        .from(
          'employee_documents'
        )
        .select('*')
        .eq(
          'employee_id',
          employee_id
        )
        .eq(
          'document_type',
          document_type
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          'Error checking existing document:',
          existingError
        );

        return NextResponse.json(
          {
            error:
              `Could not check existing document: ${existingError.message}`,
          },
          {
            status: 500,
          }
        );
      }

      existingDocument =
        data;
    }

    // ==================================================
    // CLOUDINARY RESOURCE TYPE
    // ==================================================

    const cloudinaryResourceType =
      file.type ===
      'application/pdf'
        ? 'raw'
        : 'image';

    // ==================================================
    // CLOUDINARY DATA URI
    // ==================================================

    const base64Data =
      fileBuffer.toString(
        'base64'
      );

    const dataURI =
      `data:${file.type};base64,${base64Data}`;

    // ==================================================
    // CLOUDINARY UPLOAD
    // ==================================================

    uploadResult =
      await new Promise<any>(
        (
          resolve,
          reject
        ) => {
          cloudinary.uploader.upload(
            dataURI,
            {
              folder:
                'teens-hr/documents',

              resource_type:
                cloudinaryResourceType,
            },
            (
              error,
              result
            ) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
        }
      );

    // ==================================================
    // IDENTITY DATABASE FIELDS
    // ==================================================

    const identityFields = {
      aadhaar_number:
        document_type ===
        'Aadhar Card'
          ? identityNumber
          : null,

      pan_number:
        document_type ===
        'PAN Card'
          ? identityNumber
          : null,

      passport_number:
        document_type ===
        'Passport'
          ? identityNumber
          : null,
    };

    // ==================================================
    // REPLACE EXISTING DOCUMENT
    // ==================================================

    if (
      existingDocument
    ) {
      const {
        data:
          updatedDocument,
        error:
          updateError,
      } = await supabase
        .from(
          'employee_documents'
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
          'id',
          existingDocument.id
        )
        .select()
        .single();

      // ==================================================
      // UPDATE FAILED
      // ==================================================

      if (updateError) {
        console.error(
          'Error updating document record:',
          updateError
        );

        try {
          await cloudinary.uploader.destroy(
            uploadResult.public_id,
            {
              resource_type:
                uploadResult.resource_type,
            }
          );
        } catch (
          cleanupError
        ) {
          console.error(
            'Cloudinary cleanup error:',
            cleanupError
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

      // ==================================================
      // DELETE OLD CLOUDINARY FILE
      // ==================================================

      if (
        existingDocument.cloudinary_public_id
      ) {
        try {
          await cloudinary.uploader.destroy(
            existingDocument.cloudinary_public_id,
            {
              resource_type:
                existingDocument.cloudinary_resource_type ||
                'raw',
            }
          );
        } catch (
          cloudinaryError
        ) {
          console.error(
            'Error deleting old Cloudinary file:',
            cloudinaryError
          );
        }
      }

      // ==================================================
      // REVALIDATE
      // ==================================================

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

        replaced:
          true,
      });
    }

    // ==================================================
    // INSERT NEW DOCUMENT
    // ==================================================

    const {
      data:
        documentRecord,
      error:
        insertError,
    } = await supabase
      .from(
        'employee_documents'
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

    // ==================================================
    // INSERT FAILED
    // ==================================================

    if (insertError) {
      console.error(
        'Error saving document record:',
        insertError
      );

      try {
        await cloudinary.uploader.destroy(
          uploadResult.public_id,
          {
            resource_type:
              uploadResult.resource_type,
          }
        );
      } catch (
        cleanupError
      ) {
        console.error(
          'Cloudinary cleanup error:',
          cleanupError
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

    // ==================================================
    // SUCCESS
    // ==================================================

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

      replaced:
        false,
    });

  } catch (
    error: any
  ) {
    console.error(
      'Upload error:',
      error
    );

    // ==================================================
    // FINAL CLOUDINARY CLEANUP
    // ==================================================

    if (
      uploadResult?.public_id
    ) {
      try {
        await cloudinary.uploader.destroy(
          uploadResult.public_id,
          {
            resource_type:
              uploadResult.resource_type ||
              'raw',
          }
        );
      } catch (
        cleanupError
      ) {
        console.error(
          'Final Cloudinary cleanup error:',
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          'An error occurred during file upload',
      },
      {
        status: 500,
      }
    );
  }
}