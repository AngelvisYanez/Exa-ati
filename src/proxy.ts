import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Rutas públicas (marketing + auth + móvil QR). */
const PUBLIC_PATHS = [
  "/",
  "/precios",
  "/iniciar-sesion",
  "/registro",
  "/movil",
];

const TOKEN_COOKIE = "sri_access_token";

/**
 * Next.js 16+ network boundary (formerly middleware).
 * Gates app pages via httpOnly JWT cookie; API routes use verifyAuth().
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  const isExactPublic = pathname === "/";
  const isPublicPrefix = PUBLIC_PATHS.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
  );
  const isPublic =
    isExactPublic ||
    isPublicPrefix ||
    pathname.startsWith("/api") ||
    pathname === "/precios";

  if (isPublic) {
    // Autenticado en login/registro → panel
    if (
      token &&
      (pathname === "/iniciar-sesion" || pathname === "/registro")
    ) {
      return NextResponse.redirect(new URL("/panel", request.url));
    }
    // Autenticado en landing/precios puede seguir viendo marketing
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL("/iniciar-sesion", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
