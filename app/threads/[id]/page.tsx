"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header, { Me, useMe } from "../../components/Header";
import { timeAgo } from "@/lib/format";

type Thread = {
  id: number;
  title: string;
  body: string;
  authorId: number;
  authorName: string;
  score: number;
  commentCount: number;
  createdAt: string;
  myVote: number;
};

type CommentNode = {
  id: number;
  body: string;
  authorId: number;
  authorName: string;
  createdAt: string;
  depth: number;
  children: CommentNode[];
};

function CommentForm({
  threadId,
  parentId,
  onDone,
  me,
}: {
  threadId: number;
  parentId: number | null;
  onDone: () => void;
  me: Me | undefined;
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch(`/api/threads/${threadId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, parentId }),
    });
    if (r.status === 401) {
      router.push("/login");
      return;
    }
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setText("");
      onDone();
    } else {
      setErr(d.error === "akun_diban" ? "Akun Anda di-ban." : `Gagal: ${d.error}`);
    }
  }

  if (!me) return null;
  return (
    <form onSubmit={submit} className="mt-2">
      {err && <p className="text-xs text-red-600 mb-1">{err}</p>}
      <textarea
        className="w-full border rounded px-3 py-2 text-sm"
        rows={2}
        placeholder={parentId ? "Tulis balasan..." : "Tulis komentar..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={me.isBanned}
      />
      <button
        type="submit"
        disabled={me.isBanned || !text.trim()}
        className="mt-1 bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
      >
        {parentId ? "Balas" : "Kirim komentar"}
      </button>
    </form>
  );
}

function CommentItem({
  c,
  threadId,
  me,
  reload,
}: {
  c: CommentNode;
  threadId: number;
  me: Me | undefined;
  reload: () => void;
}) {
  const [showReply, setShowReply] = useState(false);

  return (
    <div className={c.depth > 0 ? "ml-5 border-l-2 border-slate-200 pl-3 mt-3" : "mt-4"}>
      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-700">{c.authorName}</span> • {timeAgo(c.createdAt)}
        <span className="ml-2 text-slate-300">depth {c.depth}</span>
      </p>
      <p className="text-sm mt-1 whitespace-pre-wrap">{c.body}</p>
      {me && !me.isBanned && (
        <button
          onClick={() => setShowReply((s) => !s)}
          className="text-xs text-indigo-600 hover:underline mt-1"
        >
          {showReply ? "Batal" : "Balas"}
        </button>
      )}
      {showReply && (
        <CommentForm
          threadId={threadId}
          parentId={c.id}
          me={me}
          onDone={() => {
            setShowReply(false);
            reload();
          }}
        />
      )}
      {c.children.map((ch) => (
        <CommentItem key={ch.id} c={ch} threadId={threadId} me={me} reload={reload} />
      ))}
    </div>
  );
}

export default function ThreadDetail() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { me } = useMe();
  const [thread, setThread] = useState<Thread | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [total, setTotal] = useState(0);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/threads/${id}`)
      .then((r) => {
        if (r.status === 404) setNotFound(true);
        return r.json();
      })
      .then((d) => {
        if (d.id) setThread(d);
      });
    fetch(`/api/threads/${id}/comments`)
      .then((r) => r.json())
      .then((d) => {
        setComments(d.comments ?? []);
        setTotal(d.total ?? 0);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function vote(value: 1 | -1) {
    const r = await fetch(`/api/threads/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (r.status === 401) {
      router.push("/login");
      return;
    }
    const d = await r.json().catch(() => ({}));
    if (r.ok) setThread((t) => (t ? { ...t, score: d.score, myVote: d.vote } : t));
    else alert(d.error === "akun_diban" ? "Akun Anda di-ban." : `Gagal: ${d.error}`);
  }

  async function report(targetType: "thread" | "comment", targetId: number) {
    const reason = prompt("Alasan laporan:");
    if (!reason) return;
    const r = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason }),
    });
    const d = await r.json().catch(() => ({}));
    alert(r.ok ? "Laporan terkirim." : `Gagal: ${d.error}`);
  }

  if (notFound)
    return (
      <div>
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-6">
          <p className="text-slate-500">Thread tidak ditemukan.</p>
          <Link href="/" className="text-indigo-600 text-sm hover:underline">
            Kembali ke beranda
          </Link>
        </main>
      </div>
    );

  return (
    <div>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6">
        {!thread ? (
          <p className="text-sm text-slate-500">Memuat...</p>
        ) : (
          <>
            <div className="bg-white rounded-lg border p-5">
              <div className="flex gap-4">
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => vote(1)}
                    className={`text-xl leading-none ${thread.myVote === 1 ? "text-orange-600" : "text-slate-400 hover:text-orange-600"}`}
                  >
                    ▲
                  </button>
                  <span className="font-bold">{thread.score}</span>
                  <button
                    onClick={() => vote(-1)}
                    className={`text-xl leading-none ${thread.myVote === -1 ? "text-indigo-600" : "text-slate-400 hover:text-indigo-600"}`}
                  >
                    ▼
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold">{thread.title}</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    oleh {thread.authorName} • {timeAgo(thread.createdAt)}
                  </p>
                  <p className="text-sm mt-3 whitespace-pre-wrap">{thread.body}</p>
                  {me && (
                    <button
                      onClick={() => report("thread", thread.id)}
                      className="text-xs text-slate-400 hover:text-red-600 mt-3"
                    >
                      Laporkan thread
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-5 mt-4">
              <h2 className="font-semibold mb-2">Komentar ({total})</h2>
              {me ? (
                <CommentForm threadId={thread.id} parentId={null} me={me} onDone={load} />
              ) : (
                <p className="text-sm text-slate-500">
                  <Link href="/login" className="text-indigo-600 hover:underline">
                    Masuk
                  </Link>{" "}
                  untuk berkomentar.
                </p>
              )}
              <div>
                {comments.map((c) => (
                  <div key={c.id}>
                    <CommentItem c={c} threadId={thread.id} me={me} reload={load} />
                    {me && (
                      <button
                        onClick={() => report("comment", c.id)}
                        className="text-xs text-slate-300 hover:text-red-600 ml-1"
                      >
                        laporkan
                      </button>
                    )}
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-sm text-slate-400 mt-3">Belum ada komentar.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
