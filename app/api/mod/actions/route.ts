import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMod } from "@/lib/auth";

/** Riwayat tindakan moderasi (moderator/admin). */
export async function GET() {
  const auth = await requireMod();
  if (auth instanceof NextResponse) return auth;

  const actions = await prisma.modAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { moderator: { select: { name: true } } },
  });
  return NextResponse.json({
    actions: actions.map((a) => ({
      id: a.id,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      reason: a.reason,
      createdAt: a.createdAt,
      moderatorName: a.moderator.name,
    })),
  });
}
