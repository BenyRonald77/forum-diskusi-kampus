import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMod } from "@/lib/auth";

/**
 * Tindaklanjuti laporan (moderator/admin).
 * decision: delete -> hapus konten | ban -> ban penulis konten | reject -> tolak laporan.
 * Setiap keputusan dicatat di ModAction.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireMod();
  if (auth instanceof NextResponse) return auth;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });
  if (report.status !== "open")
    return NextResponse.json({ error: "laporan_sudah_ditangani" }, { status: 409 });

  const body = await req.json().catch(() => null);
  const decision = body?.decision?.toString();
  const reason = body?.reason?.toString().trim() || report.reason;
  if (!["delete", "ban", "reject"].includes(decision))
    return NextResponse.json({ error: "decision_harus_delete_ban_reject" }, { status: 400 });

  if (decision === "delete") {
    if (report.targetType === "thread") {
      const t = await prisma.thread.findUnique({ where: { id: report.targetId } });
      if (!t) return NextResponse.json({ error: "target_tidak_ketemu" }, { status: 404 });
      await prisma.report.deleteMany({ where: { targetType: "thread", targetId: t.id, status: "open" } });
      await prisma.thread.delete({ where: { id: t.id } }); // vote & komentar cascade via FK
    } else {
      const c = await prisma.comment.findUnique({ where: { id: report.targetId } });
      if (!c) return NextResponse.json({ error: "target_tidak_ketemu" }, { status: 404 });
      await prisma.report.deleteMany({ where: { targetType: "comment", targetId: c.id, status: "open" } });
      await prisma.comment.delete({ where: { id: c.id } }); // balasan cascade via FK
    }
    await prisma.modAction.create({
      data: {
        moderatorId: auth.id,
        action: report.targetType === "thread" ? "delete_thread" : "delete_comment",
        targetType: report.targetType,
        targetId: report.targetId,
        reason,
      },
    });
    // Laporan lain yang menarget konten sama ikut tertutup (sudah dihapus di atas bila open).
    await prisma.report.updateMany({
      where: { id: report.id },
      data: { status: "resolved" },
    });
    return NextResponse.json({ ok: true, decision });
  }

  if (decision === "ban") {
    const target =
      report.targetType === "thread"
        ? await prisma.thread.findUnique({ where: { id: report.targetId } })
        : await prisma.comment.findUnique({ where: { id: report.targetId } });
    if (!target) return NextResponse.json({ error: "target_tidak_ketemu" }, { status: 404 });
    if (target.authorId === auth.id)
      return NextResponse.json({ error: "tidak_bisa_ban_diri_sendiri" }, { status: 403 });
    const targetUser = await prisma.user.findUnique({ where: { id: target.authorId } });
    if (!targetUser) return NextResponse.json({ error: "target_tidak_ketemu" }, { status: 404 });
    if (targetUser.role === "admin" || targetUser.role === "moderator")
      return NextResponse.json({ error: "target_dilindungi" }, { status: 403 });

    await prisma.user.update({ where: { id: targetUser.id }, data: { isBanned: true } });
    await prisma.modAction.create({
      data: {
        moderatorId: auth.id,
        action: "ban_user",
        targetType: "user",
        targetId: targetUser.id,
        reason,
      },
    });
    await prisma.report.update({ where: { id: report.id }, data: { status: "resolved" } });
    return NextResponse.json({ ok: true, decision, bannedUserId: targetUser.id });
  }

  // reject
  await prisma.report.update({ where: { id: report.id }, data: { status: "rejected" } });
  await prisma.modAction.create({
    data: {
      moderatorId: auth.id,
      action: "reject_report",
      targetType: "report",
      targetId: report.id,
      reason,
    },
  });
  return NextResponse.json({ ok: true, decision });
}
