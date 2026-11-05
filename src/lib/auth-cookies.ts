import { NextResponse } from "next/server";

export const AUTH_COOKIE = "sri_access_token";
export const REFRESH_COOKIE = "sri_refresh_token";

const isProd = process.env.NODE_ENV === "production";

export function setAuthCookies(
  response: NextResponse,
  {
    accessToken,
    refreshToken,
    maxAgeSec,
  }: {
    accessToken: string;
    refreshToken?: string;
    maxAgeSec: number;
  }
) {
  response.cookies.set(AUTH_COOKIE, accessToken, {
    path: "/",
    maxAge: maxAgeSec > 0 ? maxAgeSec : 60 * 60 * 24,
    sameSite: "lax",
    httpOnly: true,
    secure: isProd,
  });

  if (refreshToken) {
    response.cookies.set(REFRESH_COOKIE, refreshToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      httpOnly: true,
      secure: isProd,
    });
  }
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    secure: isProd,
  });
  response.cookies.set(REFRESH_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    secure: isProd,
  });
}

/** Uniform API error JSON. */
export function apiError(
  message: string,
  status: number,
  extras?: Record<string, unknown>
) {
  return NextResponse.json({ message, ...extras }, { status });
}
