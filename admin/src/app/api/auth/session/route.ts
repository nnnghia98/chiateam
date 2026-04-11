import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      role: null,
      canEdit: false,
    });
  }

  return NextResponse.json({
    authenticated: true,
    role: session.role,
    canEdit: session.role === 'admin',
  });
}
