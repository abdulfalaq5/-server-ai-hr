# server-ai-hr

> **AI HR Assistant** — RAG-based chatbot untuk query kebijakan & dokumen HR perusahaan via Discord

Stack: **Node.js 22** · **TypeScript** · **Docker** · **FastEmbed** · **Qdrant** · **OpenClaw** · **OpenAI-compatible API**

---

## Arsitektur

```
Discord User
    │
    │ DM / Slash Command
    ▼
Discord Bot (Node.js)
    │
    │ HTTP + Bearer Token
    ▼
OpenClaw (AI Agent UI & Gateway)
    │
    │ OpenAI-compatible API
    ▼
HR Assistant (RAG Backend)  ←──── Qdrant (Vector DB)
    │                                    ▲
    │ Embedding (FastEmbed lokal)         │
    └────────────────────────────────────┘
         (multilingual-e5-large, 768-dim)
```

### Services & Port

| Service       | Container         | Port Host → Container | Fungsi                               |
|---------------|-------------------|-----------------------|--------------------------------------|
| `qdrant-hr`   | `qdrant-hr`       | `9005 → 6333`         | Vector database untuk embedding      |
| `hr-assistant`| `hr-assistant`    | `9004 → 9004`         | RAG backend + OpenAI-compatible API  |
| `openclaw`    | `openclaw-hr`     | `9002 → 9001`         | AI Agent Web UI & Gateway            |
| `discord-bot` | `discord-bot`     | —                     | Discord relay → OpenClaw             |

---

## Prerequisites

- Docker & Docker Compose v2
- Docker network `infra_net` sudah ada
- (Opsional) Discord Bot Token jika ingin pakai Discord

---

## Setup & Installation

### 1. Buat Docker Network (jika belum ada)

```bash
docker network create infra_net
```

### 2. Clone Repository

```bash
git clone <repo-url> server-ai-hr
cd server-ai-hr
```

### 3. Konfigurasi Environment

```bash
cp .env.example .env
nano .env   # atau editor favoritmu
```

Isi variabel berikut di `.env`:

```env
# LLM API — gunakan OpenRouter atau provider OpenAI-compatible lainnya
# Embedding dilakukan LOKAL oleh FastEmbed, tidak butuh API key embedding
OPENAI_API_KEY=your-openrouter-api-key-here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-4o-mini

# Discord Bot (isi jika pakai Discord)
DISCORD_BOT_TOKEN=your-discord-bot-token-here
DISCORD_ALERT_CHANNEL_ID=your-channel-id-here

# Discord User ID yang boleh pakai HR Assistant via DM (pisah koma)
# Cara cari: Discord › Settings › Advanced › Developer Mode › klik kanan user › Copy ID
DISCORD_ALLOWED_USERS=123456789012345678,987654321098765432

# Whitelist email untuk command /login
EMAIL_WHITELIST=yourname@example.com

# Token autentikasi Discord Bot ↔ OpenClaw (ganti dengan string random panjang!)
OPENCLAW_GATEWAY_TOKEN=change-me-to-a-long-random-token
OPENCLAW_PORT=9002
```

### 4. Upload Dokumen HR

Letakkan file PDF (atau DOCX/DOC) ke dalam folder `documents/` di root project:

```bash
# Buat folder jika belum ada
mkdir -p documents

# Salin dokumen HR kamu ke sini
cp /path/to/peraturan-perusahaan.pdf documents/
cp /path/to/kebijakan-cuti.pdf       documents/
cp /path/to/SOP-rekrutmen.docx       documents/
```

> **Format yang didukung:** `.pdf`, `.docx`, `.doc`

Struktur folder yang benar:
```
server-ai-hr/
└── documents/
    ├── peraturan-perusahaan.pdf
    ├── kebijakan-cuti.pdf
    └── SOP-rekrutmen.docx
```

> **Catatan:** Folder `documents/` di-mount ke dalam container sebagai `/documents`. Dokumen yang diletakkan di sini langsung terbaca oleh service tanpa perlu rebuild image.

### 5. Build & Jalankan

```bash
# Build semua image
docker compose build

# Jalankan semua service
docker compose up -d

# Cek status
docker compose ps
```

---

## Ingestion (Embedding Dokumen)

Ingestion adalah proses membaca dokumen, memecahnya menjadi chunks, membuat embedding vektor, lalu menyimpannya ke Qdrant.

### Cara 1 — Otomatis saat startup (default)

Setiap kali container `hr-assistant` start, ingestion berjalan otomatis dari folder `documents/`. Tidak perlu tindakan manual.

```bash
# Lihat log ingestion
docker logs hr-assistant --follow
```

