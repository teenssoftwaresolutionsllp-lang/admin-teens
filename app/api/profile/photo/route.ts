
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// =========================================================
// CLOUDINARY CONFIG
// =========================================================

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =========================================================
// CONSTANTS
// =========================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// =========================================================
// TYPES
// =========================================================

type EmployeePhotoRecord = {
  id: string;
  employee_id: string | null;
  user_id: string | null;
  email: string | null;
  profile_photo_url: string | null;
};

// =========================================================
// FIND EMPLOYEE
// =========================================================

async function findEmployeeByUser(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  email: string | null
): Promise<{
  employee: EmployeePhotoRecord | null;
  error: string | null;
}> {
  const { data: userEmployee, error: userLookupError } =
    await adminClient
      .from("employees")
      .select(
        "id, employee_id, user_id, email, profile_photo_url"
      )
      .eq("user_id", userId)
      .maybeSingle();

  if (userLookupError) {
    console.error(
      "Employee lookup by user_id failed:",
      userLookupError
    );

    return {
      employee: null,
      error: userLookupError.message,
    };
  }

  if (userEmployee) {
    return {
      employee: userEmployee as EmployeePhotoRecord,
      error: null,
    };
  }

  if (!email) {
    return {
      employee: null,
      error: null,
    };
  }

  const { data: emailEmployee, error: emailLookupError } =
    await adminClient
      .from("employees")
      .select(
        "id, employee_id, user_id, email, profile_photo_url"
      )
      .ilike("email", email)
      .maybeSingle();

  if (emailLookupError) {
    console.error(
      "Employee lookup by email failed:",
      emailLookupError
    );

    return {
      employee: null,
      error: emailLookupError.message,
    };
  }

  return {
    employee: emailEmployee as EmployeePhotoRecord | null,
    error: null,
  };
}

// =========================================================
// GET CLOUDINARY PUBLIC ID
// =========================================================

function getCloudinaryPublicIdFromUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (
      parsed.hostname !== "cloudinary.com" &&
      !parsed.hostname.endsWith(".cloudinary.com")
    ) {
      return null;
    }

    const pathname = parsed.pathname;
    const uploadMarker = "/upload/";
    const uploadIndex = pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) return null;

    let publicPath = pathname.substring(
      uploadIndex + uploadMarker.length
    );

    const segments = publicPath.split("/");

    // Remove transformation segments.
    while (
      segments.length > 0 &&
      /^(?:[a-z]_[^/]+)$/.test(segments[0])
    ) {
      segments.shift();
    }

    publicPath = segments.join("/");

    // Remove version prefix, for example v1234567890/.
    publicPath = publicPath.replace(/^v\d+\//, "");

    // Remove file extension.
    publicPath = publicPath.replace(/\.[^/.]+$/, "");

    return publicPath || null;
  } catch {
    return null;
  }
}

// =========================================================
// DELETE OLD CLOUDINARY IMAGE
// =========================================================

async function deleteCloudinaryImage(
  publicId: string | null
): Promise<void> {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
  } catch (error) {
    console.warn(
      "Failed to delete Cloudinary image:",
      error
    );
  }
}

