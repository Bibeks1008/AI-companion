import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";
import { LOGIN_ROUTE, ONBOARDING_ROUTE } from "@/constants/routes.constants";

// Routes that require an authenticated session.
const PROTECTED_PREFIXES = ["/onboarding", "/result"];

/**
 * Refreshes the Supabase auth session on every request and applies coarse route
 * protection. IMPORTANT (per @supabase/ssr docs): always return the
 * `supabaseResponse` object as-is so the refreshed auth cookies are preserved.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser() — it must be the
  // first call so the session is refreshed before any redirect decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_ROUTE;
    return NextResponse.redirect(url);
  }

  if (user && path === LOGIN_ROUTE) {
    const url = request.nextUrl.clone();
    url.pathname = ONBOARDING_ROUTE;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
