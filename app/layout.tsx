import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forum Diskusi Kampus",
  description: "Forum diskusi kampus ala Reddit: thread, vote, komentar bertingkat, dan moderasi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen text-slate-900">{children}</body>
    </html>
  );
}
