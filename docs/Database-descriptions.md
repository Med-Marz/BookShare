# Database descriptions

BookShare follows the cahier's **one-database-per-microservice** rule.
Three services use SQLite3 (the relational engine the cahier allows),
one uses RxDB (the NoSQL alternative). Cover-image binaries live in MinIO,
separate from the relational catalog, owned by `book-service`.

| Service | Engine | Persistence target | Why this engine |
| --- | --- | --- | --- |
| `user-service` | SQLite3 | `user-db` volume → `/app/data/user.sqlite` | Account/auth tables benefit from `UNIQUE(email)` and atomic updates. |
| `book-service` | RxDB (in-memory + JSON snapshot) | `book-data` volume → `/app/data/snapshot.json` | The cahier requires a NoSQL component; RxDB's document model fits the catalog naturally and lets us demonstrate the schema-versioned migration pattern. |
| `loan-service` | SQLite3 | `loan-db` volume → `/app/data/loan.sqlite` | Reservation state machine is intrinsically relational (`borrower_id`, `owner_id`, `book_id`, lifecycle states). |
| `notification-service` | SQLite3 | `notification-db` volume → `/app/data/notification.sqlite` | `UNIQUE(event_id)` constraint provides cheap durable idempotency for Kafka redeliveries. |
| `book-service` (covers) | MinIO bucket `bookshare-covers` | `minio-data` volume | Binary covers don't belong in a row store; MinIO is the cahier-compatible S3 substitute. |

Each Docker volume is independent. `docker compose down` preserves them
all; `docker compose down -v` wipes them.

---

## user-service — SQLite

`users` table:

```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,    -- UUID v4
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,       -- bcrypt
  display_name  TEXT NOT NULL,
  phone         TEXT NOT NULL,
  address       TEXT NOT NULL,
  created_at    TEXT NOT NULL        -- ISO8601
);
```

- Passwords are bcrypt-hashed before insert. Plaintext never touches disk.
- `UNIQUE(email)` enforces FR3 (duplicate signup → 409 CONFLICT).
- Phone and address are mandatory because the contract is "exposed-to-borrower-after-reservation"; you can't sign up without coordinates someone could actually reach.

---

## book-service — RxDB (NoSQL, with on-disk JSON snapshot)

The cahier mandates one NoSQL store; we use RxDB with the in-memory storage
adapter, periodically flushed to a JSON snapshot under the `book-data`
Docker volume. The schema is enforced by RxDB's AJV validator and bumped
when shape changes.

```js
const bookSchema = {
  version: 1,                            // bumped on every shape change
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:              { type: 'string', maxLength: 64 },
    owner_id:        { type: 'string', maxLength: 64 },
    title:           { type: 'string', maxLength: 300 },
    author:          { type: 'string', maxLength: 200 },
    year_published:  { type: 'integer', minimum: -3000, maximum: 9999 },
    cover_object_key:{ type: 'string', maxLength: 300 },
    status:          { type: 'string', enum: ['Available', 'Reserved', 'Lent Out'] },
    created_at:      { type: 'string' },
    updated_at:      { type: 'string' },
  },
  required: ['id', 'owner_id', 'title', 'author', 'year_published',
             'cover_object_key', 'status', 'created_at', 'updated_at'],
};
```

Notes:
- `year_published` accepts negative years (BCE) so titles like *The Art of War* (~−500) fit.
- `status` is the catalog-side state machine; only the Kafka consumer (`book-service.book-status` group) ever transitions it. The HTTP routes and gRPC handlers can READ the status but never WRITE it directly — that's the rule that keeps the multi-consumer pattern honest.
- The snapshot file is read on boot via `bulkInsert` (NOT `importJSON`) to survive `version` bumps without throwing JD2.

### MinIO bucket `bookshare-covers`

Covers (JPEG / PNG / WebP, max 10 MB) live in MinIO. Each book's metadata
row carries a `cover_object_key` pointing at its blob. The gateway proxies
covers to the browser via `GET /api/v1/covers/:object_key` — MinIO itself
is never exposed to the client.

The bucket is auto-created on `book-service` boot if it doesn't already
exist; no manual provisioning required.

---

## loan-service — SQLite

`reservations` table:

```sql
CREATE TABLE IF NOT EXISTS reservations (
  id               TEXT PRIMARY KEY,    -- UUID
  book_id          TEXT NOT NULL,
  owner_id         TEXT NOT NULL,
  borrower_id      TEXT NOT NULL,
  state            TEXT NOT NULL,       -- Active | Cancelled | LoanStarted | Completed
  created_at       TEXT NOT NULL,
  loan_started_at  TEXT,                -- populated only on StartLoan
  returned_at      TEXT,                -- populated only on MarkReturned
  cancelled_at     TEXT                 -- populated only on CancelReservation
);
CREATE INDEX IF NOT EXISTS idx_reservations_borrower ON reservations(borrower_id);
CREATE INDEX IF NOT EXISTS idx_reservations_owner    ON reservations(owner_id);
```

- The lifecycle states form the loan state machine: `Active → LoanStarted → Completed`, or `Active → Cancelled`.
- The two indexes serve the two most common reads: "all reservations I've placed" and "all reservations on my books."
- loan-service is the **sole writer** for every Kafka topic in the system; this table is the upstream source of truth for the events it produces.

---

## notification-service — SQLite

`notifications` table:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id                  TEXT PRIMARY KEY,    -- UUID
  event_id            TEXT NOT NULL UNIQUE,-- Kafka envelope eventId — idempotency
  topic               TEXT NOT NULL,       -- book.reserved | reservation.cancelled | loan.started | loan.returned
  recipient_actor_id  TEXT NOT NULL,       -- the user this notification is FOR
  actor_id            TEXT NOT NULL,       -- the user who triggered the upstream action
  book_id             TEXT NOT NULL,
  reservation_id      TEXT NOT NULL,
  message             TEXT NOT NULL,       -- human-readable, rendered at consumption time
  occurred_at         TEXT NOT NULL,       -- ISO8601 from envelope
  created_at          TEXT NOT NULL,
  read_at             TEXT                 -- null until the recipient views it
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient_time
  ON notifications(recipient_actor_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_recipient_unread
  ON notifications(recipient_actor_id) WHERE read_at IS NULL;     -- partial index for the badge
```

- `UNIQUE(event_id)` is the durable idempotency layer. Kafka redeliveries
  (after a rebalance, restart, etc.) produce a `SQLITE_CONSTRAINT` that
  the handler catches and logs as `event: 'notification.duplicate'`.
- The partial index on `read_at IS NULL` makes the unread-count badge
  query a constant-time index probe rather than a full scan.
- `message` is denormalised: it embeds the actor's display name and the
  book's title resolved at consumption time. This is a deliberate trade-off
  — the consumer is slower (two extra gRPC calls per message) but the
  read API is a pure DB fetch with no fan-out.

---

## Persistence guarantees

| Action | Survives? |
| --- | --- |
| `docker compose down && docker compose up -d` | All four data stores + MinIO. Users can log in, their books are present, reservations and notifications still readable, covers still render. |
| `docker compose restart <service>` | All data. The service rejoins Kafka and resumes consumption from the last committed offset. |
| `docker compose down -v` (volumes wiped) | Nothing. All four DBs and the MinIO bucket are rebuilt from scratch on the next `up -d`. |
| `docker kill <service>` | All data. The container restarts automatically via `restart: unless-stopped`. |

Verified manually during Story 6.1 smoke and re-verifiable any time via
the demo walkthrough in [`README-deliverables.md`](./README-deliverables.md).
