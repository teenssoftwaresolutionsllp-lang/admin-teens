import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getPath } from 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

PDFParse.setWorker(getPath());



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


cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

// --------------------------------------------------
// EXTRACT AADHAAR NUMBER
// --------------------------------------------------

function extractAadhaar(text: string): string | null {
  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  // Look for Aadhaar-related text first
  const contextMatch = normalized.match(
    /(?:aadhaar|aadhar|uid|unique identification)[\s:#-]*(\d{4}[\s-]?\d{4}[\s-]?\d{4})/i
  );

  if (contextMatch?.[1]) {
    const digits = contextMatch[1].replace(/\D/g, '');

    if (digits.length === 12) {
      return digits;
    }
  }

  // Fallback: find 12 digit number
  const matches = normalized.match(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
  );

  if (matches) {
    for (const match of matches) {
      const digits = match.replace(/\D/g, '');

      if (digits.length === 12) {
        return digits;
      }
    }
  }

  return null;
}

// --------------------------------------------------
// EXTRACT PAN NUMBER
// --------------------------------------------------

function extractPAN(text: string): string | null {
  const normalized = text
    .toUpperCase()
    .replace(/\r/g, '\n');

  // PAN near "PAN" / "Permanent Account Number"
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

  // Normal PAN format
  const match = normalized.match(
    /\b[A-Z]{5}[\s-]?\d{4}[\s-]?[A-Z]\b/g
  );

  if (match) {
    for (const value of match) {
      const pan = value
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase();

      if (/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
        return pan;
      }
    }
  }

  // OCR sometimes inserts spaces between individual characters
  const compact = normalized.replace(/[^A-Z0-9]/g, '');

  const compactMatch = compact.match(
    /[A-Z]{5}\d{4}[A-Z]/
  );

  if (compactMatch) {
    return compactMatch[0];
  }

  return null;
}

// --------------------------------------------------
// EXTRACT PASSPORT NUMBER
// --------------------------------------------------

function extractPassport(text: string): string | null {
  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .toUpperCase()
    .trim();

  // Indian passport format: A1234567
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

  // Fallback
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

  return null;
}

// --------------------------------------------------
// EXTRACT NUMBER BASED ON DOCUMENT TYPE
// --------------------------------------------------

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

// --------------------------------------------------
// DOCUMENT TYPE VALIDATION
// --------------------------------------------------

function validateDocumentType(
  documentType: string,
  text: string
): boolean {
  const normalized = text
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return false;
  }

  const hasMultipleKeywords = (
    keywords: string[],
    minimumMatches = 2
  ) => {
    const matches = keywords.filter((keyword) =>
      normalized.includes(keyword)
    );

    console.log(
      `${documentType} keyword matches:`,
      matches
    );

    return matches.length >= minimumMatches;
  };

  switch (documentType) {
    case 'Aadhar Card': {
      return !!extractAadhaar(normalized);
    }

    case 'PAN Card': {
      return !!extractPAN(normalized);
    }

    case 'Passport': {
      const passportNumber =extractPassport(normalized);
      const hasPassportKeyword =
        normalized.includes('PASSPORT') ||
        normalized.includes('REPUBLIC OF INDIA') ||
        normalized.includes('SURNAME') ||
        normalized.includes('GIVEN NAME') ||
        normalized.includes('NATIONALITY');

      return !!passportNumber && hasPassportKeyword;
    }

    case 'Resume': {
      const keywords = [
        'RESUME',
        'CURRICULUM VITAE',
        'WORK EXPERIENCE',
        'PROFESSIONAL EXPERIENCE',
        'EDUCATION',
        'SKILLS',
      ];

      return hasMultipleKeywords(keywords, 2);
    }

    case '10th Certificate': {
      const keywords = [
        'SECONDARY SCHOOL',
        'SECONDARY SCHOOL CERTIFICATE',
        'SSC',
        '10TH CLASS',
        '10TH STANDARD',
        'MATRICULATION',
      ];

      return hasMultipleKeywords(keywords, 2);
    }

    case '12th Certificate': {
      const keywords = [
        'HIGHER SECONDARY',
        'HIGHER SECONDARY CERTIFICATE',
        'HSC',
        '12TH CLASS',
        '12TH STANDARD',
        'INTERMEDIATE',
      ];

      return hasMultipleKeywords(keywords, 2);
    }

    case 'Graduation Certificate': {
      const keywords = [
        'BACHELOR',
        'BACHELOR OF TECHNOLOGY',
        'BACHELOR OF ENGINEERING',
        'BACHELOR OF SCIENCE',
        'BACHELOR OF COMMERCE',
        'BACHELOR OF COMPUTER APPLICATIONS',
        'DEGREE',
        'GRADUATION',
        'UNIVERSITY',
      ];

      return hasMultipleKeywords(keywords, 2);
    }

    case 'Post-Graduation Certificate': {
      const keywords = [
        'MASTER',
        'MASTER OF TECHNOLOGY',
        'MASTER OF ENGINEERING',
        'MASTER OF SCIENCE',
        'MASTER OF COMPUTER APPLICATIONS',
        'MASTER OF BUSINESS ADMINISTRATION',
        'POST GRADUATION',
        'POSTGRADUATION',
        'POST-GRADUATE',
      ];

      return hasMultipleKeywords(keywords, 2);
    }

    case 'Experience Letter': {
      const keywords = [
        'EXPERIENCE LETTER',
        'WORK EXPERIENCE',
        'EMPLOYMENT CERTIFICATE',
        'TO WHOMSOEVER IT MAY CONCERN',
        'EMPLOYED WITH',
      ];

      return hasMultipleKeywords(keywords, 2);
    }

    case 'Relieving Letter': {
      const keywords = [
        'RELIEVING LETTER',
        'RELIEVED FROM',
        'RELIEVING DATE',
        'RELIEVED OF HIS',
        'RELIEVED OF HER',
      ];

      return hasMultipleKeywords(keywords, 2);
    }

    case 'Offer Letter': {
      const keywords = [
        'OFFER LETTER',
        'LETTER OF OFFER',
        'EMPLOYMENT OFFER',
        'OFFER OF EMPLOYMENT',
        'JOINING DATE',
        'CTC',
        'COMPENSATION',
      ];

      return hasMultipleKeywords(keywords, 2);
    }

    case 'Other':
      return true;

    default:
      return false;
  }
}

