# PRD — Forum Diskusi Kampus

Forum diskusi kampus ala Reddit: pengguna membuat thread, memberi vote,
berkomentar bertingkat tanpa batas kedalaman, dan melaporkan konten yang
melanggar. Moderator/admin menindaklanjuti laporan lewat panel moderasi.

## Stack

Next.js 14 (App Router) + TypeScript + Prisma 5.22 + SQLite + Tailwind CSS.

## Model Data

- **User** — `id`, `name`, `email` (unique), `passwordHash`, `role`
  (`admin` | `moderator` | `user`), `isBanned`, `createdAt`.
- **Session** — `id`, `token` (unique), `userId`, `createdAt`. Satu baris per
  sesi login; dihapus saat logout.
- **Thread** — `id`, `title`, `body`, `authorId`, `score` (denormalisasi
  `SUM(value)` vote, default 0), `createdAt`.
- **Vote** — `userId`, `threadId`, `value` (`1` | `-1`), kunci komposit
  `(userId, threadId)` → 1 user tepat 1 vote per thread.
- **Comment** — `id`, `threadId`, `parentId` (nullable; balasan ke komentar
  lain), `body`, `authorId`, `createdAt`. Kedalaman tidak dibatasi.
- **Report** — `id`, `targetType` (`thread` | `comment`), `targetId`,
  `reason`, `reporterId`, `status` (`open` | `resolved` | `rejected`),
  `createdAt`.
- **ModAction** — `id`, `moderatorId`, `action` (`delete_thread` |
  `delete_comment` | `ban_user` | `reject_report`), `targetType`, `targetId`,
  `reason`, `createdAt`. Riwayat semua tindakan moderasi.

## Fungsionalitas

### F0 — Scaffold, skema, seed

Scaffold Next.js + Tailwind + Prisma, `PRD.md`, skema di atas, seed awal:
admin (`admin@kampus.id` / `admin123`), moderator (`mod@kampus.id` /
`mod123`), 2 user biasa (`citra@kampus.id`, `dedi@kampus.id` / `user123`),
4 thread dengan vote bervariasi, komentar nested 3 level, 1 laporan `open`.

### F1 — Auth + CRUD thread

- `POST /api/auth/register` `{name, email, password}` → 201. Validasi:
  nama/email/password wajib, email unik (409 bila duplikat).
- `POST /api/auth/login` `{email, password}` → 200 bila cocok (401 bila salah).
- `POST /api/auth/logout` → hapus sesi. `GET /api/auth/me` → user aktif.
- **Desain sesi (sederhana, didokumentasikan):** password di-hash dengan
  bcrypt (bcryptjs, cost 10) — tidak pernah disimpan plain. Saat login/
  register, server membuat token sesi acak 256-bit, menyimpannya di tabel
  `Session`, dan mengirimkannya sebagai cookie **httpOnly** `session`
  (`SameSite=Lax`, `Path=/`). Setiap request membaca cookie → cari baris
  `Session` → join `User`. Logout menghapus baris sesi. Tidak ada JWT;
  pencabutan = hapus baris (dipakai juga untuk menegakkan ban).
- Thread: `POST /api/threads` (login), `PATCH /api/threads/[id]` dan
  `DELETE /api/threads/[id]` hanya oleh **pemilik atau moderator/admin**.
  Hapus thread = hapus vote + komentar + laporan terkait (cascade).

### F2 — Vote + ranking

- `POST /api/threads/[id]/vote` `{value: 1 | -1}` (login, tidak di-ban):
  - belum pernah vote → buat vote, `score += value`;
  - sudah vote nilai **berlawanan** → ubah nilai, `score += 2*value`;
  - sudah vote nilai **sama** → batalkan vote (toggle), `score -= value`.
  - Respons: `{ vote: 1 | -1 | 0, score }` (`0` = vote dibatalkan).
- `DELETE /api/threads/[id]/vote` → batalkan vote eksplisit.
- `score` dihitung ulang **atomik**: perubahan vote memakai
  `UPDATE ... SET score = score + delta` satu statement
  (`increment` Prisma), dan flip vote memakai `updateMany` kondisional +
  cek jumlah baris terpengaruh agar tahan balapan (pola conditional
  single-statement, bukan read-modify-write di transaksi interaktif).