// =========================================================
// GET - LOAD SAVED PROFILE PHOTO
// =========================================================

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please log in again.",
          avatarUrl: null,
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const adminClient = await createAdminClient();

    const { employee, error } = await findEmployeeByUser(
      adminClient,
      user.id,
      user.email?.trim().toLowerCase() || null
    );

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to look up employee profile.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (!employee) {
      return NextResponse.json(
        {
          success: true,
          avatarUrl: null,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        avatarUrl: employee.profile_photo_url ?? null,
        employeeId: employee.id,
        employeeCode: employee.employee_id,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("GET profile photo error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load profile photo.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

// =========================================================
// POST - UPLOAD PROFILE PHOTO
// =========================================================

export async function POST(request: Request) {
  let uploadedPublicId: string | null = null;

  try {
    // 1. CHECK CLOUDINARY CONFIGURATION

    if (
      !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cloudinary is not configured. Please check environment variables.",
        },
        { status: 500 }
      );
    }

    // 2. AUTHENTICATE USER

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not authenticated. Please log in again.",
        },
        { status: 401 }
      );
    }

    const authEmail =
      user.email?.trim().toLowerCase() || null;

    // 3. READ FORM DATA

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No image file was provided.",
        },
        { status: 400 }
      );
    }

    // 4. VALIDATE IMAGE

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid image type. Please upload JPG, JPEG, PNG, or WEBP.",
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The uploaded image is empty.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Image size must be less than 5 MB.",
        },
        { status: 400 }
      );
    }

    // 5. FIND EMPLOYEE

    const adminClient = await createAdminClient();

    const {
      employee,
      error: employeeLookupError,
    } = await findEmployeeByUser(
      adminClient,
      user.id,
      authEmail
    );

    if (employeeLookupError) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to look up your employee record.",
        },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Employee record not found for your login account. Please contact HR.",
        },
        { status: 404 }
      );
    }

    // 6. SYNCHRONIZE USER ID IF MATCHED BY EMAIL

    if (employee.user_id !== user.id) {
      const { error: userIdUpdateError } = await adminClient
        .from("employees")
        .update({
          user_id: user.id,
        })
        .eq("id", employee.id);

      if (userIdUpdateError) {
        console.error(
          "Failed to synchronize employee user_id:",
          userIdUpdateError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Unable to link your login account to your employee record.",
          },
          { status: 500 }
        );
      }
    }

    // 7. READ IMAGE BUFFER

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!buffer.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to read uploaded image.",
        },
        { status: 400 }
      );
    }

    // 8. UPLOAD IMAGE TO CLOUDINARY

    const uploadResult = await new Promise<{
      secure_url?: string;
      public_id?: string;
    }>((resolve, reject) => {
      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            folder: "teens-hr/profile-photos",
            resource_type: "image",
            unique_filename: true,
            overwrite: false,
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            if (!result) {
              reject(
                new Error(
                  "Cloudinary returned no upload result."
                )
              );
              return;
            }

            resolve(result);
          }
        );

      uploadStream.end(buffer);
    });

    if (!uploadResult.secure_url) {
      throw new Error(
        "Cloudinary did not return an image URL."
      );
    }

    uploadedPublicId = uploadResult.public_id ?? null;

    const avatarUrl = uploadResult.secure_url;

    // 9. SAVE PHOTO URL TO EMPLOYEES TABLE

    const {
      data: updatedEmployee,
      error: updateError,
    } = await adminClient
      .from("employees")
      .update({
        profile_photo_url: avatarUrl,
      })
      .eq("id", employee.id)
      .select(
        "id, employee_id, user_id, email, profile_photo_url"
      )
      .single();

    if (updateError || !updatedEmployee) {
      console.error(
        "Failed to save employee profile photo:",
        updateError
      );

      await deleteCloudinaryImage(uploadedPublicId);
      uploadedPublicId = null;

      throw new Error(
        `Failed to save profile photo: ${
          updateError?.message ||
          "Employee record was not updated."
        }`
      );
    }

    // 10. DELETE PREVIOUS CLOUDINARY PHOTO
    // Only after the new URL has been saved successfully.

    const previousPublicId =
      getCloudinaryPublicIdFromUrl(
        employee.profile_photo_url
      );

    if (
      previousPublicId &&
      previousPublicId !== uploadedPublicId
    ) {
      await deleteCloudinaryImage(previousPublicId);
    }

    // 11. RETURN UPDATED PHOTO URL

    return NextResponse.json(
      {
        success: true,
        message: "Profile photo uploaded successfully.",
        avatarUrl: updatedEmployee.profile_photo_url,
        employeeId: updatedEmployee.id,
        employeeCode: updatedEmployee.employee_id,
        email: updatedEmployee.email,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("PROFILE PHOTO UPLOAD ERROR:", error);

    if (uploadedPublicId) {
      await deleteCloudinaryImage(uploadedPublicId);
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload profile photo.",
      },
      { status: 500 }
    );
  }
}
