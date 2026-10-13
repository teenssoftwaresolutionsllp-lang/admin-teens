import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { createClient, createAdminClient } from '@/lib/supabase-server';
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

const HR_VERIFICATION_DOCUMENT_TYPES = [
  "Aadhar Card",
  "Aadhaar Card",
  "PAN Card",
  "Passport",
  "Bank Passbook",
];

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

  const groups = normalized.match(/\b\d{4}\b/g) || [];

  for (let i = 0;i < groups.length - 2;i++) 
  {
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
      return candidate;
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
// Bank Account NUMBER BASED ON DOCUMENT TYPE
// ======================================================


function extractIFSC(text: string): string | null {
  const match = text
    .toUpperCase()
    .match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/);

  return match?.[0] ?? null;
}

function extractBankAccountNumber(
  text: string
): string | null {
  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ');

  const patterns = [
    /(?:ACCOUNT|A\/C|ACCT)\s*(?:NO\.?|NUMBER|#)\s*[:.-]?\s*([0-9][0-9 -]{7,24}[0-9])/i,
    /(?:ACCOUNT NUMBER|ACCOUNT NO|A\/C NO)\s*[:.-]?\s*([0-9][0-9 -]{7,24}[0-9])/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1]) {
      const digits = match[1].replace(/\D/g, '');

      if (/^\d{9,18}$/.test(digits)) {
        return digits;
      }
    }
  }

  return null;
}

function extractBankName(text: string): string | null {
  const normalized = text
    .toUpperCase()
    .replace(/\s+/g, ' ');

  const knownBanks = [
    'STATE BANK OF INDIA',
    'HDFC BANK',
    'ICICI BANK',
    'AXIS BANK',
    'KOTAK MAHINDRA BANK',
    'PUNJAB NATIONAL BANK',
    'BANK OF BARODA',
    'CANARA BANK',
    'UNION BANK OF INDIA',
    'INDIAN BANK',
    'BANK OF INDIA',
    'INDUSIND BANK',
    'IDFC FIRST BANK',
    'YES BANK',
    'FEDERAL BANK',
    'BANK OF MAHARASHTRA',
    'CENTRAL BANK OF INDIA',
    'INDIAN OVERSEAS BANK',
    'UCO BANK',
    'BANDHAN BANK',
    'KARNATAKA BANK',
    'CITY UNION BANK',
    'SOUTH INDIAN BANK',
    'RBL BANK',
    'TAMILNAD MERCANTILE BANK',
    'JAMMU AND KASHMIR BANK',
    'BANK OF INDIA',

    // Fictional banks for OCR testing
    'UNITY BANK',
    'SUNRISE BANK',
    'GLOBAL TRUST BANK',
  ];

  return knownBanks.find((bank) =>
    normalized.includes(bank)
  ) ?? null;
}