// --------------------------------------------------
// OCR IMAGE
// --------------------------------------------------

async function runOCR(
  imageBuffer: Buffer
): Promise<string> {
  console.log("Starting Tesseract OCR...");

  console.log(
    "Tesseract worker path:",
    TESSERACT_WORKER_PATH
  );

  const worker = await createWorker(
    "eng",
    1,
    {
      workerPath: TESSERACT_WORKER_PATH,
    }
  );

  try {
    const result = await worker.recognize(
      imageBuffer
    );

    const text = result.data.text || "";

    console.log(
      "OCR RESULT:",
      JSON.stringify(
        text.substring(0, 2000)
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
    await worker.terminate();
  }
}

// --------------------------------------------------
// EXTRACT PDF TEXT
// --------------------------------------------------

async function extractTextFromPDF(
  buffer: Buffer
): Promise<string> {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    // --------------------------------------------------
    // 1. Try normal PDF text extraction
    // --------------------------------------------------
    const textResult = await parser.getText();

    // Remove pdf-parse page markers like:
    // -- 1 of 2 --
    // -- 2 of 2 --
    const extractedText = (textResult.text || "")
  .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
  .trim();

  const meaningfulText = extractedText
    .replace(/[^A-Za-z0-9]/g, "");

  console.log(
    "PDF raw text:",
    JSON.stringify(textResult.text || "")
  );

  console.log(
    "PDF text after removing page markers:",
    JSON.stringify(extractedText)
  );

  console.log(
    "Meaningful PDF text length:",
    meaningfulText.length
  );

  if (meaningfulText.length > 10) {
    console.log("PDF text extraction successful");

    return extractedText;
  }

  console.log(
    "PDF contains no real text. Starting OCR..."
  );


  // --------------------------------------------------
  // 2. Try extracting embedded images
  // --------------------------------------------------
  let ocrText = "";

  try {
    const imageResult = await parser.getImage({
      imageThreshold: 0,
      imageBuffer: true,
      imageDataUrl: false,
    });

    console.log("PDF image pages:",imageResult.pages?.length || 0);

    for (const page of imageResult.pages || []) {
      console.log(`Page ${page.pageNumber}: images =`,page.images?.length || 0);
      for (const image of page.images || []) {
        if (!image.data) continue;
          console.log(`Running OCR on embedded image from page ${page.pageNumber}`);
          const pageText = await runOCR(Buffer.from(image.data));
          if (pageText.trim()) {
            ocrText += `\n${pageText}`;
          }
      }
    }
  } catch (imageError) {
      console.error(
        "Embedded image extraction failed:",
        imageError
      );
    }

    // --------------------------------------------------
    // 3. If embedded images didn't work,
    //    render PDF pages and OCR them
    // --------------------------------------------------
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
          screenshotResult.pages?.length || 0
        );

        for (const page of screenshotResult.pages || []) {
          if (!page.data) continue;

          console.log(
            `Running OCR on rendered page ${page.pageNumber}`
          );

          const pageText = await runOCR(
            Buffer.from(page.data)
          );

          if (pageText.trim()) {
            ocrText += `\n${pageText}`;
          }
        }
      } catch (screenshotError) {
        console.error(
          "PDF screenshot OCR failed:",
          screenshotError
        );
      }
    }

    console.log(
      "Final OCR text:",
      JSON.stringify(ocrText.substring(0, 2000))
    );

    return ocrText.trim();

  } finally {
    await parser.destroy();
  }
}



