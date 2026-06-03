import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from './lib/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123_abc_xyz_aasa_medchem';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Exclude static assets and api routes (except those we want to protect manually or via API logic)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') || // Exclude auth api endpoints to allow login/logout/register
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Get session token from cookie
  const sessionToken = request.cookies.get('session_token')?.value;

  let session = null;
  if (sessionToken) {
    session = await verifyJWT(sessionToken, JWT_SECRET);
  }

  // Define route protections
  const isAdminPath = pathname.startsWith('/admin');
  const isSellerPath = pathname.startsWith('/seller');
  const isLoginPage = pathname === '/';

  // 1. Not logged in -> Redirect to login if trying to access admin or seller pages
  if (!session) {
    if (isAdminPath || isSellerPath) {
      const loginUrl = new URL('/', request.url);
      // Optional: keep track of redirect path
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Logged in -> If trying to go to login page, redirect to their respective dashboard
  if (isLoginPage) {
    const dashboardPath = session.role === 'admin' ? '/admin' : '/seller';
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  // 3. Admin path -> Block non-admins
  if (isAdminPath && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/seller', request.url));
  }

  // 4. Seller path -> Block non-sellers and non-buyers (both use the catalog workspace)
  if (isSellerPath && session.role !== 'seller' && session.role !== 'buyer') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

// Configure middleware matcher
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
