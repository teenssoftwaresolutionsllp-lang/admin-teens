import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@/lib/supabase-server';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const employee_id = formData.get('employee_id') as string;
    const document_type = formData.get('document_type') as string;
    const document_name = formData.get('document_name') as string;

    if (!file || !employee_id || !document_type || !document_name?.trim()) {
      return NextResponse.json(
        { error: 'File, employee, document type, and document name are required' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const dataURI = `data:${file.type};base64,${base64Data}`;

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        dataURI,
        {
          folder: 'teens-hr/documents',
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    }) as any;

    const supabase = await createClient();
    const { data: documentRecord, error } = await supabase
      .from('employee_documents')
      .insert({
        employee_id,
        document_type,
        document_name: document_name.trim(),
        document_url: uploadResult.secure_url,
        cloudinary_public_id: uploadResult.public_id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving document record:', error);
      return NextResponse.json({ error: 'File uploaded but document record could not be saved' }, { status: 500 });
    }

    return NextResponse.json({
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      document: documentRecord,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'An error occurred during file upload' },
      { status: 500 }
    );
  }
}
