# Forum Diskusi Kampus

Forum diskusi kampus ala Reddit: thread, vote up/down, komentar bertingkat
tanpa batas, pelaporan konten, dan panel moderasi. UI berbahasa Indonesia.

Stack: Next.js 14 + TypeScript + Prisma 5.22 + SQLite + Tailwind CSS.

## Cara Menjalankan

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

Buka http://localhost:3000.

## Halaman

- `/` — daftar thread dengan tab **hot / new / top**, form buat thread.
- `/threads/[id]` — detail thread, vote, komentar nested + balas.
- `/login`, `/register` — autentikasi.
- `/mod` — (moderator/admin) antrean laporan + riwayat tindakan.

## API

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/me`
- `GET /api/threads?sort=hot|new|top`, `POST /api/threads`,
  `GET/PATCH/DELETE /api/threads/[id]`
- `POST /api/threads/[id]/vote` (`{value: 1|-1}`, toggle), `DELETE` untuk batal
- `GET /api/threads/[id]/comments` (tree via `WITH RECURSIVE`, ada `depth`),
  `POST /api/threads/[id]/comments`
- `POST /api/reports`, `GET /api/reports?status=open` (mod),
  `POST /api/reports/[id]/resolve` (mod)
- `GET /api/mod/actions` (mod): riwayat tindakan moderasi

Detail aturan bisnis ada di `PRD.md`.
