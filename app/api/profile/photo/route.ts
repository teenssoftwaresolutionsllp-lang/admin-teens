import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// =========================================================
// HELPERS
// =========================================================

function getCloudinaryPublicIdFromUrl(url: string | null | undefined) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    const pathname = parsed.pathname;

    // Example:
    // /image/upload/v1234567890/teens-hr/profile-photos/abc123.jpg

    const uploadIndex = pathname.indexOf("/upload/");

    if (uploadIndex === -1) {
      return null;
    }

    let publicPath = pathname.substring(uploadIndex + "/upload/".length);

    // Remove version
    publicPath = publicPath.replace(/^v\d+\//, "");

    // Remove extension
    publicPath = publicPath.replace(/\.[^/.]+$/, "");

    return publicPath;
  } catch {
    return null;
  }
}

async function deleteCloudinaryImage(publicId: string | null) {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn(
      "Failed to delete Cloudinary image:",
      error
    );
  }
}

// =========================================================
// POST - UPLOAD PROFILE PHOTO
// =========================================================

export async function POST(request: Request) {
  let uploadedPublicId: string | null = null;

  try {
    // -----------------------------------------------------
    // 1. CHECK CLOUDINARY CONFIG
    // -----------------------------------------------------

    if (
      !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      console.error("Cloudinary environment variables are missing.");

      return NextResponse.json(
        {
          error:
            "Cloudinary is not configured. Please check environment variables.",
        },
        { status: 500 }
      );
    }

    // -----------------------------------------------------
    // 2. GET AUTHENTICATED USER
    // -----------------------------------------------------

    const supabase = await createClient();

    let authUser = null;

    // First attempt: getUser()
    try {
      const {
        data,
        error,
      } = await supabase.auth.getUser();

      if (!error && data?.user) {
        authUser = data.user;
      }
    } catch (error) {
      console.warn(
        "getUser() failed:",
        error
      );
    }

    // Second attempt: getSession()
    if (!authUser) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          authUser = session.user;
        }
      } catch (error) {
        console.warn(
          "getSession() failed:",
          error
        );
      }
    }

    if (!authUser) {
      return NextResponse.json(
        {
          error:
            "You are not authenticated. Please login again.",
        },
        { status: 401 }
      );
    }

    const authUserId = authUser.id;

    const authEmail =
      authUser.email?.trim().toLowerCase() || null;

    console.log(
      "=========================================="
    );

    console.log(
      "PROFILE PHOTO UPLOAD - AUTH USER"
    );

    console.log(
      "Supabase Auth User ID:",
      authUserId
    );

    console.log(
      "Supabase Auth Email:",
      authEmail
    );

    console.log(
      "=========================================="
    );

    // -----------------------------------------------------
    // 3. GET FORM DATA
    // -----------------------------------------------------

    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "No image file was provided.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // 4. VALIDATE FILE
    // -----------------------------------------------------

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid image type. Please upload JPG, JPEG, PNG, or WEBP.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error:
            "Image size must be less than 5 MB.",
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          error:
            "The uploaded image is empty.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // 5. ADMIN SUPABASE CLIENT
    // -----------------------------------------------------

    const adminClient = await createAdminClient();

    // -----------------------------------------------------
    // 6. FIND EMPLOYEE
    //
    // IMPORTANT:
    // We only use columns that actually exist based on
    // your employee creation code.
    //
    // Priority:
    //   1. user_id
    //   2. email
    // -----------------------------------------------------

    let employee: {
      id: string;
      employee_id: string | null;
      user_id: string | null;
      email: string | null;
      profile_photo_url: string | null;
    } | null = null;

    // -----------------------------------------------------
    // 6A. FIND BY USER_ID
    // -----------------------------------------------------

    if (authUserId) {
      const {
        data,
        error,
      } = await adminClient
        .from("employees")
        .select(
          "id, employee_id, user_id, email, profile_photo_url"
        )
        .eq("user_id", authUserId)
        .maybeSingle();

      if (error) {
        console.error(
          "Employee lookup by user_id failed:",
          error
        );
      }

      if (data) {
        employee = data;
      }
    }

    // -----------------------------------------------------
    // 6B. FIND BY EMAIL
    // -----------------------------------------------------

    if (!employee && authEmail) {
      const {
        data,
        error,
      } = await adminClient
        .from("employees")
        .select(
          "id, employee_id, user_id, email, profile_photo_url"
        )
        .ilike("email", authEmail)
        .maybeSingle();

      if (error) {
        console.error(
          "Employee lookup by email failed:",
          error
        );
      }

      if (data) {
        employee = data;
      }
    }

    // -----------------------------------------------------
    // 7. EMPLOYEE NOT FOUND
    // -----------------------------------------------------

    if (!employee) {
      console.error(
        "=========================================="
      );

      console.error(
        "EMPLOYEE RECORD NOT FOUND"
      );

      console.error(
        "Auth User ID:",
        authUserId
      );

      console.error(
        "Auth Email:",
        authEmail
      );

      console.error(
        "=========================================="
      );

      return NextResponse.json(
        {
          error:
            "Employee record not found for your login account. Please contact HR.",
          authUserId,
          authEmail,
        },
        { status: 404 }
      );
    }

    console.log(
      "Employee found:",
      {
        id: employee.id,
        employee_id: employee.employee_id,
        user_id: employee.user_id,
        email: employee.email,
      }
    );

    // -----------------------------------------------------
    // 8. FIX USER_ID IF EMAIL MATCHED BUT USER_ID IS EMPTY
    // -----------------------------------------------------

    if (
      authUserId &&
      employee.user_id !== authUserId
    ) {
      const {
        error: updateUserIdError,
      } = await adminClient
        .from("employees")
        .update({
          user_id: authUserId,
        })
        .eq("id", employee.id);

      if (updateUserIdError) {
        console.warn(
          "Could not synchronize employee user_id:",
          updateUserIdError
        );
      } else {
        console.log(
          "Employee user_id synchronized:",
          authUserId
        );
      }
    }

    // -----------------------------------------------------
    // 9. CONVERT IMAGE TO BUFFER
    // -----------------------------------------------------

    const arrayBuffer = await file.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
      return NextResponse.json(
        {
          error:
            "Unable to read uploaded image.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // 10. UPLOAD TO CLOUDINARY
    // -----------------------------------------------------

    const folder =
      "teens-hr/profile-photos";

    const uploadResult =
      await new Promise<any>(
        (resolve, reject) => {
          const uploadStream =
            cloudinary.uploader.upload_stream(
              {
                folder,
                resource_type: "image",
                unique_filename: true,
                overwrite: false,
              },
              (
                error,
                result
              ) => {
                if (error) {
                  reject(error);
                  return;
                }

                resolve(result);
              }
            );

          uploadStream.end(buffer);
        }
      );

    if (!uploadResult?.secure_url) {
      throw new Error(
        "Cloudinary did not return an image URL."
      );
    }

    uploadedPublicId =
      uploadResult.public_id || null;

    const avatarUrl =
      uploadResult.secure_url;

    console.log(
      "Cloudinary upload successful:",
      {
        publicId: uploadedPublicId,
        url: avatarUrl,
      }
    );

    // -----------------------------------------------------
    // 11. SAVE PHOTO URL IN EMPLOYEES TABLE
    // -----------------------------------------------------

    const {
      data: updatedEmployee,
      error: updateEmployeeError,
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

    if (updateEmployeeError) {
      console.error(
        "Failed to update employee profile photo:",
        updateEmployeeError
      );

      // Delete newly uploaded Cloudinary image
      await deleteCloudinaryImage(
        uploadedPublicId
      );

      uploadedPublicId = null;

      throw new Error(
        `Failed to save profile photo: ${updateEmployeeError.message}`
      );
    }

    // -----------------------------------------------------
    // 12. SUCCESS
    // -----------------------------------------------------

    console.log(
      "=========================================="
    );

    console.log(
      "PROFILE PHOTO SAVED SUCCESSFULLY"
    );

    console.log(
      "Employee ID:",
      updatedEmployee.employee_id
    );

    console.log(
      "Auth User ID:",
      authUserId
    );

    console.log(
      "Photo URL:",
      updatedEmployee.profile_photo_url
    );

    console.log(
      "=========================================="
    );

    return NextResponse.json(
      {
        success: true,
        avatarUrl:
          updatedEmployee.profile_photo_url,
        employeeId:
          updatedEmployee.id,
        employeeCode:
          updatedEmployee.employee_id,
        email:
          updatedEmployee.email,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(
      "=========================================="
    );

    console.error(
      "PROFILE PHOTO UPLOAD ERROR"
    );

    console.error(error);

    console.error(
      "=========================================="
    );

    // If Cloudinary upload succeeded but something else failed,
    // remove the uploaded image so unused files don't remain.
    if (uploadedPublicId) {
      await deleteCloudinaryImage(
        uploadedPublicId
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to upload profile photo.",
      },
      { status: 500 }
    );
  }
}