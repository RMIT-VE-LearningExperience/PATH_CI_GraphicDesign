import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out" }, { status: 200 });
  response.headers.set(
    "Set-Cookie",
    "adminSession=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/",
  );
  return response;
}
