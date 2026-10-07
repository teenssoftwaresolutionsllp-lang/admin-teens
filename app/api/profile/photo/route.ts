import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

// ============================================================
// CLOUDINARY CONFIGURATION
// ============================================================

cloudinary.config({
  cloud_name:
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,

  api_key:
    process.env.CLOUDINARY_API_KEY,

  api_secret:
    process.env.CLOUDINARY_API_SECRET,
});

// ============================================================
// MAXIMUM IMAGE SIZE = 5 MB
// ============================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ============================================================
// POST - EMPLOYEE PROFILE PHOTO UPLOAD
// ============================================================

export async function POST(request: Request) {
  try {
    // ========================================================
    // 1. GET LOGGED-IN USER
    // ========================================================

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error(
        "Supabase Auth error:",
        userError
      );

      return NextResponse.json(
        {
          error:
            `Authentication error: ${userError.message}`,
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorized. Please login again.",
        },
        { status: 401 }
      );
    }

    // ========================================================
    // LOGGED-IN USER DETAILS
    // ========================================================

    const authUserId = user.id;

    const authEmail =
      user.email?.trim().toLowerCase() || "";

    console.log(
      "=========================================="
    );
    console.log(
      "EMPLOYEE PROFILE PHOTO UPLOAD"
    );
    console.log(
      "Auth User ID:",
      authUserId
    );
    console.log(
      "Auth Email:",
      authEmail
    );
    console.log(
      "=========================================="
    );

    if (!authEmail) {
      return NextResponse.json(
        {
          error:
            "Logged-in user does not have an email address.",
        },
        { status: 400 }
      );
    }

    // ========================================================
    // 2. GET IMAGE FILE
    // ========================================================

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Please select an image file.",
        },
        { status: 400 }
      );
    }

    // ========================================================
    // CHECK FILE TYPE
    // ========================================================

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          error:
            "Only image files are allowed.",
        },
        { status: 400 }
      );
    }

    // ========================================================
    // CHECK FILE SIZE
    // ========================================================

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error:
            "Image size must be less than 5MB.",
        },
        { status: 400 }
      );
    }

    // ========================================================
    // 3. CREATE ADMIN SUPABASE CLIENT
    // ========================================================

    const adminSupabase =
      await createAdminClient();

    let employee: {
      id: string;
      user_id: string | null;
      email: string | null;
      profile_photo_url: string | null;
    } | null = null;

    // ========================================================
    // 4. FIRST TRY: USER ID
    // ========================================================

    console.log(
      "Searching employee by user_id..."
    );

    const {
      data: employeeByUserId,
      error: userIdError,
    } = await adminSupabase
      .from("employees")
      .select(
        "id, user_id, email, profile_photo_url"
      )
      .eq(
        "user_id",
        authUserId
      )
      .maybeSingle();

    if (userIdError) {
      console.error(
        "User ID lookup error:",
        userIdError
      );
    }

    if (employeeByUserId) {
      employee = employeeByUserId;

      console.log(
        "Employee found using user_id:",
        employee
      );
    }

    // ========================================================
    // 5. SECOND TRY: EMAIL
    // ========================================================

    if (!employee) {
      console.log(
        "Employee not found by user_id."
      );

      console.log(
        "Searching employee by email:",
        authEmail
      );

      const {
        data: employeeByEmail,
        error: emailError,
      } = await adminSupabase
        .from("employees")
        .select(
          "id, user_id, email, profile_photo_url"
        )
        .ilike(
          "email",
          authEmail
        )
        .maybeSingle();

      if (emailError) {
        console.error(
          "Email lookup error:",
          emailError
        );
      }

      if (employeeByEmail) {
        employee = employeeByEmail;

        console.log(
          "Employee found using email:",
          employee
        );
      }
    }

    // ========================================================
    // 6. EMPLOYEE NOT FOUND
    // ========================================================

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
            "Employee record not found.",

          authUserId:
            authUserId,

          authEmail:
            authEmail,

          message:
            "No employee record matches this Supabase Auth user ID or email.",
        },
        { status: 404 }
      );
    }

    // ========================================================
    // EMPLOYEE FOUND
    // ========================================================

    console.log(
      "=========================================="
    );

    console.log(
      "EMPLOYEE FOUND"
    );

    console.log(
      "Employee ID:",
      employee.id
    );

    console.log(
      "Employee Email:",
      employee.email
    );

    console.log(
      "Employee User ID:",
      employee.user_id
    );

    console.log(
      "=========================================="
    );

    // ========================================================
    // 7. CONVERT IMAGE TO BASE64
    // ========================================================

    const buffer =
      await file.arrayBuffer();

    const base64Data =
      Buffer.from(buffer)
        .toString("base64");

    const dataURI =
      `data:${file.type};base64,${base64Data}`;

    // ========================================================
    // 8. UPLOAD TO CLOUDINARY
    // ========================================================

    console.log(
      "Uploading image to Cloudinary..."
    );

    const uploadResult =
      await new Promise<any>(
        (resolve, reject) => {
          cloudinary.uploader.upload(
            dataURI,
            {
              folder:
                "teens-hr/profile-photos",

              resource_type:
                "image",

              overwrite:
                true,
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

    // ========================================================
    // 9. GET CLOUDINARY URL
    // ========================================================

    const avatarUrl =
      uploadResult?.secure_url;

    if (!avatarUrl) {
      console.error(
        "Cloudinary did not return secure_url:",
        uploadResult
      );

      return NextResponse.json(
        {
          error:
            "Photo uploaded but Cloudinary did not return a URL.",
        },
        { status: 500 }
      );
    }

    console.log(
      "Cloudinary URL:",
      avatarUrl
    );

    // ========================================================
    // 10. SAVE PHOTO URL TO EMPLOYEES TABLE
    // ========================================================

    console.log(
      "Updating employees.profile_photo_url..."
    );

    const {
      error: updateError,
    } = await adminSupabase
      .from("employees")
      .update({
        profile_photo_url:
          avatarUrl,
      })
      .eq(
        "id",
        employee.id
      );

    if (updateError) {
      console.error(
        "Database photo update error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            `Photo uploaded, but employee profile could not be updated: ${updateError.message}`,
        },
        { status: 500 }
      );
    }

    // ========================================================
    // 11. SUCCESS
    // ========================================================

    console.log(
      "=========================================="
    );

    console.log(
      "PROFILE PHOTO UPDATED SUCCESSFULLY"
    );

    console.log(
      "Employee ID:",
      employee.id
    );

    console.log(
      "Photo URL:",
      avatarUrl
    );

    console.log(
      "=========================================="
    );

    return NextResponse.json(
      {
        success: true,

        avatarUrl:

          avatarUrl,

        employeeId:

          employee.id,

        email:

          employee.email,
      },
      { status: 200 }
    );
  } catch (error) {
    // ========================================================
    // GENERAL ERROR
    // ========================================================

    console.error(
      "PROFILE PHOTO UPLOAD ERROR:",
      error
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        error:
          `Profile photo upload failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}