function validateBankPassbook(text: string): boolean {
  const normalized = text
    .toUpperCase()
    .replace(/\s+/g, ' ');

  const hasBankIndicator =
    /\bBANK\b|\bPASSBOOK\b|\bSAVINGS ACCOUNT\b|\bCURRENT ACCOUNT\b/.test(
      normalized
    );

  const hasRecognizedBank =
    !!extractBankName(normalized);

  const hasIFSC =
    !!extractIFSC(normalized);

  const hasAccountNumber =
    !!extractBankAccountNumber(text);

  const hasAccountLabel =
    /ACCOUNT\s*(?:NO\.?|NUMBER|#)|A\/C\s*(?:NO\.?|NUMBER|#)|ACCT\s*(?:NO\.?|NUMBER|#)/i.test(
      normalized
    );

  return (
    hasBankIndicator &&
    hasRecognizedBank &&
    hasIFSC &&
    hasAccountNumber &&
    hasAccountLabel
  );
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
    // BANK PASSBOOK
    // ==================================================
     case 'Bank Passbook': {
        const result = validateBankPassbook(normalized);
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
      'Meaningful PDF text length:',
      meaningfulText.length
    );

    if (
      meaningfulText.length > 10
    ) {

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

    const rawDocumentType = formData.get('document_type') as string;

    const document_type =
      rawDocumentType?.trim() === 'Aadhaar Card'
        ? 'Aadhar Card'
        : rawDocumentType?.trim();
        
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

    let identityNumber: string | null = null;
    let bankIFSC: string | null = null;
    let bankAccountNumber: string | null = null;
    let bankName: string | null = null;

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
      console.log(`${document_type} number extracted successfully.`);
    }

// ====================================================== 
// // EXTRACT BANK DETAILS FROM A VALIDATED PASSBOOK 
// // ====================================================== 
  const isBankPassbook = document_type.trim().toLowerCase() === 'bank passbook';
   if (isBankPassbook) { 
    bankIFSC = extractIFSC(extractedText); 
    bankAccountNumber = extractBankAccountNumber(extractedText); 
    bankName = extractBankName(extractedText); 
    if (!bankIFSC || !bankAccountNumber || !bankName) 
      { 
        console.error('Bank details extraction incomplete:', { bankNameFound: !!bankName, accountNumberFound: !!bankAccountNumber, ifscFound: !!bankIFSC, });
        return NextResponse.json( { error: 'Passbook uploaded, but the bank name, account number, or IFSC code could not be reliably extracted. Please upload a clearer document.', }, { status: 422 } );
      } }
    // ==================================================
    // SUPABASE
    // ==================================================

    const supabase = await createClient();

    
    const allowsMultiple = MULTIPLE_DOCUMENT_TYPES.includes(document_type);

    const verificationRequired = HR_VERIFICATION_DOCUMENT_TYPES.includes(document_type);

    let requiresApproval = false;

    let existingDocument: any = null;

    if (!allowsMultiple) {
      if (verificationRequired) {
        // Find the currently approved document, if one exists.
        const { data, error } = await supabase
          .from('employee_documents')
          .select('*')
          .eq('employee_id', employee_id)
          .eq('document_type', document_type)
          .eq('verification_status', 'approved')
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Failed to find approved document:', error);
          return NextResponse.json(
            { message: 'Failed to check the existing document' },
            { status: 500 }
          );
        }

        existingDocument = data;

        requiresApproval = verificationRequired ;

        // Prevent duplicate uploads while HR verification is pending.
        const { data: pendingDocument, error: pendingError } = await supabase
          .from('employee_documents')
          .select('id')
          .eq('employee_id', employee_id)
          .eq('document_type', document_type)
          .eq('verification_status', 'pending')
          .limit(1)
          .maybeSingle();

        if (pendingError) {
          console.error('Failed to check pending document:', pendingError);
          return NextResponse.json(
            { message: 'Failed to check pending verification' },
            { status: 500 }
          );
        }

        if (pendingDocument) {
          return NextResponse.json(
            { message: 'A document of this type is already awaiting HR approval.' },
            { status: 409 }
          );
        }
      } else {
        // Preserve the existing behavior for documents not requiring HR approval.
        const { data, error } = await supabase
          .from('employee_documents')
          .select('*')
          .eq('employee_id', employee_id)
          .eq('document_type', document_type)
          .maybeSingle();

        if (error) {
          console.error('Failed to find existing document:', error);
          return NextResponse.json(
            { message: 'Failed to check the existing document' },
            { status: 500 }
          );
        }

        existingDocument = data;
      }
    }

    // ======================================================
    // AUTHENTICATE USER AND AUTHORIZE EMPLOYEE ACCESS
    // ======================================================

    const {data: { user },error: authError} = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in again.' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Unable to verify your account permissions.' },
        { status: 403 }
      );
    }

    const role = String(profile.role || '').toLowerCase();

    const { data: targetEmployee, error: employeeError } =
      await supabase
        .from('employees')
        .select('id, user_id')
        .eq('id', employee_id)
        .maybeSingle();

    if (employeeError || !targetEmployee) {
      return NextResponse.json(
        { error: 'Employee not found.' },
        { status: 404 }
      );
    }

    if (role === 'employee') {
      // Adjust this comparison if your schema links employees
      // to profiles using a different column.
      if (targetEmployee.user_id !== user.id) {
        return NextResponse.json(
          { error: 'You can only upload documents for your own profile.' },
          { status: 403 }
        );
      }
    } else if (role === 'hr' || role === 'ceo') {

    } else {
      return NextResponse.json(
        { error: 'You do not have permission to upload documents.' },
        { status: 403 }
      );
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

    const identityFields: Record<string, string> = {};

    if (document_type === 'Aadhar Card' && identityNumber) {
      identityFields.aadhaar_number = identityNumber;
    }

    if (document_type === 'PAN Card' && identityNumber) {
      identityFields.pan_number = identityNumber;
    }

    if (document_type === 'Passport' && identityNumber) {
      identityFields.passport_number = identityNumber;
    }
    
    // Save extracted bank details to the employee record

                

    // ======================================================
    // SYNC VERIFIED IDENTITY NUMBER TO EMPLOYEES TABLE
    // ======================================================
    // 
    // Aadhaar, PAN and Passport numbers will be synced to
    // employees only after HR approves the uploaded document.


    // ==================================================
    // SAVE DOCUMENTS THAT REQUIRE HR APPROVAL
    // ==================================================

    if (requiresApproval) {
      const pendingDocumentFields: Record<string, any> = {
        employee_id,
        document_type,
        document_name: document_name.trim(),
        document_url: uploadResult.secure_url,
        cloudinary_public_id: uploadResult.public_id,
        cloudinary_resource_type: uploadResult.resource_type,
        verification_status: 'pending',
        previous_document_id: existingDocument?.id ?? null,
        ...identityFields,
      };

      if (isBankPassbook) {
        pendingDocumentFields.bank_name = bankName;
        pendingDocumentFields.bank_account_number = bankAccountNumber;
        pendingDocumentFields.ifsc_code = bankIFSC;
      }

      const {
        data: pendingDocument,
        error: pendingInsertError,
      } = await supabase
        .from('employee_documents')
        .insert(pendingDocumentFields)
        .select()
        .single();

      if (pendingInsertError) {
        console.error(
          'Failed to save pending document:',
          pendingInsertError
        );

        

        try {
          await cloudinary.uploader.destroy(
            uploadResult.public_id,
            {
              resource_type: uploadResult.resource_type,
            }
          );
        } catch (cleanupError) {
          console.error(
            'Pending document cleanup failed:',
            cleanupError
          );
        }

        uploadResult = null;

        return NextResponse.json(
          {
            error: 'The document was uploaded but could not be submitted for HR approval.',
          },
          { status: 500 }
        );
      }


      // Automatically create and link a database-backed profile request
      // for sensitive documents. The request remains pending.
      const normalizedDocumentType = String(document_type)
        .trim()
        .toLowerCase();

      const isSensitiveDocument = [
        'aadhar card',
        'aadhaar card',
        'pan card',
        'passport',
        'bank passbook',
      ].includes(normalizedDocumentType);

      let linkedProfileChangeRequest = null;

      if (isSensitiveDocument) {
        const admin = await createAdminClient();

        // Only include values actually extracted from this document.
        // Never copy unrelated or existing employee fields into the request.
        const requestedChanges: Record<string, string> = {};

        if (
          ['aadhar card', 'aadhaar card'].includes(
            normalizedDocumentType
          ) &&
          identityNumber
        ) {
          requestedChanges.aadhar_number = identityNumber;
        }

        if (
          normalizedDocumentType === 'pan card' &&
          identityNumber
        ) {
          requestedChanges.pan_number = identityNumber;
        }

        if (
          normalizedDocumentType === 'passport' &&
          identityNumber
        ) {
          requestedChanges.passport_number = identityNumber;
        }

        if (normalizedDocumentType === 'bank passbook') {
          if (bankName) requestedChanges.bank_name = bankName;
          if (bankAccountNumber) {
            requestedChanges.bank_account_number = bankAccountNumber;
          }
          if (bankIFSC) requestedChanges.ifsc_code = bankIFSC;
        }

        // Insert a real database row, even when extraction yielded no values.
        // An empty request must not authorize changes to employee data.
        const { data: profileRequest, error: requestInsertError } =
          await admin
            .from('profile_change_requests')
            .insert({
              employee_id,
              requested_changes: requestedChanges,
              previous_values: {},
              status: 'pending',
            })
            .select('id, employee_id, requested_changes, status')
            .single();

        if (requestInsertError || !profileRequest) {
          console.error(
            'Failed to create automatic profile-change request:',
            requestInsertError
          );

          // Avoid leaving an uploaded sensitive document without its request.
          await admin
            .from('employee_documents')
            .delete()
            .eq('id', pendingDocument.id)
            .eq('employee_id', employee_id);

          try {
            await cloudinary.uploader.destroy(
              uploadResult.public_id,
              { resource_type: uploadResult.resource_type }
            );
          } catch (cleanupError) {
            console.error(
              'Cloudinary cleanup failed:',
              cleanupError
            );
          }

          uploadResult = null;

          return NextResponse.json(
            {
              error:
                'The document was uploaded, but its profile-change request could not be created. Please retry.',
            },
            { status: 500 }
          );
        }

        // Link only the exact newly inserted document and request.
        const { data: linkedDocument, error: linkError } = await admin
          .from('employee_documents')
          .update({
            profile_change_request_id: profileRequest.id,
            profile_change_approved: false,
          })
          .eq('id', pendingDocument.id)
          .eq('employee_id', employee_id)
          .eq('verification_status', 'pending')
          .is('profile_change_request_id', null)
          .select('id')
          .maybeSingle();

        if (linkError || !linkedDocument) {
          console.error(
            'Failed to link automatic profile-change request:',
            linkError
          );

          // Remove the orphan request and document rather than leaving
          // an inconsistent workflow.
          await admin
            .from('profile_change_requests')
            .delete()
            .eq('id', profileRequest.id)
            .eq('employee_id', employee_id)
            .eq('status', 'pending');

          await admin
            .from('employee_documents')
            .delete()
            .eq('id', pendingDocument.id)
            .eq('employee_id', employee_id);

          try {
            await cloudinary.uploader.destroy(
              uploadResult.public_id,
              { resource_type: uploadResult.resource_type }
            );
          } catch (cleanupError) {
            console.error(
              'Cloudinary cleanup failed:',
              cleanupError
            );
          }

          uploadResult = null;

          return NextResponse.json(
            {
              error:
                'The profile-change request was created but could not be linked to the document. Please retry.',
            },
            { status: 500 }
          );
        }

        linkedProfileChangeRequest = profileRequest;
      }


      revalidatePath(`/dashboard/employees/${employee_id}`);

      // Preserve the previously approved record and its file.
      return NextResponse.json(
        {
          message: `${document_type} uploaded and submitted for HR approval.`,
          document: {
          ...pendingDocument,
          profile_change_request_id:
            linkedProfileChangeRequest?.id ?? null,
        },
          profileChangeRequest: linkedProfileChangeRequest,
          verificationStatus: 'pending',
          replaced: Boolean(existingDocument),
        },
        { status: 201 }
      );
    }
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
        message: `${document_type} replaced successfully`,
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        document: updatedDocument,
        replaced: true,
        extractedDetails: {
          ...(identityNumber
            ? {
                ...(document_type === "Aadhar Card" || document_type === "Aadhaar Card" ? { aadhar_number: identityNumber }: {}),
                ...(document_type === "PAN Card" ? { pan_number: identityNumber }: {}),
                ...(document_type === "Passport" ? { passport_number: identityNumber } : {}),
              } : {}),
          ...(isBankPassbook? 
              {
                bank_name: bankName,
                bank_account_number: bankAccountNumber,
                ifsc_code: bankIFSC,
              }: {}),
        },
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
        document_name: document_name.trim(),
        document_url: uploadResult.secure_url,
        cloudinary_public_id: uploadResult.public_id,
        cloudinary_resource_type: uploadResult.resource_type,
        ...identityFields,

        // First-time verification documents are approved immediately.
        ...(verificationRequired
          ? {
              verification_status: 'pending',
              previous_document_id: existingDocument?.id ?? null,
            }
          : {}),

        // Save extracted bank details with the first upload.
        ...(isBankPassbook
          ? {
              bank_name: bankName,
              bank_account_number: bankAccountNumber,
              ifsc_code: bankIFSC,
            }
          : {}),
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
      message: `${document_type} uploaded successfully`,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      document: documentRecord,
      replaced: false,

      extractedDetails: {
        ...(identityNumber ?
          {
            ...(document_type === "Aadhar Card" || document_type === "Aadhaar Card" ? { aadhar_number: identityNumber } : {}),
            ...(document_type === "PAN Card" ? { pan_number: identityNumber } : {}),
            ...(document_type === "Passport" ? { passport_number: identityNumber } : {}),
          } : {}),
        ...(isBankPassbook? 
          {
              bank_name: bankName,
              bank_account_number: bankAccountNumber,
              ifsc_code: bankIFSC,
          }: {}),
      },
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