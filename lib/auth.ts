import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { token, userId } });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isBanned: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!s) return null;
  const u = s.user;
  return { id: u.id, name: u.name, email: u.email, role: u.role, isBanned: u.isBanned };
}

/** 401 bila belum login. */
export async function requireUser(): Promise<SessionUser | NextResponse> {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ error: "belum_login" }, { status: 401 });
  return u;
}

/** 401 bila belum login, 403 bila akun di-ban. Untuk semua endpoint tulis. */
export async function requireActiveUser(): Promise<SessionUser | NextResponse> {
  const r = await requireUser();
  if (r instanceof NextResponse) return r;
  if (r.isBanned) return NextResponse.json({ error: "akun_diban" }, { status: 403 });
  return r;
}

/** 401 bila belum login, 403 bila bukan moderator/admin. */
export async function requireMod(): Promise<SessionUser | NextResponse> {
  const r = await requireUser();
  if (r instanceof NextResponse) return r;
  if (r.role !== "moderator" && r.role !== "admin")
    return NextResponse.json({ error: "butuh_moderator" }, { status: 403 });
  return r;
}

export function isModRole(role: string): boolean {
  return role === "moderator" || role === "admin";
}
