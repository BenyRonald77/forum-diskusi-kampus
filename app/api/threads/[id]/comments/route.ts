import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth";

type Row = {
  id: number;
  threadId: number;
  parentId: number | null;
  body: string;
  authorId: number;
  createdAt: string;
  depth: number;
  authorName: string;
};

export type CommentNode = {
  id: number;
  body: string;
  authorId: number;
  authorName: string;
  createdAt: string;
  depth: number;
  children: CommentNode[];
};

/**
 * Ambil tree komentar via WITH RECURSIVE (SQLite). Kolom `depth`
 * membuktikan query rekursif berjalan: 0 = komentar utama, dst.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const threadId = Number(params.id);
  if (!Number.isInteger(threadId))
    return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });
  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });

  const rows = await prisma.$queryRaw<Row[]>`
    WITH RECURSIVE tree(id, threadId, parentId, body, authorId, createdAt, depth) AS (
      SELECT id, threadId, parentId, body, authorId, createdAt, 0
        FROM comments WHERE threadId = ${threadId} AND parentId IS NULL
      UNION ALL
      SELECT c.id, c.threadId, c.parentId, c.body, c.authorId, c.createdAt, t.depth + 1
        FROM comments c JOIN tree t ON c.parentId = t.id
    )
    SELECT t.id, t.threadId, t.parentId, t.body, t.authorId, t.createdAt, t.depth,
           u.name AS authorName
      FROM tree t JOIN users u ON u.id = t.authorId
     ORDER BY t.depth, t.createdAt`;

  // Rakit tree dari hasil datar (parent selalu muncul sebelum child karena ORDER BY depth).
  const byId = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];
  for (const r of rows) {
    const id = Number(r.id);
    byId.set(id, {
      id,
      body: r.body,
      authorId: Number(r.authorId),
      authorName: r.authorName,
      createdAt: new Date(r.createdAt).toISOString(),
      depth: Number(r.depth),
      children: [],
    });
  }
  for (const r of rows) {
    const id = Number(r.id);
    const node = byId.get(id)!;
    if (r.parentId === null || r.parentId === undefined) {
      roots.push(node);
    } else {
      const parent = byId.get(Number(r.parentId));
      if (parent) parent.children.push(node);
      else roots.push(node); // pengaman: parent hilang
    }
  }
  return NextResponse.json({ comments: roots, total: rows.length });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveUser();
  if (auth instanceof NextResponse) return auth;
  const threadId = Number(params.id);
  if (!Number.isInteger(threadId))
    return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });

  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread) return NextResponse.json({ error: "tidak_ketemu" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const text = body?.body?.toString().trim();
  if (!text) return NextResponse.json({ error: "isi_komentar_wajib" }, { status: 400 });

  let parentId: number | null = null;
  if (body?.parentId !== undefined && body?.parentId !== null) {
    parentId = Number(body.parentId);
    if (!Number.isInteger(parentId))
      return NextResponse.json({ error: "parent_tidak_valid" }, { status: 400 });
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.threadId !== threadId)
      return NextResponse.json({ error: "parent_tidak_valid" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: { threadId, parentId, body: text, authorId: auth.id },
    include: { author: { select: { name: true } } },
  });
  return NextResponse.json(
    {
      id: comment.id,
      body: comment.body,
      authorId: comment.authorId,
      authorName: comment.author.name,
      createdAt: comment.createdAt,
      parentId: comment.parentId,
    },
    { status: 201 },
  );
}
