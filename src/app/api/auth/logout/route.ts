import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";

/** Clears httpOnly auth cookies (client still clears localStorage). */
export async function POST() {
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
