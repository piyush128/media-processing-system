# Media Processing & Delivery System

A production-grade media upload, processing, and delivery backend — inspired by platforms like YouTube and Instagram Reels.

Built to demonstrate real-world system design: large file handling, async event pipelines, object storage, full-text search, and fault tolerance.

---

## Architecture Overview

```
Client
  │
  ├── POST /upload/presigned-url ──► API Service ──► MinIO (pre-signed URL)
  │                                      │
  │                                      └──► PostgreSQL (metadata record)
  │
  ├── PUT (direct upload) ───────────────────────────────► MinIO
  │
  ├── POST /upload/confirm ──────► API Service ──► HeadObject (verify)
  │                                      │
  │                                      └──► Kafka (media.uploaded event)
  │                                                │
  │                                                └──► Worker Service
  │                                                        │
  │                                                        ├── Redis (idempotency check)
  │                                                        ├── Simulate processing
  │                                                        └──► PostgreSQL (status: ready)
  │
  └── GET /media/:userId ─────────► API Service ──► PostgreSQL ──► CDN URLs
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API Server | Node.js + Express |
| Object Storage | MinIO (S3-compatible) |
| Message Queue | Apache Kafka |
| Database | PostgreSQL 15 |
| Cache / Idempotency | Redis 7 |
| Infrastructure | Docker Compose |

---

## Features

- **Pre-signed URL uploads** — files go directly from client to MinIO, backend never touches the bytes
- **Multipart chunked upload** — support for large files with resume capability on connection failure
- **Async processing pipeline** — Kafka events trigger workers for media processing
- **Status tracking** — `uploaded → processing → ready / failed` lifecycle
- **CDN-ready URL serving** — swap `CDN_URL` env var to point to any CDN in production
- **Full-text search** — PostgreSQL GIN index with `tsvector` for fast keyword search
- **Idempotency** — Redis prevents duplicate Kafka event processing
- **Fault tolerance** — HeadObject verification before trusting client confirmations

---

## Project Structure

```
media-processing-system/
├── infrastructure/
│   └── docker-compose.yml          # PostgreSQL, MinIO, Kafka, Zookeeper, Redis
├── services/
│   ├── api-service/                # Express REST API
│   │   ├── src/
│   │   │   ├── index.js            # Server entry point
│   │   │   ├── config/
│   │   │   │   ├── db.js           # PostgreSQL connection pool
│   │   │   │   └── minio.js        # S3 client (MinIO)
│   │   │   ├── routes/
│   │   │   │   └── upload.js       # All upload + media routes
│   │   │   ├── kafka/
│   │   │   │   └── producer.js     # Kafka event publisher
│   │   │   └── db/
│   │   │       ├── 001_migration.sql   # Core schema
│   │   │       └── 002_migration.sql   # Full-text search
│   │   ├── .env.sample
│   │   └── package.json
│   └── worker-service/             # Kafka consumer + media processor
│       ├── src/
│       │   ├── worker.js           # Main worker entry point
│       │   ├── config/
│       │   │   └── db.js
│       │   └── kafka/
│       │       └── consumer.js     # Kafka consumer setup
│       ├── .env.sample
│       └── package.json
└── shared/
    └── kafka/
```

---

## Getting Started

### Prerequisites
- Node.js >= 18
- Docker + Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/piyush128/media-processing-system.git
cd media-processing-system
```

### 2. Start infrastructure

```bash
cd infrastructure
docker-compose up -d
```

This starts: PostgreSQL, MinIO, Kafka, Zookeeper, Redis.

Verify all containers are running:
```bash
docker ps
```

### 3. Create MinIO bucket

Open MinIO console at `http://localhost:9001` → login with `minioadmin / minioadmin` → Create Bucket → name it `media-uploads` → set Access Policy to `public`.

### 4. Run database migrations

```bash
docker exec -i media_postgres psql -U media_user -d media_db < services/api-service/src/db/001_migration.sql
docker exec -i media_postgres psql -U media_user -d media_db < services/api-service/src/db/002_migration.sql
```

### 5. Set up API Service

```bash
cd services/api-service
cp .env.sample .env
npm install
npm run dev
```

### 6. Set up Worker Service

```bash
cd services/worker-service
cp .env.sample .env
npm install
npm start
```

---

## API Reference

### Upload Flow

#### Get Pre-signed Upload URL
```
POST /upload/presigned-url
Content-Type: application/json

{
  "fileName": "video.mp4",
  "fileType": "video/mp4",
  "userId": "user123",
  "title": "My Vacation Video"
}
```
Response: `{ presignedUrl, fileKey }`

Client then uploads the file **directly to MinIO** using the presigned URL:
```bash
curl -X PUT "<presignedUrl>" -H "Content-Type: video/mp4" --data-binary @video.mp4
```

#### Confirm Upload & Trigger Processing
```
POST /upload/confirm
Content-Type: application/json

{
  "userId": "user123",
  "fileKey": "user123-1234567890-video.mp4"
}
```
Verifies file exists in MinIO, publishes Kafka event to trigger processing.

---

### Multipart Upload (Large Files)

#### Step 1 — Start multipart session
```
POST /upload/multipart/start
{ "fileName": "bigvideo.mp4", "fileType": "video/mp4", "userId": "user123" }
```
Response: `{ uploadId, fileKey }`

#### Step 2 — Get presigned URL per part
```
POST /upload/multipart/part-url
{ "uploadId": "...", "fileKey": "...", "partNumber": 1 }
```
Upload each part directly to MinIO using the returned URL. Save the `ETag` from the response header.

#### Step 3 — Complete upload
```
POST /upload/multipart/complete
{
  "uploadId": "...",
  "fileKey": "...",
  "parts": [{ "ETag": "abc123", "PartNumber": 1 }, ...]
}
```

---

### Media Retrieval

#### Get all media for a user
```
GET /media/:userId
```

#### Search media by keyword
```
GET /media/search?query=vacation
```
Uses PostgreSQL full-text search with GIN index.

---

## Key Design Decisions

**Pre-signed URLs over backend proxying** — At scale, routing file bytes through the backend doubles bandwidth and creates a memory bottleneck. Pre-signed URLs let clients upload directly to object storage.

**Kafka for async processing** — Decouples upload from processing. Workers can scale independently, and failed jobs can be retried without affecting the upload experience.

**Redis idempotency keys** — Kafka can deliver duplicate messages. Before processing, the worker checks a Redis key for the `fileKey`. If it exists, the event is skipped. The key is set *before* processing begins to prevent race conditions between concurrent worker instances.

**GIN index for full-text search** — A standard B-tree index cannot efficiently handle arbitrary keyword search (`LIKE '%keyword%'`). GIN stores an inverted index of lexemes, enabling fast full-text queries at scale.

**CDN_URL environment variable** — All media URLs are constructed using `CDN_URL`. In production, point this to CloudFront, Cloudflare, or any CDN. Zero code changes required.

---

## Status Lifecycle

```
uploaded ──► processing ──► ready
                        └──► failed
```

- `uploaded` — file received in object storage, awaiting processing
- `processing` — worker picked up the Kafka event, currently processing
- `ready` — processing complete, file available for delivery
- `failed` — processing failed, eligible for retry via reconciliation job

