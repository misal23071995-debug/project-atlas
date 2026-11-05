import { NextRequest, NextResponse } from "next/server";
import { analyzeWithAI } from "@/app/lib/ai/service";
import { getSession, needsSecondStep } from "@/app/lib/auth/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !("org" in session) || (await needsSecondStep())) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }

  try {
    // Accept either field name from callers
    const body = await request.json();
    const message = body.message ?? body.prompt;

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "message or prompt is required" },
        { status: 400 }
      );
    }

    const { analysis, source } = await analyzeWithAI(message);

    return NextResponse.json({
      success: true,
      source,
      analysis,
    });
  } catch (error) {
    console.error("FULL ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
