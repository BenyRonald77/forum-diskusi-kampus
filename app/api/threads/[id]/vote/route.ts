import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth";

const key = (userId: number, threadId: number) => ({ userId_threadId: { userId, threadId } });

/**
 * Vote toggle ala Reddit, tahan balapan:
 * - belum vote -> buat (score += value)
 * - vote berlawanan -> ubah nilai (score += 2*value), via updateMany kondisional
 * - vote sama -> batalkan (score -= value)
 * Perubahan score selalu satu statement atomik (increment).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveUser();
  if (auth instanceof NextResponse) return auth;
  const threadId = Number(params.id);
  if (!Number.isInteger(threadId))
    return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });

  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const value = body?.value;
  if (value !== 1 && value !== -1)
    return NextResponse.json({ error: "value_harus_1_atau_-1" }, { status: 400 });

  for (let attempt = 0; attempt < 3; attempt++) {
    // 1. Flip vote yang nilainya berlawanan (kondisional; 0 baris = tidak ada).
    const flipped = await prisma.vote.updateMany({
      where: { userId: auth.id, threadId, value: -value },
      data: { value },
    });
    if (flipped.count === 1) {
      const t = await prisma.thread.update({
        where: { id: threadId },
        data: { score: { increment: 2 * value } },
      });
      return NextResponse.json({ vote: value, score: t.score });
    }

    // 2. Belum ada vote -> buat baru.
    try {
      await prisma.vote.create({ data: { userId: auth.id, threadId, value } });
      const t = await prisma.thread.update({
        where: { id: threadId },
        data: { score: { increment: value } },
      });
      return NextResponse.json({ vote: value, score: t.score });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") throw e;
      // 3. Vote sudah ada (balapan create) -> baca ulang lalu putuskan.
      const existing = await prisma.vote.findUnique({ where: key(auth.id, threadId) });
      if (!existing) continue; // hilang di tengah balapan, coba lagi
      if (existing.value === value) {
        // Nilai sama -> batalkan vote (toggle off).
        await prisma.vote.delete({ where: key(auth.id, threadId) });
        const t = await prisma.thread.update({
          where: { id: threadId },
          data: { score: { increment: -value } },
        });
        return NextResponse.json({ vote: 0, score: t.score });
      }
      continue; // nilai berlawanan tapi luput dari langkah 1, coba lagi
    }
  }
  return NextResponse.json({ error: "konflik_vote" }, { status: 409 });
}

/** Batalkan vote secara eksplisit (idempoten). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveUser();
  if (auth instanceof NextResponse) return auth;
  const threadId = Number(params.id);
  if (!Number.isInteger(threadId))
    return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });

  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });

  const existing = await prisma.vote.findUnique({ where: key(auth.id, threadId) });
  if (existing) {
    await prisma.vote.delete({ where: key(auth.id, threadId) });
    const t = await prisma.thread.update({
      where: { id: threadId },
      data: { score: { increment: -existing.value } },
    });
    return NextResponse.json({ vote: 0, score: t.score });
  }
  return NextResponse.json({ vote: 0, score: thread.score });
}
