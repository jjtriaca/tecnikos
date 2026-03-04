import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware server-side para proteção de rotas.
 * Verifica presença do cookie de refresh token antes de permitir acesso
 * às áreas protegidas. Não valida o token (isso é feito pelo backend),
 * apenas garante que o cookie existe — prevenindo flash de conteúdo
 * protegido antes do client-side redirect.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas do painel administrativo — requer cookie de refresh_token
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/partners') ||
    pathname.startsWith('/finance') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/workflow') ||
    pathname.startsWith('/automation') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/nfe') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/whatsapp')
  ) {
    const refreshToken = request.cookies.get('refresh_token');
    if (!refreshToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Rotas do portal do técnico — requer cookie tech_refresh_token
  if (
    pathname.startsWith('/tech/orders') ||
    pathname.startsWith('/tech/profile')
  ) {
    const techToken = request.cookies.get('tech_refresh_token');
    if (!techToken) {
      return NextResponse.redirect(new URL('/tech/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes / proxy)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, public files
     * - login pages
     * - public pages (p/, rate/, demo)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|tech/login|p/|rate/|demo|$).*)',
  ],
};
