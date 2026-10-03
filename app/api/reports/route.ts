import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, requireMod } from "@/lib/auth";

async function targetExists(targetType: string, targetId: number): Promise<boolean> {
  if (targetType === "thread")
    return (await prisma.thread.findUnique({ where: { id: targetId } })) !== null;
  if (targetType === "comment")
    return (await prisma.comment.findUnique({ where: { id: targetId } })) !== null;
  return false;
}

/** Buat laporan (user login). */
export async function POST(req: NextRequest) {
  const auth = await requireActiveUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const targetType = body?.targetType?.toString();
  const targetId = Number(body?.targetId);
  const reason = body?.reason?.toString().trim();
  if (targetType !== "thread" && targetType !== "comment")
    return NextResponse.json({ error: "targetType_harus_thread_atau_comment" }, { status: 400 });
  if (!Number.isInteger(targetId))
    return NextResponse.json({ error: "targetId_tidak_valid" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "alasan_wajib" }, { status: 400 });
  if (!(await targetExists(targetType, targetId)))
    return NextResponse.json({ error: "target_tidak_ketemu" }, { status: 404 });

  const report = await prisma.report.create({
    data: { targetType, targetId, reason, reporterId: auth.id, status: "open" },
  });
  return NextResponse.json(report, { status: 201 });
}

async function targetSummary(targetType: string, targetId: number) {
  if (targetType === "thread") {
    const t = await prisma.thread.findUnique({
      where: { id: targetId },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!t) return null;
    return { title: t.title, snippet: t.body.slice(0, 160), authorId: t.author.id, authorName: t.author.name };
  }
  const c = await prisma.comment.findUnique({
    where: { id: targetId },
    include: { author: { select: { id: true, name: true } }, thread: { select: { title: true } } },
  });
  if (!c) return null;
  return { title: `Komentar di "${c.thread.title}"`, snippet: c.body.slice(0, 160), authorId: c.author.id, authorName: c.author.name };
}

/** Antrean laporan (moderator/admin). */
export async function GET(req: NextRequest) {
  const auth = await requireMod();
  if (auth instanceof NextResponse) return auth;

  const status = req.nextUrl.searchParams.get("status") ?? "open";
  if (!["open", "resolved", "rejected"].includes(status))
    return NextResponse.json({ error: "status_tidak_valid" }, { status: 400 });

  const reports = await prisma.report.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
    include: { reporter: { select: { name: true } } },
  });

  const rows = [];
  for (const r of reports) {
    rows.push({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      reporterName: r.reporter.name,
      target: await targetSummary(r.targetType, r.targetId),
    });
  }
  return NextResponse.json({ reports: rows });
}
