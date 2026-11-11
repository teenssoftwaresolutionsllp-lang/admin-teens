import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { PDFParse } from "pdf-parse";
import { getPath } from "pdf-parse/worker";
import { createWorker, PSM } from "tesseract.js";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

PDFParse.setWorker(getPath());

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TESSERACT_WORKER_PATH = path.join(
  process.cwd(),
  "node_modules",
  "tesseract.js",
  "src",
  "worker-script",
  "node",
  "index.js"
);

const MAX_DOWNLOAD_SIZE = 5 * 1024 * 1024;

type HolidayCandidate = {
  holiday_date: string;
  title: string;
  is_optional: boolean;
  is_working_day: boolean;
  confidence: "review";
  source_line: string;
};

async function runOCR(buffer: Buffer): Promise<string> {
  const worker = await createWorker("eng", 1, {
    workerPath: TESSERACT_WORKER_PATH,
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });

    const normal = await worker.recognize(buffer);

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });

    const sparse = await worker.recognize(buffer);

    return [
      normal.data.text || "",
      sparse.data.text || "",
    ]
      .filter(Boolean)
      .join("\n");
  } finally {
    await worker.terminate();
  }
}

async function extractPDFText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = (result.text || "")
      .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
      .trim();

    if (text.replace(/[^A-Za-z0-9]/g, "").length > 10) {
      return text;
    }

    let ocrText = "";

    try {
      const imageResult = await parser.getImage({
        imageThreshold: 0,
        imageBuffer: true,
        imageDataUrl: false,
      });

      for (const page of imageResult.pages || []) {
        for (const image of page.images || []) {
          if (!image.data) continue;

          const pageText = await runOCR(Buffer.from(image.data));

          if (pageText.trim()) {
            ocrText += `\n${pageText}`;
          }
        }
      }
    } catch (error) {
      console.error("Embedded PDF image OCR failed:", error);
    }

    if (!ocrText.trim()) {
      const screenshotResult = await parser.getScreenshot({
        first: 3,
        desiredWidth: 3000,
        imageBuffer: true,
        imageDataUrl: false,
      });

      for (const page of screenshotResult.pages || []) {
        if (!page.data) continue;

        const pageText = await runOCR(Buffer.from(page.data));

        if (pageText.trim()) {
          ocrText += `\n${pageText}`;
        }
      }
    }

    return ocrText.trim();
  } finally {
    await parser.destroy();
  }
}

