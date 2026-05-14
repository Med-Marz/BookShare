# BookShare

Peer-to-peer book lending and exchange platform. The backend is a five-component Node.js system: an API gateway that speaks REST + GraphQL to the React client and gRPC to four microservices (`user-service`, `book-service`, `loan-service`, `notification-service`), with Kafka for async business events and MinIO for cover-image storage.

## Stack

- **Frontend:** React 19 + Vite + React Router + Apollo Client + axios + Tailwind CSS 3.
- **Gateway:** Express 5 + Apollo Server 5 (GraphQL) + `@grpc/grpc-js` clients + JWT auth.
- **Microservices:** Node 20 + `@grpc/grpc-js` (no Express). Each owns its own database (SQLite or RxDB).
- **Async:** Kafka in KRaft mode (no Zookeeper) — four topics, distinct consumer groups per service.
- **Storage:** MinIO (S3-compatible) bucket for cover images, used by `book-service` only.
- **Orchestration:** Docker Compose — eight containers, healthchecks, named volumes for persistence.

## Prerequisites

- Docker 20+ and Docker Compose v2 (included with Docker Desktop).
- Node.js 20 LTS — only needed if you want to run individual services outside Docker for development.

## Quickstart

```bash
git clone https://github.com/Med-Marz/BookShare.git
cd BookShare

# 1. Copy environment template (defaults work out of the box).
cp .env.example .env

# 2. Bring up the full stack (builds images on first run; ~3-5 minutes).
docker compose up -d --build

# 3. Watch the containers reach 'healthy'.
docker compose ps
```

Once every container shows `healthy`:

| Surface         | URL                                                |
| --------------- | -------------------------------------------------- |
| React client    | http://localhost:8080                              |
| Gateway REST    | http://localhost:4000/api/v1                       |
| Gateway GraphQL | http://localhost:4000/graphql                      |
| Gateway health  | http://localhost:4000/health                       |
| MinIO console   | http://localhost:9001 (login with `MINIO_*` creds) |

Stream logs from every service interleaved:

```bash
docker compose logs -f
```

Tear down (preserve data):

```bash
docker compose down
```

Tear down and wipe persistent volumes:

```bash
docker compose down -v
```

## Local development (without Docker)

For fast iteration on a single workspace, install all deps once at the root and run individual workspaces with hot reload:

```bash
npm install

# Frontend on http://localhost:5173 with HMR
npm run dev -w apps/web

# Gateway on http://localhost:4000 with nodemon reload
npm run dev -w apps/gateway

# Individual microservice (substitute the workspace name)
npm run dev -w services/user-service
```

Kafka and MinIO still run from Docker even in this mode: `docker compose up -d kafka minio`.

## Quality

```bash
npm run lint           # eslint across every workspace
npm run format         # prettier --write
npm run format:check   # prettier --check (used in CI-style verification)
```

## Repository layout

```
apps/
├── web/                React + Vite + Tailwind client (served by nginx in Docker)
└── gateway/            Express + Apollo Server, the only client-facing HTTP entry point
services/
├── user-service/       Accounts, auth, profile (SQLite)
├── book-service/       Catalog, covers (MinIO), availability state (RxDB)
├── loan-service/       Reservations, loans, Kafka producer (SQLite)
└── notification-service/  Kafka consumer + mock notification log (SQLite)
proto/                  Shared .proto contracts + Kafka event documentation
docker-compose.yml      8-service orchestration with healthchecks
```

## Documentation (filled in as the project grows)

- `proto/kafka-events.md` — Kafka envelope and per-topic payload contracts.
- `docs/REST-endpoints.md` — REST endpoint table (lands during epic 1–4).
- `docs/GraphQL-schema.md` — GraphQL schema + sample queries (lands during epic 3).
- `docs/Database-descriptions.md` — per-service DB schemas (lands during epic 1–5).
- `docs/architecture-diagram.png` — full system diagram (lands during epic 6).

## License

MIT — see `LICENSE`.
