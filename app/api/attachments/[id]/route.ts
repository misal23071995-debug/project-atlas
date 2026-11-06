import { NextResponse, type NextRequest } from "next/server";
import { getSession, needsSecondStep } from "@/app/lib/auth/session";
import { signedLink } from "@/app/lib/db/attachments";

// Opens an attachment for a signed-in member of its workspace, through a link that expires in a minute
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !("org" in session) || (await needsSecondStep())) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const link = await signedLink(session.org.id, (await params).id, { inline: request.nextUrl.searchParams.get("view") === "1" });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.redirect(link.url, { headers: { "Cache-Control": "private, no-store" } });
}
