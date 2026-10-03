"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) router.push("/");
    else setErr(d.error === "kredensial_salah" ? "Email atau password salah." : `Gagal: ${d.error}`);
  }

  return (
    <div>
      <Header />
      <main className="max-w-sm mx-auto px-4 py-10">
        <form onSubmit={submit} className="bg-white rounded-lg border p-6">
          <h1 className="font-bold text-lg mb-4">Masuk</h1>
          {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
          <input
            className="w-full border rounded px-3 py-2 mb-2 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full border rounded px-3 py-2 mb-3 text-sm"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="w-full bg-indigo-600 text-white py-2 rounded text-sm hover:bg-indigo-700">
            Masuk
          </button>
          <p className="text-xs text-slate-500 mt-3 text-center">
            Belum punya akun?{" "}
            <Link href="/register" className="text-indigo-600 hover:underline">
              Daftar
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
