import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/app/lib/supabase-config";

// Pages anyone can open: the agent login and the customer support chat
const PUBLIC_PATHS = ["/login", "/support"];

// Every other page and API route needs a signed-in agent.
// This also refreshes the Supabase session cookie before it expires.
// Server Actions still check the agent themselves (see requireAgent).

export async function proxy(request: NextRequest) {
  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        // Keep CDNs from caching a response that carries a session cookie
        Object.entries(headers).forEach(([header, value]) =>
          response.headers.set(header, value)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
