import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@/lib/supabase-server';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get document
    const { data: document, error: fetchError } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      console.error('Document not found:', fetchError);

      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from('employee_documents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Database delete error:', deleteError);

      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Delete Cloudinary file
    if (document.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(
          document.cloudinary_public_id,
          {
            resource_type:
              document.cloudinary_resource_type || 'image',
          }
        );
      } catch (cloudinaryError) {
        console.error(
          'Cloudinary delete error:',
          cloudinaryError
        );
      }
    }

    return NextResponse.json({
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    console.error(
      'API Error in DELETE /api/documents/[id]:',
      error
    );

    return NextResponse.json(
      {
        error: error?.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}