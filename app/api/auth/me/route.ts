import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role, isBanned: u.isBanned },
  });
}
