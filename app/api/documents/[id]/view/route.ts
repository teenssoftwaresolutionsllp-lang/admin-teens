import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    const { data: document, error } = await supabase
      .from("employee_documents")
      .select(`
        id,
        document_url,
        document_name
      `)
      .eq("id", id)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (!document.document_url) {
      return NextResponse.json(
        { error: "Document URL not found" },
        { status: 404 }
      );
    }

    // Fetch the file from Cloudinary
    const cloudinaryResponse = await fetch(document.document_url);

    if (!cloudinaryResponse.ok) {
      console.error(
        "Cloudinary fetch failed:",
        cloudinaryResponse.status,
        cloudinaryResponse.statusText
      );

      return NextResponse.json(
        {
          error: "Failed to fetch document from Cloudinary",
          status: cloudinaryResponse.status,
        },
        { status: 500 }
      );
    }

    const buffer = await cloudinaryResponse.arrayBuffer();

    // Determine content type from file name
    const fileName = document.document_name || "";

    let contentType = "application/octet-stream";

    if (fileName.toLowerCase().endsWith(".pdf")) {
      contentType = "application/pdf";
    } else if (/\.(jpg|jpeg)$/i.test(fileName)) {
      contentType = "image/jpeg";
    } else if (/\.png$/i.test(fileName)) {
      contentType = "image/png";
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,

        // IMPORTANT:
        // inline = browser should display the document
        // attachment = browser should download it
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,

        "Cache-Control": "private, no-cache, no-store, must-revalidate",

        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Document view error:", error);

    return NextResponse.json(
      { error: "Failed to view document" },
      { status: 500 }
    );
  }
}