"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type Me = {
  id: number;
  name: string;
  email: string;
  role: string;
  isBanned: boolean;
} | null;

export function useMe() {
  const [me, setMe] = useState<Me | undefined>(undefined);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user ?? null))
      .catch(() => setMe(null));
  }, []);
  return { me, setMe };
}

export default function Header() {
  const { me, setMe } = useMe();
  const isMod = me && (me.role === "moderator" || me.role === "admin");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    window.location.href = "/";
  }

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="font-bold text-lg text-indigo-700">
          Forum Kampus
        </Link>
        <nav className="flex gap-3 text-sm">
          <Link href="/" className="text-slate-600 hover:text-indigo-700">
            Beranda
          </Link>
          {isMod && (
            <Link href="/mod" className="text-slate-600 hover:text-indigo-700">
              Moderasi
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {me === undefined ? null : me ? (
            <>
              {me.isBanned && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                  Akun di-ban
                </span>
              )}
              <span className="text-slate-600">
                {me.name}
                {isMod && <span className="text-indigo-600"> ({me.role})</span>}
              </span>
              <button onClick={logout} className="text-slate-500 hover:text-red-600">
                Keluar
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-600 hover:text-indigo-700">
                Masuk
              </Link>
              <Link
                href="/register"
                className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
              >
                Daftar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