function normalizeDate(
  year: number,
  month: number,
  day: number
): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractCandidates(
  text: string,
  calendarYear: number
): HolidayCandidate[] {
  const candidates: HolidayCandidate[] = [];
  const seen = new Set<string>();

  const monthNames =
    "January|February|March|April|May|June|July|August|September|October|November|December";

  const patterns = [
    // YYYY-MM-DD
    /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/,

    // DD-MM-YYYY or DD/MM/YYYY
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/,

    // 1 January 2026
    new RegExp(
      `\\b(\\d{1,2})\\s+(${monthNames})\\s+(20\\d{2})\\b`,
      "i"
    ),

    // January 1, 2026
    new RegExp(
      `\\b(${monthNames})\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`,
      "i"
    ),
  ];

  const monthIndex = (name: string) =>
    new Date(`${name} 1, 2000`).getMonth() + 1;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();

    if (!line || line.length > 300) continue;

    let date: string | null = null;
    let matchedText = "";

    for (let i = 0; i < patterns.length; i++) {
      const match = line.match(patterns[i]);

      if (!match) continue;

      matchedText = match[0];

      if (i === 0) {
        date = normalizeDate(
          Number(match[1]),
          Number(match[2]),
          Number(match[3])
        );
      } else if (i === 1) {
        date = normalizeDate(
          Number(match[3]),
          Number(match[2]),
          Number(match[1])
        );
      } else if (i === 2) {
        date = normalizeDate(
          Number(match[3]),
          monthIndex(match[2]),
          Number(match[1])
        );
      } else {
        date = normalizeDate(
          Number(match[3]),
          monthIndex(match[1]),
          Number(match[2])
        );
      }

      break;
    }

    if (!date || !matchedText) continue;

    if (Number(date.slice(0, 4)) !== calendarYear) continue;

    const title = line
      .replace(matchedText, "")
      .replace(/^[\s\-–—:|,]+|[\s\-–—:|,]+$/g, "")
      .trim();

    if (!title) continue;

    const key = `${date}|${title.toLowerCase()}`;

    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      holiday_date: date,
      title,
      is_optional: false,
      is_working_day: false,
      confidence: "review",
      source_line: line,
    });
  }

  return candidates.sort((a, b) =>
    a.holiday_date.localeCompare(b.holiday_date)
  );
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    // 2. Verify HR / CEO
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    const role = String(profile?.role || "").toLowerCase();

    if (
      profileError ||
      !profile ||
      (role !== "hr" && role !== "ceo")
    ) {
      return NextResponse.json(
        { error: "Only HR and CEO can extract holiday documents." },
        { status: 403 }
      );
    }

    // 3. Read calendar
    const body = await request.json();
    const calendarId = String(body.calendar_id || "").trim();

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required." },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    const { data: calendar, error: calendarError } = await admin
      .from("holiday_calendars")
      .select(
        "id, calendar_year, document_public_id, document_file_name, document_status"
      )
      .eq("id", calendarId)
      .maybeSingle();

    if (calendarError || !calendar) {
      return NextResponse.json(
        { error: "Holiday calendar not found." },
        { status: 404 }
      );
    }

    if (calendar.document_status === "imported") {
      return NextResponse.json(
        { error: "This calendar has already been imported." },
        { status: 409 }
      );
    }

    if (
      !calendar.document_public_id ||
      !calendar.document_file_name
    ) {
      return NextResponse.json(
        { error: "Upload a holiday document before extracting." },
        { status: 400 }
      );
    }

    if (!calendar.calendar_year) {
      return NextResponse.json(
        { error: "Calendar year is missing." },
        { status: 400 }
      );
    }

    const isPdf = calendar.document_file_name
      .toLowerCase()
      .endsWith(".pdf");

    const resourceType = isPdf ? "raw" : "image";

    // 4. Retrieve the Cloudinary file
    const resource = await cloudinary.api.resource(
      calendar.document_public_id,
      { resource_type: resourceType }
    );

    if (!resource.secure_url) {
      throw new Error("Cloudinary did not return a secure file URL.");
    }

    const fileResponse = await fetch(resource.secure_url);

    if (!fileResponse.ok) {
      throw new Error("Could not download the uploaded document.");
    }

    const contentLength = Number(
      fileResponse.headers.get("content-length") || 0
    );

    if (contentLength > MAX_DOWNLOAD_SIZE) {
      return NextResponse.json(
        { error: "The uploaded document exceeds the 5 MB limit." },
        { status: 413 }
      );
    }

    const arrayBuffer = await fileResponse.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_DOWNLOAD_SIZE) {
      return NextResponse.json(
        { error: "The uploaded document exceeds the 5 MB limit." },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(arrayBuffer);

    // 5. Extract text
    const extractedText = isPdf
      ? await extractPDFText(buffer)
      : await runOCR(buffer);

    if (!extractedText.trim()) {
      return NextResponse.json(
        {
          error:
            "No readable text was found. Please upload a clearer document.",
        },
        { status: 422 }
      );
    }

    // 6. Identify candidate holidays
    const candidates = extractCandidates(
      extractedText,
      calendar.calendar_year
    );

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error:
            "No holiday dates could be identified. Please check the document format or upload a clearer copy.",
          extracted_text: extractedText,
        },
        { status: 422 }
      );
    }

    // 7. Save candidates for HR review
    const { data: updatedCalendar, error: updateError } = await admin
      .from("holiday_calendars")
      .update({
        extracted_holidays: candidates,
        document_status: "extracted",
      })
      .eq("id", calendarId)
      .neq("document_status", "imported")
      .select("id, calendar_year, extracted_holidays, document_status")
      .maybeSingle();

    if (updateError || !updatedCalendar) {
      console.error("Holiday extraction save error:", updateError);

      return NextResponse.json(
        { error: "Could not save extracted holiday candidates." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Holiday document extracted. Please review every candidate.",
      calendar: updatedCalendar,
      candidate_count: candidates.length,
    });
  } catch (error) {
    console.error("Holiday document extraction error:", error);

    return NextResponse.json(
      { error: "Failed to extract the holiday document." },
      { status: 500 }
    );
  }
}
