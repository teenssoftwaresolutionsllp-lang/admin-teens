import { NextRequest, NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const annualQuota = Number(body.annual_quota);

    if (!Number.isFinite(annualQuota) || annualQuota < 0) {
      return NextResponse.json(
        { error: "Invalid annual quota" },
        { status: 400 }
      );
    }

    const updatedLeaveType = await DataStore.updateLeaveType(id, {
      annual_quota: annualQuota,
    });

    if (!updatedLeaveType) {
      return NextResponse.json(
        { error: "Leave type not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedLeaveType);
  } catch (error) {
    console.error("Update leave type error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update leave type",
      },
      { status: 500 }
    );
  }
}