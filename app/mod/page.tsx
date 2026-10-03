"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header, { useMe } from "../components/Header";
import { timeAgo } from "@/lib/format";

type Report = {
  id: number;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  createdAt: string;
  reporterName: string;
  target: {
    title: string;
    snippet: string;
    authorId: number;
    authorName: string;
  } | null;
};

type ModAction = {
  id: number;
  action: string;
  targetType: string;
  targetId: number;
  reason: string | null;
  createdAt: string;
  moderatorName: string;
};

const ACTION_LABEL: Record<string, string> = {
  delete_thread: "Hapus thread",
  delete_comment: "Hapus komentar",
  ban_user: "Ban user",
  reject_report: "Tolak laporan",
};

export default function ModPanel() {
  const { me } = useMe();
  const [reports, setReports] = useState<Report[]>([]);
  const [actions, setActions] = useState<ModAction[]>([]);

  const load = useCallback(() => {
    fetch("/api/reports?status=open")
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? []));
    fetch("/api/mod/actions")
      .then((r) => r.json())
      .then((d) => setActions(d.actions ?? []));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: number, decision: "delete" | "ban" | "reject") {
    const labels = { delete: "hapus konten ini", ban: "ban penulis konten ini", reject: "tolak laporan ini" };
    if (!confirm(`Yakin ingin ${labels[decision]}?`)) return;
    const r = await fetch(`/api/reports/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) load();
    else alert(`Gagal: ${d.error}`);
  }

  const isMod = me && (me.role === "moderator" || me.role === "admin");

  return (
    <div>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="font-bold text-xl mb-4">Panel Moderasi</h1>
        {me === undefined ? (
          <p className="text-sm text-slate-500">Memuat...</p>
        ) : !isMod ? (
          <p className="text-sm text-slate-500">
            Halaman ini khusus moderator/admin.{" "}
            <Link href="/" className="text-indigo-600 hover:underline">
              Kembali
            </Link>
          </p>
        ) : (
          <>
            <h2 className="font-semibold mb-2">Antrean laporan ({reports.length})</h2>
            <div className="space-y-3 mb-8">
              {reports.map((r) => (
                <div key={r.id} className="bg-white rounded-lg border p-4">
                  <p className="text-sm">
                    <span className="font-medium">{r.reporterName}</span> melaporkan{" "}
                    <span className="font-medium">{r.targetType}</span> #{r.targetId}
                    <span className="text-slate-400"> • {timeAgo(r.createdAt)}</span>
                  </p>
                  {r.target ? (
                    <div className="bg-slate-50 rounded p-2 mt-2 text-sm">
                      <p className="font-medium">{r.target.title}</p>
                      <p className="text-slate-600">{r.target.snippet}</p>
                      <p className="text-xs text-slate-400 mt-1">penulis: {r.target.authorName}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-red-500 mt-2">Target sudah tidak ada.</p>
                  )}
                  <p className="text-sm mt-2">
                    <span className="text-slate-500">Alasan:</span> {r.reason}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => resolve(r.id, "delete")}
                      className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    >
                      Hapus konten
                    </button>
                    <button
                      onClick={() => resolve(r.id, "ban")}
                      className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700"
                    >
                      Ban penulis
                    </button>
                    <button
                      onClick={() => resolve(r.id, "reject")}
                      className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded hover:bg-slate-300"
                    >
                      Tolak laporan
                    </button>
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <p className="text-sm text-slate-400">Antrean kosong. Kerja bagus!</p>
              )}
            </div>

            <h2 className="font-semibold mb-2">Riwayat tindakan</h2>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2">Moderator</th>
                    <th className="px-3 py-2">Tindakan</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-3 py-2 text-xs text-slate-500">{timeAgo(a.createdAt)}</td>
                      <td className="px-3 py-2">{a.moderatorName}</td>
                      <td className="px-3 py-2">{ACTION_LABEL[a.action] ?? a.action}</td>
                      <td className="px-3 py-2 text-xs">
                        {a.targetType} #{a.targetId}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{a.reason ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {actions.length === 0 && (
                <p className="text-sm text-slate-400 p-4">Belum ada tindakan.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
