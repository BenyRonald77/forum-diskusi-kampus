"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header, { useMe } from "./components/Header";
import { timeAgo } from "@/lib/format";

type Thread = {
  id: number;
  title: string;
  body: string;
  authorName: string;
  score: number;
  commentCount: number;
  createdAt: string;
  hot: number;
  myVote: number;
};

const TABS = [
  { key: "hot", label: "Hot" },
  { key: "new", label: "Terbaru" },
  { key: "top", label: "Teratas" },
];

function ThreadList() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("sort");
  const sort = raw === "new" || raw === "top" ? raw : "hot";
  const [threads, setThreads] = useState<Thread[]>([]);
  const { me } = useMe();

  const load = useCallback(() => {
    fetch(`/api/threads?sort=${sort}`)
      .then((r) => r.json())
      .then((d) => setThreads(d.threads ?? []));
  }, [sort]);
  useEffect(() => {
    load();
  }, [load]);

  async function vote(id: number, value: 1 | -1) {
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
    if (r.ok) {
      setThreads((ts) => ts.map((t) => (t.id === id ? { ...t, score: d.score, myVote: d.vote } : t)));
    } else {
      alert(d.error === "akun_diban" ? "Akun Anda di-ban, tidak bisa vote." : `Gagal: ${d.error}`);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/?sort=${t.key}`}
            className={`px-4 py-1.5 rounded-full text-sm ${
              sort === t.key ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {threads.map((t) => (
          <div key={t.id} className="bg-white rounded-lg border p-4 flex gap-3">
            <div className="flex flex-col items-center gap-1 w-10 shrink-0">
              <button
                onClick={() => vote(t.id, 1)}
                className={`text-lg leading-none ${t.myVote === 1 ? "text-orange-600" : "text-slate-400 hover:text-orange-600"}`}
                title="Upvote"
              >
                ▲
              </button>
              <span className="font-bold text-sm">{t.score}</span>
              <button
                onClick={() => vote(t.id, -1)}
                className={`text-lg leading-none ${t.myVote === -1 ? "text-indigo-600" : "text-slate-400 hover:text-indigo-600"}`}
                title="Downvote"
              >
                ▼
              </button>
            </div>
            <div className="min-w-0">
              <Link href={`/threads/${t.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                {t.title}
              </Link>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{t.body}</p>
              <p className="text-xs text-slate-400 mt-2">
                oleh {t.authorName} • {timeAgo(t.createdAt)} • {t.commentCount} komentar
              </p>
            </div>
          </div>
        ))}
        {threads.length === 0 && <p className="text-slate-500 text-sm">Belum ada thread.</p>}
      </div>
      {me && <NewThreadForm onCreated={load} banned={!!me.isBanned} />}
    </div>
  );
}

function NewThreadForm({ onCreated, banned }: { onCreated: () => void; banned: boolean }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setTitle("");
      setBody("");
      onCreated();
    } else {
      setErr(d.error === "akun_diban" ? "Akun Anda di-ban." : `Gagal: ${d.error}`);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-lg border p-4 mt-6">
      <h2 className="font-semibold mb-3">Buat thread baru</h2>
      {banned && <p className="text-sm text-red-600 mb-2">Akun Anda di-ban, tidak bisa posting.</p>}
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
      <input
        className="w-full border rounded px-3 py-2 mb-2 text-sm"
        placeholder="Judul thread"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={banned}
      />
      <textarea
        className="w-full border rounded px-3 py-2 mb-2 text-sm"
        placeholder="Isi thread..."
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={banned}
      />
      <button
        type="submit"
        disabled={banned}
        className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        Posting
      </button>
    </form>
  );
}

export default function Home() {
  return (
    <div>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Suspense fallback={<p className="text-sm text-slate-500">Memuat...</p>}>
          <ThreadList />
        </Suspense>
      </main>
    </div>
  );
}
