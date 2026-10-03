import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email?.toString().trim().toLowerCase();
  const password = body?.password?.toString() ?? "";
  if (!email || !password)
    return NextResponse.json({ error: "email_password_wajib" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return NextResponse.json({ error: "kredensial_salah" }, { status: 401 });

  await createSession(user.id);
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isBanned: user.isBanned },
  });
}
