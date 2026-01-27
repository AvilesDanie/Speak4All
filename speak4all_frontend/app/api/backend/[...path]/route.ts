import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

async function proxy(req: NextRequest, params: { path: string[] }) {
  const base = API_BASE.replace(/\/$/, '');
  const path = params.path.join('/');
  const targetUrl = `${base}/${path}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('content-length');

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const res = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual', // No seguir redirects automáticamente
    });

    // Si es un redirect, seguirlo manualmente sin reenviar el body
    if (res.status === 307 || res.status === 308) {
      const location = res.headers.get('location');
      if (location) {
        const redirectRes = await fetch(location, {
          method,
          headers,
          body: hasBody ? body : undefined,
          cache: 'no-store',
          redirect: 'manual',
        });

        const responseHeaders = new Headers(redirectRes.headers);
        return new NextResponse(redirectRes.body, {
          status: redirectRes.status,
          headers: responseHeaders,
        });
      }
    }

    const responseHeaders = new Headers(res.headers);
    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error for', targetUrl, error);
    return NextResponse.json({ detail: 'Error al conectar con el backend' }, { status: 502 });
  }
}

export function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx.params);
}

export function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx.params);
}

export function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx.params);
}

export function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx.params);
}

export function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx.params);
}
