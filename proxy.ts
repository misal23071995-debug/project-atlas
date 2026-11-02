import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

// Temporary site-wide password until agent logins exist.
// Only active when SITE_PASSWORD is set (e.g. on Vercel); local dev stays open.

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");

  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString();
    // Any username is accepted; only the password is checked
    const supplied = decoded.slice(decoded.indexOf(":") + 1);
    if (safeEqual(supplied, password)) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Atlas", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except static build files, so pages, API routes and
  // server actions are all protected
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
