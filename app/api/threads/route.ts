import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { hotScore } from "@/lib/forum";

type SortKey = "hot" | "new" | "top";

export async function GET(req: NextRequest) {
  const sort = (req.nextUrl.searchParams.get("sort") ?? "hot") as SortKey;
  const orderBy =
    sort === "new"
      ? { createdAt: "desc" as const }
      : sort === "top"
        ? { score: "desc" as const }
        : { createdAt: "desc" as const };

  const threads = await prisma.thread.findMany({
    orderBy,
    include: {
      author: { select: { name: true } },
      _count: { select: { comments: true } },
    },
  });

  const me = await getSessionUser();
  let myVotes: Record<number, number> = {};
  if (me) {
    const votes = await prisma.vote.findMany({
      where: { userId: me.id, threadId: { in: threads.map((t) => t.id) } },
    });
    for (const v of votes) myVotes[v.threadId] = v.value;
  }

  const rows = threads.map((t) => ({
    id: t.id,
    title: t.title,
    body: t.body,
    authorName: t.author.name,
    score: t.score,
    commentCount: t._count.comments,
    createdAt: t.createdAt,
    hot: hotScore(t.score, t.createdAt),
    myVote: myVotes[t.id] ?? 0,
  }));

  if (sort === "hot") rows.sort((a, b) => b.hot - a.hot);
  return NextResponse.json({ sort, threads: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const title = body?.title?.toString().trim();
  const content = body?.body?.toString().trim() ?? "";
  if (!title) return NextResponse.json({ error: "judul_wajib" }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: "judul_maks_200" }, { status: 400 });

  const thread = await prisma.thread.create({
    data: { title, body: content, authorId: auth.id },
  });
  return NextResponse.json(thread, { status: 201 });
}
