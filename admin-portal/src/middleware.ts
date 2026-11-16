import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { enforceApiWriteAccess } from '@/lib/company-access';

const intlMiddleware = createMiddleware(routing);

// function name changed to middleware for Next.js convention
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiPath = pathname.startsWith('/api/');

  // API write guard (Free plan expired → 402). Runs before intl (API is outside locale).
  // Covered: all POST/PUT/PATCH/DELETE under /api/* except allowlist
  // (/api/billing/*, /api/webhooks/*, /api/auth/*, /api/cron/*, /api/subscription/*).
  let apiUserId: string | null = null;

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  apiUserId = user?.id ?? null;

  if (isApiPath) {
    const blocked = await enforceApiWriteAccess(request, apiUserId);
    if (blocked) return blocked;
    return supabaseResponse;
  }

  // First, run next-intl middleware for locale negotiation
  const intlResponse = await intlMiddleware(request);

  // If user is not signed in and the current path is not /auth/*,
  // redirect the user to /{locale}/auth/login

  // Get the locale from the URL path or default
  const defaultLocale = routing.defaultLocale;
  const pathnameIsMissingLocale = routing.locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  let locale = defaultLocale;
  if (!pathnameIsMissingLocale) {
    const pathnameLocale = routing.locales.find(
      (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );
    if (pathnameLocale) {
      locale = pathnameLocale;
    }
  }

  // Protected routes check
  if (!user && !pathname.includes('/auth/')) {
    // If we are on a protected route and not logged in, redirect to login
    // However, we need to respect internationalized paths.
    // The intlMiddleware handles the locale part, but if we need to redirect...

    // Check if it's a public path or asset
    if (
      !pathname.startsWith('/_next') &&
      !pathname.includes('/api/') &&
      !pathname.includes('.') // static files
    ) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = `/${locale}/auth/login`;
      loginUrl.searchParams.set(`redirectedFrom`, pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // If we have an intlResponse (redirect or rewrite), we should return it, 
  // but we need to merge the cookies set by Supabase.
  if (intlResponse) {
    // Copy cookies from supabaseResponse to intlResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      intlResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return intlResponse;
  }

  return supabaseResponse;
}

export const config = {
  // Include /api so Free-plan read-only write guard can run centrally.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
} 