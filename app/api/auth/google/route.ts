import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getBaseUrl(req: NextRequest): string {
  const configuredUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin;
    } catch {
      // Fall through to dynamic host detection
    }
  }

  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostHeader = req.headers.get('host');
  const host = forwardedHost || hostHeader || '';

  if (host) {
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const proto = forwardedProto || (isLocal ? 'http' : 'https');
    return `${proto}://${host}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'https://hackathon2-olive-eight.vercel.app';
}

function getCallbackUrl(req: NextRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    const configuredRedirect = process.env.GOOGLE_REDIRECT_URI.trim();
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd || !configuredRedirect.includes('localhost')) {
      return configuredRedirect;
    }
  }
  return `${getBaseUrl(req)}/api/auth/google/callback`;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = getBaseUrl(req);

  if (!clientId) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_not_configured`);
  }

  const state = crypto.randomBytes(24).toString('hex');
  const callbackUrl = getCallbackUrl(req);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );

  response.cookies.set('codeforge_google_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  });

  return response;
}