Log yang muncul saat ingestion berhasil:
```
[INFO] Running startup document ingestion check...
[Ingestion] Starting full re-index from '/documents'...
[Ingestion] Found 3 document(s): peraturan-perusahaan.pdf, kebijakan-cuti.pdf, SOP-rekrutmen.docx
[Ingestion] ── Processing: peraturan-perusahaan.pdf
[Ingestion]    Parsed 42 page(s)/section(s).
[Ingestion]    Generated 186 chunk(s). Running FastEmbed batch...
[Ingestion]    Embedding complete. Upserting to Qdrant...
[Ingestion]    ✓ Indexed 186 chunks from 'peraturan-perusahaan.pdf'.
...
[Ingestion] ══ Completed. Total chunks indexed: 512 ══
```

### Cara 2 — Trigger manual via HTTP (tanpa restart)

Jika kamu menambahkan/mengubah dokumen saat container sudah berjalan, panggil endpoint `/ingest`:

```bash
curl -X POST http://localhost:9004/ingest
```

Response sukses:
```json
{
  "success": true,
  "message": "Successfully indexed 512 chunks from 3 document(s)."
}
```

> **Full re-index:** Setiap kali ingestion dipanggil, koleksi Qdrant akan di-drop dan dibuat ulang dari awal. Semua dokumen di folder `documents/` akan diindeks ulang seluruhnya.

### Cara 3 — Jalankan script ingest langsung di dalam container

```bash
docker exec -it hr-assistant node dist/ingest.js
```

---

## Menambah / Mengganti Dokumen

1. **Tambahkan** file PDF/DOCX baru ke folder `documents/`
2. **Trigger ingestion** manual:
   ```bash
   curl -X POST http://localhost:9004/ingest
   ```
3. Tunggu sampai selesai (cek log: `docker logs hr-assistant --follow`)
4. Dokumen baru sudah bisa di-query lewat Discord atau OpenClaw

---

## Endpoints HR Assistant (port 9004)

| Method | Endpoint             | Fungsi                                         |
|--------|----------------------|------------------------------------------------|
| `GET`  | `/health`            | Health check                                   |
| `POST` | `/query`             | Query langsung (internal) `{ "query": "..." }` |
| `POST` | `/v1/chat/completions` | OpenAI-compatible (dipakai OpenClaw)         |
| `POST` | `/ingest`            | Trigger re-index dokumen secara manual         |

---

## Verifikasi

```bash
# 1. Cek semua container berjalan
docker compose ps

# 2. Cek health HR Assistant
curl http://localhost:9004/health
# → {"status":"healthy","service":"hr-assistant","version":"1.0.0"}

# 3. Coba query langsung
curl -X POST http://localhost:9004/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Berapa hari cuti tahunan karyawan?"}'

# 4. Cek Qdrant (vector DB)
curl http://localhost:9005/collections
```

---

## Struktur Project

```
server-ai-hr/
├── docker-compose.yml
├── .env.example
├── documents/                  ← Letakkan PDF/DOCX HR di sini
│   └── (your HR documents)
├── storage/
│   └── qdrant_hr/              ← Data Qdrant (persistent)
├── hr-assistant/               ← RAG Backend (Node.js + TypeScript)
│   ├── src/
│   │   ├── index.ts            ← Express server + endpoints
│   │   ├── ingest.ts           ← CLI ingest script
│   │   ├── services/
│   │   │   ├── embedding.ts    ← FastEmbed (multilingual-e5-large)
│   │   │   ├── ingestion.ts    ← Document parsing + chunking + upsert
│   │   │   ├── rag.ts          ← RAG query pipeline
│   │   │   ├── db.ts           ← Qdrant client
│   │   │   └── parser.ts       ← PDF/DOCX parser
│   │   └── utils/
│   │       └── chunker.ts      ← Text chunking
│   ├── Dockerfile
│   └── package.json
├── discord-bot/                ← Discord relay bot
│   └── src/
├── openclaw/                   ← OpenClaw config
│   └── config/
└── README.md
```

---

## Troubleshooting

**Container `hr-assistant` gagal build:**
```bash
docker compose build hr-assistant --no-cache
```

**Ingestion lambat / tidak ada output:**
```bash
# Model FastEmbed didownload pertama kali (~500MB), tunggu sampai selesai
docker logs hr-assistant --follow
```

**Qdrant tidak bisa diakses:**
```bash
# Pastikan container qdrant-hr berjalan
docker compose ps qdrant-hr
curl http://localhost:9005/healthz
```

**Dokumen tidak terindeks:**
- Pastikan file ada di folder `documents/` (bukan subfolder)
- Format yang didukung hanya `.pdf`, `.docx`, `.doc`
- Cek log: `docker logs hr-assistant --follow`
- Trigger manual: `curl -X POST http://localhost:9004/ingest`
