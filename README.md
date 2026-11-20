# Rakit PC

Simulasi rakit PC: pilih komponen, cek kompatibilitas, lihat harga per item dan grand total. Setiap komponen bisa dihitung **baru** atau **bekas**, dengan harga pasar Indonesia dari Tokopedia.

## Sumber data

| Data | Sumber | Catatan |
|---|---|---|
| Katalog & spesifikasi | [BuildCores OpenDB](https://github.com/buildcores/buildcores-open-db) | CC BY-NC-SA 4.0 (non-komersial, wajib atribusi). Diringkas ke `data/catalog/` dan disinkronkan tiap hari oleh GitHub Actions. |
| Harga baru/bekas (satu-satunya sumber harga) | Tokopedia lewat Apify actor [`unnoted/tokopedia-product-search`](https://apify.com/unnoted/tokopedia-product-search) | Filter kondisi `new`/`used`. Scraper pihak ketiga (unofficial). |

Tidak ada API publik resmi untuk harga komponen PC di Indonesia, jadi semua harga diambil dari listing Tokopedia. Pengecekan jalan otomatis saat komponen dipilih atau kondisinya diganti. Harga yang dipakai adalah median listing yang judulnya cocok dengan model komponen, setelah varian lain, paket bundling, dan outlier dibuang. Detail di [docs/API.md](docs/API.md).

## Tech stack

Next.js 16 (App Router, Cache Components) · TypeScript · tsx + tar (sync katalog) · Tailwind CSS v4 · Radix Dialog · Zustand · TanStack Query & Virtual · Upstash Redis · Vitest.

## Sinkron katalog

`npm run sync:catalog` mengunduh OpenDB (±17 MB), menormalisasi 8 kategori, lalu menulis `data/catalog/*.json` dan `meta.json` (commit sumber & waktu sinkron). Workflow [.github/workflows/sync-catalog.yml](.github/workflows/sync-catalog.yml) menjalankannya setiap hari pukul 03.00 WIB dan meng-commit perubahan, sehingga Vercel deploy ulang otomatis. Workflow butuh izin tulis: **Settings → Actions → General → Workflow permissions → Read and write**.

## Lisensi data

Data komponen diadaptasi dari BuildCores OpenDB dan dibagikan dengan lisensi yang sama (CC BY-NC-SA 4.0), lihat [data/catalog/README.md](data/catalog/README.md). Atribusi tampil di footer aplikasi. Penggunaan komersial butuh izin tertulis dari BuildCores.

## Jalankan lokal

```bash
npm install
cp .env.example .env.local   # isi APIFY_TOKEN kalau mau cek harga Tokopedia
npm run dev
```

Tanpa `APIFY_TOKEN` daftar komponen & cek kompatibilitas tetap jalan, tapi harga hanya bisa diisi manual. Tanpa Upstash, cache harga & rate limit disimpan di memori proses (hilang saat restart).

```bash
npm run test    # unit test (kompatibilitas, socket, relevansi listing, share link, service harga)
npm run lint
npm run build
```

## Deploy gratis ke Vercel

1. Push repo ke GitHub, lalu **Import Project** di [vercel.com](https://vercel.com) (paket Hobby).
2. **Storage → Marketplace → Upstash Redis** (free tier), hubungkan ke project. Env terisi otomatis; nama `UPSTASH_REDIS_REST_*` maupun `KV_REST_API_*` sama-sama dikenali.
3. Buat akun [Apify](https://apify.com) (free: kredit $5/bulan), ambil token di **Settings → API & Integrations**, isi env `APIFY_TOKEN`.
4. Opsional: `MARKET_DAILY_LIMIT` (default 10 pengecekan baru/hari untuk semua pengguna; hasil cache tidak dihitung).
5. Deploy.

### Perkiraan biaya Apify

Actor menagih $0.0015 per listing. Satu pengecekan mengambil maksimal 10 listing ≈ $0.015. Default 10 pengecekan baru per hari ≈ $4,50/bulan, masih di dalam kredit gratis $5. Satu rakitan lengkap butuh 6 sampai 8 pengecekan, jadi kuota default cukup untuk sekitar satu rakitan baru per hari; komponen yang sudah pernah dicek dalam 3 hari terakhir diambil dari cache dan gratis. Naikkan `MARKET_DAILY_LIMIT` kalau pakai paket Apify berbayar. Ada juga rate limit 20 pengecekan/jam per IP. Pasang usage limit di console Apify sebagai pengaman.

## Struktur

```
app/api/parts/[category]   katalog dari data/catalog (prerender saat build)
data/catalog/              katalog hasil sinkron BuildCores OpenDB
scripts/sync-catalog.ts    unduh + normalisasi OpenDB
app/api/market-price       cek harga Tokopedia (POST) + polling run (GET /[runId])
components/builder         slot komponen, picker, ringkasan, panel harga pasar
lib/compat.ts              aturan kompatibilitas
lib/socket.ts              socket CPU dari microarchitecture, DDR motherboard
lib/market/                query & relevansi Tokopedia, statistik harga, provider Apify
store/build-store.ts       state rakitan (tersimpan di localStorage)
```
