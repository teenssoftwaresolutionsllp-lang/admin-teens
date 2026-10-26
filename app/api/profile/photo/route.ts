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
// HELPERS
// =========================================================

type EmployeePhotoRecord = {
  id: string;
  employee_id: string | null;
  user_id: string | null;
  email: string | null;
  profile_photo_url: string | null;
};

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
    return { employee: null, error: null };
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

function getCloudinaryPublicIdFromUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (!parsed.hostname.endsWith("cloudinary.com")) {
      return null;
    }

    const pathname = parsed.pathname;
    const uploadMarker = "/upload/";
    const uploadIndex = pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) return null;

    let publicPath = pathname.substring(
      uploadIndex + uploadMarker.length
    );

    // Remove transformation segments, if present.
    const segments = publicPath.split("/");
    while (
      segments.length > 0 &&
      /^(?:[a-z]_[^/]+|q_[^/]+|f_[^/]+|w_[^/]+|h_[^/]+|c_[^/]+)$/.test(
        segments[0]
      )
    ) {
      segments.shift();
    }

    publicPath = segments.join("/");

    // Remove the version prefix, for example v1234567890/.
    publicPath = publicPath.replace(/^v\d+\//, "");

    // Remove the file extension.
    publicPath = publicPath.replace(/\.[^/.]+$/, "");

    return publicPath || null;
  } catch {
    return null;
  }
}

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
// GET - LOAD SAVED PROFILE PHOTO AFTER LOGIN
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
        { error: "Unauthorized. Please log in again." },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
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
        { error: "Unable to look up employee profile." },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    if (!employee) {
      return NextResponse.json(
        { avatarUrl: null },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        avatarUrl: employee.profile_photo_url ?? null,
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
      { error: "Failed to load profile photo." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
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
          error: "You are not authenticated. Please log in again.",
        },
        { status: 401 }
      );
    }

    const authEmail = user.email?.trim().toLowerCase() || null;

    // 3. READ FORM DATA

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No image file was provided." },
        { status: 400 }
      );
    }

    // 4. VALIDATE IMAGE

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid image type. Please upload JPG, JPEG, PNG, or WEBP.",
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The uploaded image is empty." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image size must be less than 5 MB." },
        { status: 400 }
      );
    }

    // 5. FIND EMPLOYEE

    const adminClient = await createAdminClient();

    const { employee, error: employeeLookupError } =
      await findEmployeeByUser(
        adminClient,
        user.id,
        authEmail
      );

    if (employeeLookupError) {
      return NextResponse.json(
        { error: "Failed to look up your employee record." },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        {
          error:
            "Employee record not found for your login account. Please contact HR.",
        },
        { status: 404 }
      );
    }

    // If matched by email, synchronize the authentication user ID.
    if (employee.user_id !== user.id) {
      const { error: userIdUpdateError } = await adminClient
        .from("employees")
        .update({ user_id: user.id })
        .eq("id", employee.id);

      if (userIdUpdateError) {
        console.error(
          "Failed to synchronize employee user_id:",
          userIdUpdateError
        );

        return NextResponse.json(
          {
            error:
              "Unable to link your login account to your employee record.",
          },
          { status: 500 }
        );
      }
    }

    // 6. UPLOAD TO CLOUDINARY

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!buffer.length) {
      return NextResponse.json(
        { error: "Unable to read uploaded image." },
        { status: 400 }
      );
    }

    const uploadResult = await new Promise<{
      secure_url?: string;
      public_id?: string;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
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
            reject(new Error("Cloudinary returned no upload result."));
            return;
          }

          resolve(result);
        }
      );

      uploadStream.end(buffer);
    });

    if (!uploadResult.secure_url) {
      throw new Error("Cloudinary did not return an image URL.");
    }

    uploadedPublicId = uploadResult.public_id ?? null;
    const avatarUrl = uploadResult.secure_url;

    // 7. SAVE PHOTO URL TO DATABASE

    const { data: updatedEmployee, error: updateError } =
      await adminClient
        .from("employees")
        .update({ profile_photo_url: avatarUrl })
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
          updateError?.message || "Employee record was not updated."
        }`
      );
    }

    // 8. OPTIONAL CLEANUP OF THE PREVIOUS CLOUDINARY PHOTO
    // Do this only after the new photo URL has been saved.
    // If the previous URL is not a Cloudinary URL, it is left untouched.

    const previousPublicId = getCloudinaryPublicIdFromUrl(
      employee.profile_photo_url
    );

    if (
      previousPublicId &&
      previousPublicId !== uploadedPublicId
    ) {
      await deleteCloudinaryImage(previousPublicId);
    }

    // 9. RETURN SUCCESS

    return NextResponse.json(
      {
        success: true,
        avatarUrl: updatedEmployee.profile_photo_url,
        employeeId: updatedEmployee.id,
        employeeCode: updatedEmployee.employee_id,
        email: updatedEmployee.email,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("PROFILE PHOTO UPLOAD ERROR:", error);

    if (uploadedPublicId) {
      await deleteCloudinaryImage(uploadedPublicId);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload profile photo.",
      },
      { status: 500 }
    );
  }
}