export async function POST(request: Request) {
  let uploadResult: any = null;

  try {
    const formData =await request.formData();

    const file = formData.get('file') as File;
    const employee_id = formData.get('employee_id') as string;
    const document_type = formData.get('document_type') as string;
    const document_name = formData.get('document_name') as string;

    if (
      !file ||
      !employee_id ||
      !document_type ||
      !document_name?.trim()
    ) {
      return NextResponse.json(
        {
          error:'File, employee, document type, and document name are required',
        },
        { status: 400 }
      );
    }

    if (
      file.size > MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            'File size exceeds 5MB limit',
        },
        { status: 400 }
      );
    }


    // --------------------------------------------------
    // EXTRACT TEXT + VALIDATE DOCUMENT TYPE
    // BEFORE CLOUDINARY UPLOAD
    // --------------------------------------------------

    let extractedText = '';
    let identityNumber: string | null = null;
    let fileBuffer: Buffer;

    try {
      fileBuffer = Buffer.from(await file.arrayBuffer());

      const isPDF =file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPDF) {
        // PDF:
        // 1. pdf-parse extracts normal PDF text
        // 2. Tesseract OCR is used automatically
        extractedText = await extractTextFromPDF(fileBuffer);
      } else {
        // PNG/JPG:
        // Directly use Tesseract OCR
        extractedText = await runOCR(fileBuffer);
      }

      console.log(`Extracted text for ${document_type}:`,extractedText.substring(0, 2000));

    } catch (extractionError) {
      console.error('Document text extraction error:',extractionError);

      return NextResponse.json(
        {
          error:`Could not read the uploaded ${document_type}. Please upload a clear PDF or image.`,
        },
        { status: 422 }
      );
    }

    // --------------------------------------------------
    // VALIDATE ACTUAL DOCUMENT CONTENT
    // --------------------------------------------------

    const isDocumentMatching =
      validateDocumentType(
        document_type,
        extractedText
      );

    console.log(
      `Document validation: ${document_type} = ${isDocumentMatching}`
    );

    if (!isDocumentMatching) {
      return NextResponse.json(
        {
          error:
            `Invalid document. The uploaded file does not appear to be a ${document_type}. Please upload the correct document.`,
        },
        { status: 422 }
      );
    }

    // --------------------------------------------------
    // EXTRACT ID NUMBER AFTER DOCUMENT TYPE MATCHES
    // --------------------------------------------------

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
          { status: 422 }
        );
      }

      console.log(
        `${document_type} detected:`,
        identityNumber
      );
    }

    // --------------------------------------------------
    // SUPABASE CLIENT
    // --------------------------------------------------

    const supabase =
      await createClient();

    const allowsMultiple =
      MULTIPLE_DOCUMENT_TYPES.includes(
        document_type
      );

    // --------------------------------------------------
    // FIND EXISTING DOCUMENT
    // --------------------------------------------------

    let existingDocument: any =
      null;

    if (!allowsMultiple) {
      const {
        data,
        error: existingError,
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
          { status: 500 }
        );
      }

      existingDocument = data;
    }

    // --------------------------------------------------
    // UPLOAD NEW FILE TO CLOUDINARY
    // --------------------------------------------------

    const buffer = fileBuffer;

    const base64Data =
      buffer.toString('base64');

    const dataURI =
      `data:${file.type};base64,${base64Data}`;

    uploadResult =
      await new Promise<any>(
        (resolve, reject) => {
          cloudinary.uploader.upload(
            dataURI,
            {
              folder:
                'teens-hr/documents',
              resource_type:
                'auto',
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

    // --------------------------------------------------
    // IDENTITY DATABASE FIELDS
    // --------------------------------------------------

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

    // --------------------------------------------------
    // REPLACE EXISTING DOCUMENT
    // --------------------------------------------------

    if (existingDocument) {
      const {
        data: updatedDocument,
        error: updateError,
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

      // --------------------------------------------------
      // DB UPDATE FAILED
      // --------------------------------------------------

      if (updateError) {
        console.error(
          'Error updating document record:',
          updateError
        );

        // Delete NEW Cloudinary file
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
          { status: 500 }
        );
      }

      // --------------------------------------------------
      // DB UPDATE SUCCESS
      // NOW DELETE OLD CLOUDINARY FILE
      // --------------------------------------------------

      if (
        existingDocument.cloudinary_public_id
      ) {
        try {
          await cloudinary.uploader.destroy(
            existingDocument.cloudinary_public_id,
            {
              resource_type:
                existingDocument.cloudinary_resource_type ||
                'image',
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
      });
    }

    // --------------------------------------------------
    // INSERT NEW DOCUMENT
    // --------------------------------------------------

    const {
      data: documentRecord,
      error: insertError,
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

    // --------------------------------------------------
    // DB INSERT FAILED
    // --------------------------------------------------

    if (insertError) {
      console.error(
        'Error saving document record:',
        insertError
      );

      // Delete newly uploaded Cloudinary file
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
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

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
    });
  } catch (error: any) {
    console.error(
      'Upload error:',
      error
    );

    // If Cloudinary upload succeeded but
    // something failed afterwards
    if (
      uploadResult?.public_id
    ) {
      try {
        await cloudinary.uploader.destroy(
          uploadResult.public_id,
          {
            resource_type:
              uploadResult.resource_type ||
              'image',
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
      { status: 500 }
    );
  }
}