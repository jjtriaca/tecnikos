import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware server-side para proteção de rotas.
 * - Domínio raiz (tecnikos.com.br): redireciona /login e rotas protegidas para landing page
 * - Subdomínios (sls.tecnikos.com.br, admin.tecnikos.com.br): login + rotas protegidas normais
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  // Detecta se é o domínio raiz (sem subdomínio) — login não existe aqui
  const isBareHost = host === 'tecnikos.com.br' || host === 'www.tecnikos.com.br';

  // Domínio raiz: /login e /tech/login redirecionam para landing page
  if (isBareHost && (pathname === '/login' || pathname === '/tech/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Login pages em subdomínios: pass through normalmente
  if (pathname === '/login' || pathname === '/tech/login') {
    return NextResponse.next();
  }

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
    pathname.startsWith('/whatsapp') ||
    pathname.startsWith('/quotes')
  ) {
    const refreshToken = request.cookies.get('refresh_token');
    if (!refreshToken) {
      // Domínio raiz sem auth → landing page (não tem login aqui)
      if (isBareHost) {
        return NextResponse.redirect(new URL('/', request.url));
      }
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
      if (isBareHost) {
        return NextResponse.redirect(new URL('/', request.url));
      }
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
     * - public pages (p/, q/, rate/, demo)
     * Note: /login is now matched (handled inside middleware for bare domain redirect)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|p/|q/|rate/|demo|reset-password|verify/|signup|$).*)',
  ],
};
