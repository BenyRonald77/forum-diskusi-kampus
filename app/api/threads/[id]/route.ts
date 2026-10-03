import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isModRole, requireActiveUser } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });
  const t = await prisma.thread.findUnique({
    where: { id },
    include: { author: { select: { name: true } }, _count: { select: { comments: true } } },
  });
  if (!t) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });
  const me = await getSessionUser();
  const myVote = me
    ? ((await prisma.vote.findUnique({ where: { userId_threadId: { userId: me.id, threadId: id } } }))?.value ?? 0)
    : 0;
  return NextResponse.json({
    id: t.id,
    title: t.title,
    body: t.body,
    authorId: t.authorId,
    authorName: t.author.name,
    score: t.score,
    commentCount: t._count.comments,
    createdAt: t.createdAt,
    myVote,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveUser();
  if (auth instanceof NextResponse) return auth;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });

  const t = await prisma.thread.findUnique({ where: { id } });
  if (!t) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });
  if (t.authorId !== auth.id && !isModRole(auth.role))
    return NextResponse.json({ error: "bukan_pemilik" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const title = body?.title?.toString().trim();
  const content = body?.body?.toString().trim();
  if (title !== undefined && !title)
    return NextResponse.json({ error: "judul_wajib" }, { status: 400 });
  if (title !== undefined && title.length > 200)
    return NextResponse.json({ error: "judul_maks_200" }, { status: 400 });

  const updated = await prisma.thread.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { body: content } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveUser();
  if (auth instanceof NextResponse) return auth;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });

  const t = await prisma.thread.findUnique({ where: { id } });
  if (!t) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });
  if (t.authorId !== auth.id && !isModRole(auth.role))
    return NextResponse.json({ error: "bukan_pemilik" }, { status: 403 });

  // Laporan menarget thread tidak punya FK -> hapus manual; vote & komentar cascade via FK.
  await prisma.report.deleteMany({ where: { targetType: "thread", targetId: id } });
  await prisma.thread.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
