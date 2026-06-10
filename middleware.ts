import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Ambil token login dari cookie browser
  const token = request.cookies.get("auth_token")?.value;
  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthApi = request.nextUrl.pathname.startsWith("/api/login");

  // Jalankan pengecekan jika bukan pemanggilan API login biasa
  if (!isAuthApi) {
    // Skenario 1: Belum login dan mencoba buka dashboard utama, paksa ke halaman login
    if (!token && !isLoginPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Skenario 2: Sudah login tetapi mencoba iseng buka halaman login lagi, kembalikan ke dashboard
    if (token && isLoginPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

// Konfigurasi halaman mana saja yang dijaga oleh middleware ini
export const config = {
  matcher: [
    "/", // Jaga halaman utama dashboard
    "/login", // Pantau halaman login
  ],
};
