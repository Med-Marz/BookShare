# Kafka topics

The Kafka broker (KRaft single-node) hosts **four business-event topics**.
Topics, consumer groups, and the envelope shape are also captured in
[`proto/kafka-events.md`](../proto/kafka-events.md), which is the contract
source of truth for producers and consumers. This file is the longer
narrative — what triggers each event, what the side effects look like, and
why we use Kafka here at all.

## Why Kafka

Kafka unlocks the **multi-consumer pattern** that justifies async
messaging over a synchronous gRPC call between two services. When a
borrower reserves a book:

- **book-service** needs to flip the book's `status` from `Available` to
  `Reserved` so the catalog reflects reality.
- **notification-service** needs to write a row that becomes the owner's
  "Houssem reserved your book" notification.

These are two completely unrelated side effects, owned by different
services, that both must happen. If loan-service called both over gRPC, it
would need to know each consumer's API and tolerate each one being down.
With Kafka, loan-service writes one event; both services pick it up
through their own consumer groups, on their own pace, and either side can
restart independently without affecting the other.

## Common envelope

Every message on every topic is a JSON object with this shape:

```json
{
  "eventId": "uuid-v4",
  "occurredAt": "2026-05-17T14:30:00.000Z",
  "actorId": "user-uuid",
  "data": {
    /* topic-specific snake_case fields */
  }
}
```

- `eventId` — fresh UUID per event; used by `notification-service` for
  idempotency (`UNIQUE` constraint in SQLite) and by `book-service` for an
  in-memory dedup set.
- `occurredAt` — ISO8601 timestamp the producer assigned at emit time.
- `actorId` — id of the user whose action triggered the event.
- `data` — payload (see per-topic sections below).

Encoding: `JSON.stringify(envelope)` over UTF-8 bytes. Message **key** is
always the `book_id`, so all events for the same book land in the same
partition and preserve order.

## Topics

### `book.reserved`

| | |
| --- | --- |
| **Producer** | loan-service |
| **Trigger** | Borrower clicks **Reserve** on an `Available` book (POST `/api/v1/books/:id/reservations`). |
| **Key** | `book_id` |
| **`data` shape** | `{ reservation_id, book_id, borrower_id, owner_id }` |

**Consumers:**

| Consumer group | Service | Side effect |
| --- | --- | --- |
| `book-service.book-status` | book-service | Patches the book document in RxDB: `status` goes from `Available` → `Reserved`. Defensive: if the current `status !== "Available"` (replay, race) the consumer warns and skips. |
| `notification-service.notifier` | notification-service | Resolves `borrower.display_name` (via `user-service.GetUser`) and `book.title` (via `book-service.GetBook`). Inserts a row in `notifications` with `recipient_actor_id = owner_id` and `message = "<borrower> reserved your book \"<title>\""`. |

**Sample payload:**

```json
{
  "eventId": "f6e5d8a0-2c43-4ec1-9b6c-1f9a4e21eccd",
  "occurredAt": "2026-05-17T14:16:00.820Z",
  "actorId": "03188aad-e09f-4537-8143-eb1c7cd4ec18",
  "data": {
    "reservation_id": "59a4e312-9fbd-4f3f-a50e-89e80e0a6990",
    "book_id": "2a45e289-25a5-4996-83d7-b0504d0fc371",
    "borrower_id": "03188aad-e09f-4537-8143-eb1c7cd4ec18",
    "owner_id": "e8f94dd5-4a2e-4dc2-a7e8-c3eeaaaabcbf"
  }
}
```

### `reservation.cancelled`

| | |
| --- | --- |
| **Producer** | loan-service |
| **Trigger** | Borrower cancels their `Active` reservation (DELETE `/api/v1/reservations/:id`). |
| **Key** | `book_id` |
| **`data` shape** | same as `book.reserved` |

**Consumers:**

| Consumer group | Service | Side effect |
| --- | --- | --- |
| `book-service.book-status` | book-service | RxDB patch: `Reserved` → `Available`. |
| `notification-service.notifier` | notification-service | Owner notification: `"<borrower> cancelled their reservation on your book \"<title>\""`. |

### `loan.started`

| | |
| --- | --- |
| **Producer** | loan-service |
| **Trigger** | Owner marks the handoff complete (POST `/api/v1/reservations/:id/start-loan`). |
| **Key** | `book_id` |
| **`data` shape** | same as `book.reserved` |

**Consumers:**

| Consumer group | Service | Side effect |
| --- | --- | --- |
| `book-service.book-status` | book-service | `Reserved` → `Lent Out`. |
| `notification-service.notifier` | notification-service | Borrower notification: `"Your loan of \"<title>\" has been started by <owner>"`. |

### `loan.returned`

| | |
| --- | --- |
| **Producer** | loan-service |
| **Trigger** | Owner marks the return (POST `/api/v1/reservations/:id/mark-returned`). |
| **Key** | `book_id` |
| **`data` shape** | same as `book.reserved` |

**Consumers:**

| Consumer group | Service | Side effect |
| --- | --- | --- |
| `book-service.book-status` | book-service | `Lent Out` → `Available`. |
| `notification-service.notifier` | notification-service | Borrower notification: `"Your return of \"<title>\" has been confirmed by <owner>"`. |

---

## Consumer-group hygiene

The same four topics are read by **two different services with two
different consumer-group IDs**, and that's the whole point:

- `book-service.book-status` — owned by book-service.
- `notification-service.notifier` — owned by notification-service.

**Different groups = broadcast.** Each message is delivered to every group
exactly once (per group), so both side effects fire for every event.

**Same group across services would silently break this** — Kafka would
deliver each message to only one of the two consumers and split the work.
Don't ever do that.

## Auto-creation

Topics are created automatically by the broker on first publish
(`auto.create.topics.enable=true` is the default for our dev cluster).
A fresh `docker compose up -d` reaches a state where the topics exist
within ~5 seconds of loan-service producing the first event.

## Delivery semantics

- **Producer:** loan-service uses `acks=-1` (waits for in-sync replicas).
  On our single-broker dev cluster this is effectively "acks=1" with a
  ~10ms latency.
- **Consumer:** kafkajs auto-commits offsets every 5 seconds.
  At-least-once delivery. Duplicates handled by:
  - book-service — in-memory `Set<eventId>` (deliberate: status is
    recomputable from the event log).
  - notification-service — DB-level `UNIQUE(event_id)` constraint
    (deliberate: notifications are user-visible records that must
    survive restarts).

## Watching events live

In one terminal:

```bash
docker compose logs -f loan-service notification-service book-service
```

In another terminal (or the React app), trigger a reserve. You'll see
three log lines flow in real time:

```
loan-service           | event: 'kafka.emit'                 topic: 'book.reserved' ...
book-service           | event: 'book.status.transition'     from: 'Available' to: 'Reserved'
notification-service   | event: 'notification.created'       message: 'X reserved your book "Y"'
```

That single Kafka event hitting two independent consumers is the
multi-consumer pattern made visible.
