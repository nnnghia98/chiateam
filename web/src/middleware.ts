import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only protect /admin-111 routes
  if (!request.nextUrl.pathname.startsWith('/admin-111')) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const [username, password] = decoded.split(':');

      const validUser = process.env.ADMIN_USERNAME || 'admin';
      const validPass = process.env.ADMIN_PASSWORD || '28041998';

      if (username === validUser && password === validPass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin Area"',
    },
  });
}

export const config = {
  matcher: '/admin-111/:path*',
};
