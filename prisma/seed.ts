import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const n = await prisma.user.count();
  if (n > 0) {
    console.log("seed dilewati (sudah ada data)");
    return;
  }

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

  const admin = await prisma.user.create({
    data: { name: "Admin Kampus", email: "admin@kampus.id", passwordHash: hash("admin123"), role: "admin" },
  });
  const mod = await prisma.user.create({
    data: { name: "Budi Moderator", email: "mod@kampus.id", passwordHash: hash("mod123"), role: "moderator" },
  });
  const citra = await prisma.user.create({
    data: { name: "Citra Mahasiswa", email: "citra@kampus.id", passwordHash: hash("user123"), role: "user" },
  });
  const dedi = await prisma.user.create({
    data: { name: "Dedi Mahasiswa", email: "dedi@kampus.id", passwordHash: hash("user123"), role: "user" },
  });

  // T1: lama (120 jam), skor tinggi 12 — untuk uji ranking hot vs thread baru
  const t1 = await prisma.thread.create({
    data: {
      title: "Jadwal UAS semester ganjil sudah keluar, cek SIAKAD!",
      body: "Jadwal UAS sudah bisa dilihat di SIAKAD. Jangan lupa cetak kartu ujian sebelum H-3.",
      authorId: citra.id,
      score: 12,
      createdAt: hoursAgo(120),
    },
  });
  // T2: lama (96 jam), skor 8
  const t2 = await prisma.thread.create({
    data: {
      title: "Info kos murah dekat kampus gerbang selatan",
      body: "Ada kos 800rb/bulan, 10 menit jalan kaki ke gerbang selatan. Fasilitas kasur, lemari, wifi.",
      authorId: dedi.id,
      score: 8,
      createdAt: hoursAgo(96),
    },
  });
  // T3: baru (2 jam), skor rendah 3
  const t3 = await prisma.thread.create({
    data: {
      title: "Ada yang ikut UKM robotik tahun ini?",
      body: "Penasaran sama UKM robotik, open recruitment-nya kapan ya? Syaratnya apa saja?",
      authorId: citra.id,
      score: 3,
      createdAt: hoursAgo(2),
    },
  });
  // T4: paling baru (0.5 jam), skor 1
  const t4 = await prisma.thread.create({
    data: {
      title: "Pengumuman: kuliah daring hari Jumat",
      body: "Sehubungan dengan acara wisuda, perkuliahan hari Jumat dilaksanakan daring via Zoom.",
      authorId: admin.id,
      score: 1,
      createdAt: hoursAgo(0.5),
    },
  });

  // Vote seed mewakili sebagian (constraint unik user-thread); score thread diset manual di atas.
  await prisma.vote.createMany({
    data: [
      { userId: citra.id, threadId: t1.id, value: 1 },
      { userId: dedi.id, threadId: t1.id, value: 1 },
      { userId: mod.id, threadId: t1.id, value: 1 },
      { userId: admin.id, threadId: t1.id, value: 1 },
      { userId: citra.id, threadId: t2.id, value: 1 },
      { userId: mod.id, threadId: t2.id, value: 1 },
      { userId: admin.id, threadId: t2.id, value: -1 },
      { userId: dedi.id, threadId: t3.id, value: 1 },
      { userId: mod.id, threadId: t3.id, value: 1 },
      { userId: citra.id, threadId: t4.id, value: 1 },
    ],
  });

  // Komentar nested 3 level di T1: c1 (depth 0) -> c2 (depth 1) -> c3 (depth 2)
  const c1 = await prisma.comment.create({
    data: { threadId: t1.id, body: "Akhirnya keluar juga, makasih infonya!", authorId: dedi.id, createdAt: hoursAgo(110) },
  });
  const c2 = await prisma.comment.create({
    data: { threadId: t1.id, parentId: c1.id, body: "Sama-sama. Kartu ujiannya jangan lupa dicetak ya.", authorId: citra.id, createdAt: hoursAgo(109) },
  });
  await prisma.comment.create({
    data: { threadId: t1.id, parentId: c2.id, body: "Noted, sudah saya cetak tadi pagi.", authorId: mod.id, createdAt: hoursAgo(108) },
  });
  await prisma.comment.create({
    data: { threadId: t1.id, body: "Ruang ujiannya di gedung C lantai 2.", authorId: admin.id, createdAt: hoursAgo(100) },
  });
  await prisma.comment.create({
    data: { threadId: t3.id, body: "Open recruitment biasanya minggu kedua kuliah.", authorId: mod.id, createdAt: hoursAgo(1) },
  });

  // 1 laporan open: dedi melaporkan T2
  await prisma.report.create({
    data: { targetType: "thread", targetId: t2.id, reason: "Diduga promosi kos komersial berulang (spam).", reporterId: dedi.id, status: "open" },
  });

  console.log("seed selesai: 4 user, 4 thread, vote, komentar nested, 1 laporan open");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