- `GET /api/threads?sort=hot|new|top`:
  - `new` → `createdAt` desc; `top` → `score` desc;
  - `hot` → skor hot desc, dengan **formula ala Reddit**:
    `hot = score / pow(umur_jam + 2, 1.5)`
    (umur_jam = (now - createdAt) / 3600000). Konstanta `+2` mencegah
    pembagian nol dan memberi thread baru dorongan awal; eksponen `1.5`
    membuat thread lama turun peringkat walau skornya tinggi. Dihitung di
    JS (SQLite bawaan tidak punya `pow()`).

### F3 — Komentar bertingkat tak terbatas

- `POST /api/threads/[id]/comments` `{body, parentId?}` (login, tidak
  di-ban). `parentId` harus milik thread yang sama (400 bila tidak).
- `GET /api/threads/[id]/comments` → tree nested. Diambil dengan
  **WITH RECURSIVE** di SQLite (terbukti lewat kolom `depth` di respons):
  ```sql
  WITH RECURSIVE tree(id, threadId, parentId, body, authorId, createdAt, depth) AS (
    SELECT id, threadId, parentId, body, authorId, createdAt, 0
      FROM comments WHERE threadId = ? AND parentId IS NULL
    UNION ALL
    SELECT c.id, c.threadId, c.parentId, c.body, c.authorId, c.createdAt, t.depth + 1
      FROM comments c JOIN tree t ON c.parentId = t.id
  )
  SELECT t.*, u.name AS authorName FROM tree t
  JOIN users u ON u.id = t.authorId ORDER BY t.depth, t.createdAt;
  ```
  Server merakit nested `children[]` dari hasil datar + `depth`.
- UI menampilkan nested dengan indentasi per level.

### F4 — Moderasi

- `POST /api/reports` `{targetType: thread|comment, targetId, reason}`
  (login): target harus ada (404 bila tidak), `reason` wajib.
- `GET /api/reports?status=open` (moderator/admin): antrean laporan +
  ringkasan target.
- `POST /api/reports/[id]/resolve` (moderator/admin)
  `{decision: delete|ban|reject, reason?}`:
  - `delete` → hapus thread/komentar target (+ cascade), laporan `resolved`,
    catat `ModAction(delete_thread|delete_comment)`;
  - `ban` → `User.isBanned = true` untuk penulis konten, laporan `resolved`,
    catat `ModAction(ban_user)`;
  - `reject` → laporan `rejected`, catat `ModAction(reject_report)`.
- **User ter-ban**: `POST` thread / komentar / vote → **403**
  (`{ error: "akun_diban" }`). Ban dicek di setiap endpoint tulis lewat
  helper `requireActiveUser`. Login tetap bisa (agar pesan ban terlihat),
  tapi semua aksi tulis diblokir.
- `GET /api/mod/actions` (moderator/admin): riwayat ModAction desc.

### F5 — UI (Bahasa Indonesia)

- `/` — daftar thread, tab **hot / new / top**, kartu thread (judul,
  penulis, umur, skor, tombol vote ▲▼, jumlah komentar), form buat thread
  (login), header dengan status login + tautan panel moderasi.
- `/threads/[id]` — detail thread + tombol vote, daftar komentar nested
  (indentasi per depth) + form balas per komentar, form komentar utama.
- `/login`, `/register` — form auth.
- `/mod` — (moderator/admin) antrean laporan (tombol Hapus konten / Ban
  penulis / Tolak) + riwayat tindakan moderasi.

## Seed (prisma/seed.ts)

Berjalan hanya bila tabel `users` kosong. Isi: 4 user (admin, moderator,
2 user), 4 thread (2 lama skor tinggi, 2 baru skor rendah — untuk menguji
urutan hot), vote bervariasi, komentar nested 3 level di thread 1, 1
laporan `open` (user melaporkan thread).

## Kode respons error

400 validasi, 401 belum login / kredensial salah, 403 terlarang
(bukan pemilik / bukan moderator / akun di-ban → `akun_diban`),
404 tidak ketemu, 409 konflik (email duplikat).
