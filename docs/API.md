# API

Semua endpoint ada di Next.js Route Handlers (`app/api`). Respons JSON.

## GET `/api/parts/{category}`

Katalog & spesifikasi dari [BuildCores OpenDB](https://github.com/buildcores/buildcores-open-db) (CC BY-NC-SA 4.0), dibaca dari `data/catalog/{category}.json` yang dihasilkan `npm run sync:catalog`. Diprerender saat build untuk setiap kategori. Urutan: tahun rilis terbaru dulu, lalu nama.

`category`: `cpu`, `motherboard`, `memory`, `video-card`, `internal-hard-drive`, `power-supply`, `case`, `cpu-cooler`.

```json
{
  "category": "cpu",
  "count": 789,
  "source": "https://github.com/buildcores/buildcores-open-db",
  "license": "CC BY-NC-SA 4.0",
  "syncedAt": "2026-11-20T14:24:47.235Z",
  "parts": [
    { "id": "7ab840c3-8c52-4ced-a65c-7b0922ca479e", "category": "cpu", "name": "AMD Ryzen 7 9800X3D", "brand": "AMD",
      "series": "Ryzen 7 9000", "releaseYear": 2024, "socket": "AM5", "tdp": 120, "memoryDdr": [5],
      "includesCooler": false, "graphics": "AMD Radeon Graphics", "...": "..." }
  ]
}
```

- `id` = `opendb_id` (UUID) dari OpenDB.
- Socket dinormalisasi (`LGA 1700` → `LGA1700`, `TR4` → `sTR4`), form factor (`Mini-ITX` → `Mini ITX`).
- Field per kategori: lihat `lib/types.ts`. Kasing membawa `supportedBoards`, `maxGpuLength`, `maxCoolerHeight`; cooler membawa `sockets` dan `height`.
- RAM SO-DIMM (laptop) tidak disertakan. `tdp` kartu grafis dari OpenDB, atau estimasi chipset kalau kosong.

Error: `404` kategori tidak dikenal.

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
