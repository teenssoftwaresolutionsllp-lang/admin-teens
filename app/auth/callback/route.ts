import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(
      new URL("/login?error=invalid_or_expired_link", url.origin)
    );
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });

    if (error) {
      console.error("[Auth Callback] Recovery verification failed:", error.message);

      return NextResponse.redirect(
        new URL("/login?error=invalid_or_expired_link", url.origin)
      );
    }

    return NextResponse.redirect(
      new URL("/set-password", url.origin)
    );
  } catch (error) {
    console.error("[Auth Callback] Unexpected error:", error);

    return NextResponse.redirect(
      new URL("/login?error=authentication_failed", url.origin)
    );
  }
}