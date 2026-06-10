import { NextResponse } from "next/server";

// Daftar akun statis yang diizinkan (Developer, Dosen, BIG)
const USERS_CREDENTIALS: Record<string, string> = {
  admin: "kepstong", // Akun Kelompok / Developer
  dosen: "pembimbing", // Akun Dosen Pembimbing
  big: "cggbig", // Akun Pihak BIG
};

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    // Validasi kecocokan username dan password
    if (
      USERS_CREDENTIALS[username] &&
      USERS_CREDENTIALS[username] === password
    ) {
      const response = NextResponse.json({ success: true });

      // Simpan cookie sesi di browser selama 1 hari (aman & HTTP-only)
      response.cookies.set("auth_token", "secure_session_active_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 jam
        path: "/",
      });

      return response;
    }

    return NextResponse.json(
      { message: "Username atau Password salah!" },
      { status: 401 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
