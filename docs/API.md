# API

Semua endpoint ada di Next.js Route Handlers (`app/api`). Respons JSON.

## GET `/api/parts/{category}`

Katalog & spesifikasi komponen dari dataset publik [`docyx/pc-part-dataset`](https://github.com/docyx/pc-part-dataset) (MIT), sudah dinormalisasi. Hanya dipakai untuk daftar komponen dan cek kompatibilitas; `priceUsd` (snapshot AS, Juli 2025) tidak ditampilkan sebagai harga. Di-cache server 1 hari (`cacheLife("days")`), diprerender saat build.

`category`: `cpu`, `motherboard`, `memory`, `video-card`, `internal-hard-drive`, `power-supply`, `case`, `cpu-cooler`.

```json
{
  "category": "cpu",
  "count": 492,
  "source": "https://cdn.jsdelivr.net/gh/docyx/pc-part-dataset@main/data/json",
  "parts": [
    { "id": "1x9k2a", "category": "cpu", "name": "AMD Ryzen 5 7600X", "brand": "AMD", "priceUsd": 170.49,
      "socket": "AM5", "tdp": 105, "graphics": "Radeon", "coreCount": 6, "...": "..." }
  ]
}
```

- `id` stabil: hash FNV-1a dari nama + spesifikasi kunci.
- `socket` CPU diturunkan dari `microarchitecture` (lihat `lib/socket.ts`); `null` = tidak diketahui.
- `tdp` kartu grafis adalah estimasi dari tabel chipset (`lib/power.ts`).

Error: `404` kategori tidak dikenal, `502` dataset tidak bisa diambil.

## POST `/api/market-price`

Satu-satunya sumber harga: listing Tokopedia lewat Apify actor (`APIFY_ACTOR`, default `unnoted~tokopedia-product-search`). Butuh env `APIFY_TOKEN`.

Body:

| field | tipe | keterangan |
|---|---|---|
| `category` | string | kategori part |
| `partId` | string | `id` dari `/api/parts` |
| `condition` | `"new"` \| `"used"` | filter kondisi Tokopedia |
| `query` | string? | kata kunci pencarian, default dibuat dari nama part (maks 100 karakter) |
| `peek` | boolean? | `true` = hanya baca cache, tidak memulai run berbayar (UI tidak memakainya; lookup biasa juga membaca cache dulu) |

Respons (`status`):

- `disabled`: `APIFY_TOKEN` tidak di-set.
- `miss`: (hanya saat `peek`) belum ada di cache. Berisi `query` default.
- `done`: `{ result: MarketResult, cached: boolean }`.
- `running`: `{ runId }`, lanjut polling ke endpoint di bawah.
- `limited` (HTTP 429): batas per IP (20/jam) atau kuota harian global (`MARKET_DAILY_LIMIT`, default 10) habis.
- `failed`: `{ error }`.

`MarketResult`:

```json
{
  "query": "AMD Ryzen 5 7600X",
  "condition": "used",
  "fetchedAt": "2026-11-20T09:00:00.000Z",
  "stats": {
    "median": 2650000, "min": 2400000, "max": 2900000, "count": 7, "totalFound": 10,
    "listings": [
      { "title": "...", "priceIdr": 2400000, "url": "https://www.tokopedia.com/...", "shopName": "...",
        "shopCity": "Jakarta Barat", "shopType": "regular", "soldCount": 3, "rating": 5, "isAd": false }
    ]
  }
}
```

`stats` bernilai `null` kalau tidak ada listing yang relevan. Maksimal 10 listing per pencarian, tanpa filter rentang harga. Penyaringan: token model wajib ada di judul, varian lain dibuang (mis. `4070 Ti` saat mencari `4070`), kata `paket`/`bundle`/`laptop` dan aksesori (`backplate`, `bracket`, `dus kosong`, dll.) dibuang, lalu outlier IQR dibuang. Hasil di-cache 3 hari (hasil kosong 1 hari) per `(partId, condition, query)`.

## GET `/api/market-price/{runId}`

Polling status run yang dimulai oleh POST di atas. Respons sama dengan POST (`running`, `done`, `failed`). `404` kalau `runId` tidak dikenal atau sudah lewat 15 menit.
