import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookie, validatePassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const password =
      typeof payload?.password === 'string' ? payload.password : '';

    if (!password) {
      return NextResponse.json(
        { error: 'PASSWORD_REQUIRED' },
        { status: 400 }
      );
    }

    const role = validatePassword(password);

    if (!role) {
      return NextResponse.json(
        { error: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      authenticated: true,
      role,
      canEdit: role === 'admin',
    });

    setSessionCookie(response, role);
    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'LOGIN_FAILED' }, { status: 500 });
  }
}
