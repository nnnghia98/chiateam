import { NextRequest, NextResponse } from 'next/server';
import { getInternalApiAuthToken, getSessionFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

const API_URL =
  process.env.API_INTERNAL_URL || 'http://chiateam-api.railway.internal:8787';
type ProxyRouteContext = {
  params: Promise<{ path: string[] }>;
};

function buildApiUrl(request: NextRequest, path: string[]) {
  const joinedPath = path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  return `${API_URL}/${joinedPath}${searchParams ? `?${searchParams}` : ''}`;
}

function unauthorized() {
  return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
}

async function proxyJsonRequest(
  request: NextRequest,
  path: string[],
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
) {
  const session = getSessionFromRequest(request);

  if (!session) {
    return unauthorized();
  }

  if (method !== 'GET' && session.role !== 'admin') {
    return forbidden();
  }

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Api-Auth': getInternalApiAuthToken(),
      'X-Admin-Role': session.role,
    },
    cache: 'no-store',
  };

  if (method === 'POST' || method === 'PUT') {
    init.body = JSON.stringify(await request.json());
  }

  try {
    const response = await fetch(buildApiUrl(request, path), init);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': contentType || 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('API Proxy Error:', error);
    return NextResponse.json(
      { error: 'Failed to reach API service' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: ProxyRouteContext) {
  const { path } = await context.params;
  return proxyJsonRequest(request, path, 'GET');
}

export async function POST(request: NextRequest, context: ProxyRouteContext) {
  const { path } = await context.params;
  return proxyJsonRequest(request, path, 'POST');
}

export async function PUT(request: NextRequest, context: ProxyRouteContext) {
  const { path } = await context.params;
  return proxyJsonRequest(request, path, 'PUT');
}

export async function DELETE(request: NextRequest, context: ProxyRouteContext) {
  const { path } = await context.params;
  return proxyJsonRequest(request, path, 'DELETE');
}
