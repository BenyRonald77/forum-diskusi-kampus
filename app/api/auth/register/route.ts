import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";

function publicUser(u: { id: number; name: string; email: string; role: string; isBanned: boolean }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, isBanned: u.isBanned };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.toString().trim();
  const email = body?.email?.toString().trim().toLowerCase();
  const password = body?.password?.toString() ?? "";
  if (!name || !email || !password)
    return NextResponse.json({ error: "nama_email_password_wajib" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json({ error: "password_min_6" }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "email_sudah_dipakai" }, { status: 409 });

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: "user" },
  });
  await createSession(user.id);
  return NextResponse.json(publicUser(user), { status: 201 });
}
